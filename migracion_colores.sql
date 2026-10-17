-- =====================================================================
-- COLORES POR PRODUCTO + STOCK POR COLOR + AVISO DE STOCK OPCIONAL
-- Corre esto UNA vez en el SQL Editor (después de schema.sql y de las otras migraciones).
-- Es seguro correrlo más de una vez.
--
--  productos.usa_colores   → el producto tiene varios colores; su cantidad es la suma de los colores
--  productos.avisar_stock  → true (normal) | false = NO avisar cuando se acabe. Con esto apagado:
--                            no sale la alerta de poco stock y se puede vender aunque ya no haya
--                            (la existencia nunca baja de 0).
--  producto_colores        → cada color con su stock
--  ventas.color / caja_items.color → de qué color fue lo vendido / lo pedido
--  ingreso_rapido(jsonb)   → suma piezas a varios productos y colores de una sola vez
-- =====================================================================
alter table productos add column if not exists usa_colores  boolean not null default false;
alter table productos add column if not exists avisar_stock boolean not null default true;

create table if not exists producto_colores (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  color       text not null,
  hex         text check (hex is null or hex ~* '^#[0-9a-f]{6}$'),
  cantidad    int  not null default 0 check (cantidad >= 0),
  orden       int  not null default 0,
  unique (producto_id, color)
);
create index if not exists idx_pcolores_producto on producto_colores (producto_id, orden);

alter table ventas     add column if not exists color text;
alter table caja_items add column if not exists color text;

-- La cantidad total de un producto con colores es siempre la suma de sus colores
create or replace function fn_sync_cantidad_colores() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.producto_id, old.producto_id);
begin
  update productos
     set cantidad = coalesce((select sum(cantidad) from producto_colores where producto_id = pid), 0)
   where id = pid and usa_colores;
  return null;
end $$;
drop trigger if exists trg_sync_colores on producto_colores;
create trigger trg_sync_colores after insert or update or delete on producto_colores
  for each row execute function fn_sync_cantidad_colores();

alter table producto_colores enable row level security;
drop policy if exists "admin_todo" on producto_colores;
create policy "admin_todo" on producto_colores for all to authenticated using (es_admin()) with check (es_admin());
revoke all on producto_colores from anon;
grant select, insert, update, delete on producto_colores to authenticated;
grant all on producto_colores to service_role;

-- ---------------------------------------------------------------------
-- Vistas: el visualizador y el público ven los colores (el público sin cantidades exactas)
-- ---------------------------------------------------------------------
create or replace view vista_catalogo as
select p.id, p.codigo, p.nombre, p.categoria_id, c.nombre as categoria,
       p.descripcion, p.precio, p.cantidad,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       p.precio_regateo,
       p.usa_colores,
       (not p.avisar_stock) as sin_control,
       coalesce((select json_agg(json_build_object('id', k.id, 'color', k.color, 'hex', k.hex, 'cantidad', k.cantidad) order by k.orden, k.color)
                   from producto_colores k where k.producto_id = p.id), '[]'::json) as colores
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo and es_usuario();

create or replace view vista_producto_publico as
select p.codigo, p.nombre, p.descripcion, c.nombre as categoria, p.precio,
       (p.cantidad > 0 or not p.avisar_stock) as disponible,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       coalesce((select json_agg(json_build_object('color', k.color, 'hex', k.hex, 'disponible', (k.cantidad > 0 or not p.avisar_stock)) order by k.orden, k.color)
                   from producto_colores k where k.producto_id = p.id and p.usa_colores), '[]'::json) as colores
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo;

-- ---------------------------------------------------------------------
-- Vender (con color y con aviso opcional)
-- ---------------------------------------------------------------------
drop function if exists registrar_venta(uuid,int,text,text,text,text,date,numeric,text,uuid);
create or replace function registrar_venta(
  p_producto_id      uuid,
  p_cantidad         int,
  p_vendido_por      text    default null,
  p_forma_pago       text    default 'contado',
  p_cliente_nombre   text    default null,
  p_cliente_telefono text    default null,
  p_fecha_limite     date    default null,
  p_precio           numeric default null,
  p_metodo           text    default 'efectivo',
  p_cuenta_id        uuid    default null,
  p_color            text    default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rol     text;
  v_prod    productos%rowtype;
  v_col     producto_colores%rowtype;
  v_precio  numeric;
  v_quien   text;
  v_cliente uuid;
  v_nombre  text := nullif(trim(coalesce(p_cliente_nombre, '')), '');
  v_tel     text := nullif(trim(coalesce(p_cliente_telefono, '')), '');
  v_color   text := nullif(trim(coalesce(p_color, '')), '');
  v_venta   ventas%rowtype;
  v_resto   int;
  v_cuenta  uuid;
  v_label   text;
begin
  select rol into v_rol from perfiles where id = auth.uid();
  if v_rol is null then raise exception 'NO_AUTORIZADO'; end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_forma_pago not in ('contado','fiado') then raise exception 'FORMA_PAGO_INVALIDA'; end if;
  if p_forma_pago = 'fiado' and v_nombre is null then raise exception 'CLIENTE_REQUERIDO'; end if;

  if p_forma_pago = 'contado' then
    if p_metodo not in ('efectivo','transferencia','deposito') then raise exception 'METODO_INVALIDO'; end if;
    v_cuenta := p_cuenta_id;
    if v_cuenta is null then
      if p_metodo = 'efectivo' then
        select id into v_cuenta from cuentas where tipo = 'efectivo' and activa order by orden limit 1;
      else raise exception 'CUENTA_REQUERIDA'; end if;
    elsif not exists (select 1 from cuentas where id = v_cuenta and activa) then
      raise exception 'CUENTA_INVALIDA';
    end if;
  end if;

  select * into v_prod from productos where id = p_producto_id and activo for update;
  if not found then raise exception 'PRODUCTO_NO_ENCONTRADO'; end if;

  -- Existencia: si el producto tiene colores se descuenta del color elegido; si no, del producto.
  -- Con el aviso de stock apagado se puede vender aunque no haya (la existencia nunca baja de 0).
  if v_prod.usa_colores then
    if v_color is null then raise exception 'COLOR_REQUERIDO'; end if;
    select * into v_col from producto_colores where producto_id = v_prod.id and color = v_color for update;
    if not found then raise exception 'COLOR_NO_ENCONTRADO'; end if;
    if v_col.cantidad < p_cantidad and v_prod.avisar_stock then raise exception 'STOCK_INSUFICIENTE'; end if;
    update producto_colores set cantidad = greatest(0, cantidad - p_cantidad) where id = v_col.id;
    select cantidad into v_resto from productos where id = v_prod.id;   -- ya lo recalculó el disparador
  else
    v_color := null;
    if v_prod.cantidad < p_cantidad and v_prod.avisar_stock then raise exception 'STOCK_INSUFICIENTE'; end if;
    update productos set cantidad = greatest(0, cantidad - p_cantidad) where id = v_prod.id;
    v_resto := greatest(0, v_prod.cantidad - p_cantidad);
  end if;
  v_label := v_prod.nombre || case when v_color is not null then ' (' || v_color || ')' else '' end;

  v_precio := case
                when v_rol = 'administrador' and p_precio is not null and p_precio >= 0 then p_precio
                when p_precio is not null and v_prod.precio_regateo is not null and p_precio = v_prod.precio_regateo then p_precio
                else v_prod.precio end;
  v_quien  := coalesce(nullif(trim(coalesce(p_vendido_por, '')), ''),
                       case when v_rol = 'administrador' then 'Administración' else 'Visualizador' end);

  if v_nombre is not null then
    select id into v_cliente from clientes where lower(nombre) = lower(v_nombre) limit 1;
    if v_cliente is null then
      insert into clientes (nombre, telefono) values (v_nombre, v_tel) returning id into v_cliente;
    elsif v_tel is not null then
      update clientes set telefono = v_tel where id = v_cliente and telefono is null;
    end if;
  end if;

  insert into ventas (producto_id, producto_codigo, producto_nombre, cantidad, precio_unitario,
                      costo_unitario, total, cliente_id, cliente_nombre, forma_pago, fecha_limite,
                      vendido_por, rol, user_id, precio_lista, metodo_cobro, cuenta_id, color)
  values (v_prod.id, v_prod.codigo, v_label, p_cantidad, v_precio,
          v_prod.costo, round(v_precio * p_cantidad, 2), v_cliente, v_nombre, p_forma_pago,
          case when p_forma_pago = 'fiado' then p_fecha_limite else null end,
          v_quien, v_rol, auth.uid(), v_prod.precio,
          case when p_forma_pago = 'contado' then p_metodo else null end, v_cuenta, v_color)
  returning * into v_venta;

  insert into notificaciones (tipo, titulo, mensaje, producto_id, venta_id)
  values ('venta', 'Venta de ' || v_quien,
          p_cantidad || ' × ' || v_label || ' · Q' || to_char(v_venta.total, 'FM999999990.00')
            || case when p_forma_pago = 'fiado' then ' · FIADO a ' || v_nombre else ' · ' || p_metodo end
            || case when v_precio < v_prod.precio then ' · con descuento' else '' end,
          v_prod.id, v_venta.id);

  -- Alerta de poco stock: solo si el producto tiene el aviso activado
  if v_prod.avisar_stock and v_resto <= v_prod.stock_minimo then
    insert into notificaciones (tipo, titulo, mensaje, producto_id)
    values ('stock_bajo',
            case when v_resto = 0 then 'Se agotó: ' || v_prod.nombre else 'Queda poco: ' || v_prod.nombre end,
            'Quedan ' || v_resto || ' (' || v_prod.codigo
              || coalesce(' · Tupperware ' || v_prod.codigo_tupperware, '') || ').',
            v_prod.id);
  end if;

  return json_build_object(
    'id', v_venta.id, 'producto_codigo', v_venta.producto_codigo, 'producto_nombre', v_venta.producto_nombre,
    'cantidad', v_venta.cantidad, 'precio_unitario', v_venta.precio_unitario, 'total', v_venta.total,
    'cliente_nombre', v_venta.cliente_nombre, 'forma_pago', v_venta.forma_pago,
    'fecha_limite', v_venta.fecha_limite, 'vendido_por', v_venta.vendido_por, 'created_at', v_venta.created_at,
    'metodo_cobro', v_venta.metodo_cobro, 'color', v_venta.color);
end $$;

revoke all on function registrar_venta(uuid,int,text,text,text,text,date,numeric,text,uuid,text) from public, anon;
grant execute on function registrar_venta(uuid,int,text,text,text,text,date,numeric,text,uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- Anular una venta devuelve la pieza a su color
-- ---------------------------------------------------------------------
create or replace function anular_venta(p_venta_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v ventas%rowtype; v_uc boolean;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into v from ventas where id = p_venta_id for update;
  if not found then raise exception 'VENTA_NO_ENCONTRADA'; end if;
  if v.anulada then return; end if;
  if v.producto_id is not null then
    select usa_colores into v_uc from productos where id = v.producto_id;
    if v_uc and v.color is not null then
      insert into producto_colores (producto_id, color, cantidad) values (v.producto_id, v.color, v.cantidad)
      on conflict (producto_id, color) do update set cantidad = producto_colores.cantidad + excluded.cantidad;
    else
      update productos set cantidad = cantidad + v.cantidad where id = v.producto_id;
    end if;
  end if;
  update ventas set anulada = true, anulada_at = now() where id = v.id;
  insert into bitacora (accion, detalle) values ('venta_anulada',
    jsonb_build_object('venta', v.id, 'producto', v.producto_nombre, 'cantidad', v.cantidad, 'total', v.total));
end $$;

-- ---------------------------------------------------------------------
-- Cajas: recibir y deshacer respetan el color de cada pieza
-- ---------------------------------------------------------------------
create or replace function recibir_caja(p_caja_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c cajas%rowtype; r record; v_uc boolean;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into c from cajas where id = p_caja_id for update;
  if not found then raise exception 'CAJA_NO_ENCONTRADA'; end if;
  if c.estado = 'recibida' then return; end if;
  for r in select producto_id, color, sum(cantidad)::int as cant, max(costo_unitario) as costo
             from caja_items where caja_id = p_caja_id and producto_id is not null
            group by producto_id, color loop
    select usa_colores into v_uc from productos where id = r.producto_id;
    if v_uc then
      insert into producto_colores (producto_id, color, cantidad)
      values (r.producto_id, coalesce(nullif(r.color, ''), 'Sin especificar'), r.cant)
      on conflict (producto_id, color) do update set cantidad = producto_colores.cantidad + excluded.cantidad;
    else
      update productos set cantidad = cantidad + r.cant where id = r.producto_id;
    end if;
    update productos set costo = coalesce(nullif(r.costo, 0), costo) where id = r.producto_id;
  end loop;
  update cajas set estado = 'recibida', recibida_at = now(), fecha_llegada = coalesce(fecha_llegada, current_date)
   where id = p_caja_id;
  insert into bitacora (accion, detalle) values ('caja_recibida', jsonb_build_object('caja', c.nombre, 'monto', c.monto_total));
end $$;

create or replace function revertir_recepcion_caja(p_caja_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c cajas%rowtype; r record; v_uc boolean;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into c from cajas where id = p_caja_id for update;
  if not found or c.estado <> 'recibida' then return; end if;
  for r in select producto_id, color, sum(cantidad)::int as cant
             from caja_items where caja_id = p_caja_id and producto_id is not null
            group by producto_id, color loop
    select usa_colores into v_uc from productos where id = r.producto_id;
    if v_uc then
      update producto_colores set cantidad = greatest(0, cantidad - r.cant)
       where producto_id = r.producto_id and color = coalesce(nullif(r.color, ''), 'Sin especificar');
    else
      update productos set cantidad = greatest(0, cantidad - r.cant) where id = r.producto_id;
    end if;
  end loop;
  update cajas set estado = 'pedida', recibida_at = null where id = p_caja_id;
  insert into bitacora (accion, detalle) values ('caja_recepcion_revertida', jsonb_build_object('caja', c.nombre));
end $$;

-- ---------------------------------------------------------------------
-- INGRESO RÁPIDO: suma piezas a varios productos y colores de una vez.
-- p_items = [{"producto_id": "...", "color": "Rojo" | null, "cantidad": 5}, ...]
-- ---------------------------------------------------------------------
create or replace function ingreso_rapido(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; v_uc boolean; v_n int; v_col text; v_total int := 0; v_pid uuid;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_pid := (it->>'producto_id')::uuid;
    v_n   := coalesce((it->>'cantidad')::int, 0);
    v_col := nullif(trim(coalesce(it->>'color', '')), '');
    if v_n < 1 then continue; end if;
    select usa_colores into v_uc from productos where id = v_pid for update;
    if not found then raise exception 'PRODUCTO_NO_ENCONTRADO'; end if;
    if v_uc then
      insert into producto_colores (producto_id, color, hex, cantidad)
      values (v_pid, coalesce(v_col, 'Sin especificar'), case when (it->>'hex') ~* '^#[0-9a-f]{6}$' then it->>'hex' end, v_n)
      on conflict (producto_id, color) do update
        set cantidad = producto_colores.cantidad + excluded.cantidad, hex = coalesce(producto_colores.hex, excluded.hex);
    else
      update productos set cantidad = cantidad + v_n where id = v_pid;
    end if;
    v_total := v_total + v_n;
  end loop;
  if v_total > 0 then
    insert into bitacora (accion, detalle) values ('ingreso_rapido', jsonb_build_object('piezas', v_total));
  end if;
  return v_total;
end $$;
revoke all on function ingreso_rapido(jsonb) from public, anon;
grant execute on function ingreso_rapido(jsonb) to authenticated;
