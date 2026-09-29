-- =====================================================================
-- VEDITH VARIEDADES · Panel de inventario (Tupperware)
-- Esquema completo para Supabase. Pégalo TODO en SQL Editor y dale RUN.
-- Es seguro correrlo más de una vez (usa "if not exists" / "or replace").
--
-- Roles:
--   administrador → todo (costos, código Tupperware, ganancias, deudas, etiquetas, PIN)
--   visualizador  → ve productos y precios, y puede VENDER. Nada más.
--
-- Seguridad: el visualizador NUNCA lee las tablas directamente. Lee la vista
-- "vista_catalogo" (sin costo ni código Tupperware) y vende llamando a la
-- función registrar_venta(). Por eso aunque abra la consola del navegador
-- no puede sacar costos, deudas ni el código de Tupperware.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net  with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- 1. PERFILES (quién es admin y quién es visualizador)
-- ---------------------------------------------------------------------
create table if not exists perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  rol        text not null check (rol in ('administrador','visualizador')),
  nombre     text,
  created_at timestamptz not null default now()
);

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'administrador');
$$;

create or replace function es_usuario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2. CATÁLOGO
-- ---------------------------------------------------------------------
create table if not exists categorias (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden  int  not null default 0
);

create sequence if not exists productos_codigo_seq start 1;

create table if not exists productos (
  id                  uuid primary key default gen_random_uuid(),
  -- Código interno de la empresa: sale en el QR y en la ficha pública.
  codigo              text not null unique
                        default ('VED-' || lpad(nextval('productos_codigo_seq')::text, 4, '0')),
  -- Código oficial de Tupperware (para volver a pedir). SOLO admin: no está
  -- en ninguna de las vistas que ve el visualizador ni el público.
  codigo_tupperware   text,
  nombre              text not null,
  categoria_id        uuid references categorias(id) on delete set null,
  descripcion         text,
  precio              numeric(12,2) not null default 0 check (precio >= 0),
  costo               numeric(12,2) not null default 0 check (costo >= 0),
  cantidad            int  not null default 0 check (cantidad >= 0),
  stock_minimo        int  not null default 2 check (stock_minimo >= 0),
  activo              boolean not null default true,
  etiqueta_impresa_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_productos_nombre on productos (lower(nombre));
create index if not exists idx_productos_cat    on productos (categoria_id);
create index if not exists idx_productos_tupper on productos (codigo_tupperware);

-- Las fotos son SOLO links a la web (no se sube ningún archivo).
create table if not exists fotos_producto (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  url_foto    text not null check (url_foto ~* '^https?://'),
  orden       int  not null default 0
);
create index if not exists idx_fotos_producto on fotos_producto (producto_id, orden);

-- Máximo 5 fotos por producto
create or replace function fn_limite_fotos() returns trigger language plpgsql as $$
begin
  if (select count(*) from fotos_producto where producto_id = new.producto_id) >= 5 then
    raise exception 'MAXIMO_5_FOTOS';
  end if;
  return new;
end $$;
drop trigger if exists trg_limite_fotos on fotos_producto;
create trigger trg_limite_fotos before insert on fotos_producto
  for each row execute function fn_limite_fotos();

create or replace function fn_touch_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_productos_updated on productos;
create trigger trg_productos_updated before update on productos
  for each row execute function fn_touch_updated();

-- ---------------------------------------------------------------------
-- 3. CLIENTES, VENTAS, ABONOS, GASTOS
-- ---------------------------------------------------------------------
create table if not exists clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text,
  notas      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_clientes_nombre on clientes (lower(nombre));

create table if not exists ventas (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid references productos(id) on delete set null,
  -- Copia de los datos al momento de vender: el historial no cambia aunque
  -- después edites o borres el producto.
  producto_codigo text not null,
  producto_nombre text not null,
  cantidad        int  not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  costo_unitario  numeric(12,2) not null default 0,
  total           numeric(12,2) not null,
  cliente_id      uuid references clientes(id) on delete set null,
  cliente_nombre  text,
  forma_pago      text not null default 'contado' check (forma_pago in ('contado','fiado')),
  fecha_limite    date,
  vendido_por     text not null,
  rol             text not null,
  user_id         uuid default auth.uid(),
  anulada         boolean not null default false,
  anulada_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ventas_fecha   on ventas (created_at desc);
create index if not exists idx_ventas_persona on ventas (vendido_por);
create index if not exists idx_ventas_user    on ventas (user_id, created_at desc);

create table if not exists abonos (
  id         uuid primary key default gen_random_uuid(),
  venta_id   uuid not null references ventas(id) on delete cascade,
  monto      numeric(12,2) not null check (monto > 0),
  nota       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_abonos_venta on abonos (venta_id);

create table if not exists gastos (
  id         uuid primary key default gen_random_uuid(),
  concepto   text not null,
  monto      numeric(12,2) not null check (monto >= 0),
  fecha      date not null default current_date,
  nota       text,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3b. CUENTAS (a dónde va el dinero), CAJAS (pedidos a Tupperware),
--     MOVIMIENTOS (depósitos de efectivo al banco) y DESCUENTO (regateo)
--     No es contabilidad bancaria: solo deja constancia de dónde quedó
--     cada quetzal (efectivo, depósito, transferencia).
-- ---------------------------------------------------------------------
create table if not exists cuentas (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo   text not null check (tipo in ('efectivo','banco')),
  activa boolean not null default true,
  orden  int not null default 1
);
insert into cuentas (nombre, tipo, orden)
select 'Efectivo', 'efectivo', 0 where not exists (select 1 from cuentas where tipo = 'efectivo');

alter table productos add column if not exists precio_regateo numeric(12,2)
  check (precio_regateo is null or precio_regateo >= 0);

alter table ventas add column if not exists precio_lista  numeric(12,2);
alter table ventas add column if not exists metodo_cobro  text check (metodo_cobro in ('efectivo','transferencia','deposito'));
alter table ventas add column if not exists cuenta_id     uuid references cuentas(id) on delete set null;
alter table abonos add column if not exists metodo_cobro  text check (metodo_cobro in ('efectivo','transferencia','deposito'));
alter table abonos add column if not exists cuenta_id     uuid references cuentas(id) on delete set null;

-- Pedido/caja que llega de Tupperware
create table if not exists cajas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,                 -- ej. "Caja 14 · Campaña 9"
  numero_pedido  text,                          -- número de pedido de Tupperware
  fecha_pedido   date not null default current_date,
  fecha_llegada  date,
  estado         text not null default 'pedida' check (estado in ('pedida','recibida')),
  recibida_at    timestamptz,
  monto_total    numeric(12,2) not null default 0 check (monto_total >= 0),
  pagada         boolean not null default false,   -- ¿ya se depositó/pagó la caja?
  pagada_el      date,
  metodo_pago    text check (metodo_pago in ('efectivo','transferencia','deposito')),
  cuenta_id      uuid references cuentas(id) on delete set null,  -- de dónde salió el dinero
  nota_pago      text,
  notas          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_cajas_fecha on cajas (fecha_pedido desc);

create table if not exists caja_items (
  id              uuid primary key default gen_random_uuid(),
  caja_id         uuid not null references cajas(id) on delete cascade,
  producto_id     uuid references productos(id) on delete set null,
  producto_nombre text not null,
  cantidad        int not null check (cantidad > 0),
  costo_unitario  numeric(12,2) not null default 0 check (costo_unitario >= 0)
);
create index if not exists idx_caja_items_caja on caja_items (caja_id);

-- "Deposité X del efectivo al banco"
create table if not exists movimientos_caja (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null default current_date,
  origen_id  uuid references cuentas(id) on delete set null,
  destino_id uuid references cuentas(id) on delete set null,
  monto      numeric(12,2) not null check (monto > 0),
  nota       text,
  created_at timestamptz not null default now()
);

-- Recibir una caja = sumar sus piezas al inventario (una sola vez)
create or replace function recibir_caja(p_caja_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c cajas%rowtype;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into c from cajas where id = p_caja_id for update;
  if not found then raise exception 'CAJA_NO_ENCONTRADA'; end if;
  if c.estado = 'recibida' then return; end if;
  update productos p
     set cantidad = p.cantidad + s.cant,
         costo    = coalesce(nullif(s.costo, 0), p.costo)
    from (select producto_id, sum(cantidad) as cant, max(costo_unitario) as costo
            from caja_items where caja_id = p_caja_id and producto_id is not null
           group by producto_id) s
   where p.id = s.producto_id;
  update cajas set estado = 'recibida', recibida_at = now(), fecha_llegada = coalesce(fecha_llegada, current_date)
   where id = p_caja_id;
  insert into bitacora (accion, detalle) values ('caja_recibida', jsonb_build_object('caja', c.nombre, 'monto', c.monto_total));
end $$;

-- Deshacer una recepción hecha por error (resta lo que sumó)
create or replace function revertir_recepcion_caja(p_caja_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c cajas%rowtype;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into c from cajas where id = p_caja_id for update;
  if not found or c.estado <> 'recibida' then return; end if;
  update productos p set cantidad = greatest(0, p.cantidad - s.cant)
    from (select producto_id, sum(cantidad) as cant from caja_items
           where caja_id = p_caja_id and producto_id is not null group by producto_id) s
   where p.id = s.producto_id;
  update cajas set estado = 'pedida', recibida_at = null where id = p_caja_id;
  insert into bitacora (accion, detalle) values ('caja_recepcion_revertida', jsonb_build_object('caja', c.nombre));
end $$;

-- ---------------------------------------------------------------------
-- 4. NOTIFICACIONES, PUSH, ESCANEOS, CONFIG, BITÁCORA
-- ---------------------------------------------------------------------
create table if not exists notificaciones (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,            -- venta | stock_bajo | deuda_vencida
  titulo      text not null,
  mensaje     text,
  producto_id uuid references productos(id) on delete cascade,
  venta_id    uuid references ventas(id)    on delete cascade,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notif_fecha on notificaciones (created_at desc);

create table if not exists push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create table if not exists escaneos_qr (
  id              uuid primary key default gen_random_uuid(),
  producto_codigo text not null,
  dispositivo     text,
  created_at      timestamptz not null default now()
);

create table if not exists configuracion (
  clave text primary key,
  valor text
);
insert into configuracion (clave, valor) values
  ('nombre_negocio', 'Vedith Variedades'),
  ('whatsapp',       ''),
  ('url_base_qr',    '')
on conflict (clave) do nothing;

create table if not exists bitacora (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid(),
  accion     text not null,
  detalle    jsonb,
  created_at timestamptz not null default now()
);

-- Datos internos (URL y secreto de la función de push). Sin ninguna policy:
-- nadie puede leerlos desde la app, solo las funciones del servidor.
create table if not exists secretos (
  clave text primary key,
  valor text not null
);

-- Bitácora automática de cambios importantes en productos
create or replace function fn_bitacora_producto() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into bitacora (accion, detalle) values ('producto_eliminado', jsonb_build_object('codigo', old.codigo, 'nombre', old.nombre));
    return old;
  end if;
  if tg_op = 'UPDATE' and (
       new.precio is distinct from old.precio or new.costo is distinct from old.costo
    or new.cantidad is distinct from old.cantidad or new.activo is distinct from old.activo
    or new.codigo_tupperware is distinct from old.codigo_tupperware) then
    insert into bitacora (accion, detalle) values ('producto_editado', jsonb_build_object(
      'codigo', new.codigo, 'nombre', new.nombre,
      'precio', jsonb_build_array(old.precio, new.precio),
      'costo', jsonb_build_array(old.costo, new.costo),
      'cantidad', jsonb_build_array(old.cantidad, new.cantidad),
      'activo', jsonb_build_array(old.activo, new.activo)));
  end if;
  return new;
end $$;
drop trigger if exists trg_bitacora_producto on productos;
create trigger trg_bitacora_producto after update or delete on productos
  for each row execute function fn_bitacora_producto();

-- ---------------------------------------------------------------------
-- 5. VISTAS (lo único que ven visualizador y público)
-- ---------------------------------------------------------------------
-- Visualizador: productos activos, precio y existencia. SIN costo, SIN
-- código Tupperware, SIN stock mínimo. Devuelve vacío si no hay sesión válida.
create or replace view vista_catalogo as
select p.id, p.codigo, p.nombre, p.categoria_id, c.nombre as categoria,
       p.descripcion, p.precio, p.cantidad,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       p.precio_regateo
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo and es_usuario();

-- Cuentas para que el visualizador diga a dónde fue el dinero de su venta
create or replace view vista_cuentas as
select id, nombre, tipo, orden from cuentas where activa and es_usuario();

-- Público (QR sin clave): SIN costo, SIN código Tupperware, SIN cantidad exacta.
create or replace view vista_producto_publico as
select p.codigo, p.nombre, p.descripcion, c.nombre as categoria, p.precio,
       (p.cantidad > 0) as disponible,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo;

-- Datos de contacto que se muestran en la ficha pública
create or replace view vista_config_publica as
select clave, valor from configuracion where clave in ('nombre_negocio', 'whatsapp');

-- Categorías para el visualizador
create or replace view vista_categorias as
select id, nombre, orden from categorias where es_usuario();

-- ---------------------------------------------------------------------
-- 6. FUNCIONES (las únicas "puertas de escritura" del visualizador)
-- ---------------------------------------------------------------------
drop function if exists registrar_venta(uuid,int,text,text,text,text,date,numeric);
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
  p_cuenta_id        uuid    default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rol     text;
  v_prod    productos%rowtype;
  v_precio  numeric;
  v_quien   text;
  v_cliente uuid;
  v_nombre  text := nullif(trim(coalesce(p_cliente_nombre, '')), '');
  v_tel     text := nullif(trim(coalesce(p_cliente_telefono, '')), '');
  v_venta   ventas%rowtype;
  v_resto   int;
  v_cuenta  uuid;
begin
  select rol into v_rol from perfiles where id = auth.uid();
  if v_rol is null then raise exception 'NO_AUTORIZADO'; end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_forma_pago not in ('contado','fiado') then raise exception 'FORMA_PAGO_INVALIDA'; end if;
  if p_forma_pago = 'fiado' and v_nombre is null then raise exception 'CLIENTE_REQUERIDO'; end if;

  -- ¿A qué cuenta va el dinero? (solo si se cobra al contado)
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
  if v_prod.cantidad < p_cantidad then raise exception 'STOCK_INSUFICIENTE'; end if;

  -- Precio: el admin puede poner cualquiera. El visualizador vende al precio de lista,
  -- o al precio de "Descuento (Regateo)" que dejó definido la administración (ni un centavo menos).
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

  update productos set cantidad = cantidad - p_cantidad where id = v_prod.id;
  v_resto := v_prod.cantidad - p_cantidad;

  insert into ventas (producto_id, producto_codigo, producto_nombre, cantidad, precio_unitario,
                      costo_unitario, total, cliente_id, cliente_nombre, forma_pago, fecha_limite,
                      vendido_por, rol, user_id, precio_lista, metodo_cobro, cuenta_id)
  values (v_prod.id, v_prod.codigo, v_prod.nombre, p_cantidad, v_precio,
          v_prod.costo, round(v_precio * p_cantidad, 2), v_cliente, v_nombre, p_forma_pago,
          case when p_forma_pago = 'fiado' then p_fecha_limite else null end,
          v_quien, v_rol, auth.uid(), v_prod.precio,
          case when p_forma_pago = 'contado' then p_metodo else null end, v_cuenta)
  returning * into v_venta;

  -- TODA venta de un visualizador se reporta al administrador
  if v_rol = 'visualizador' then
    insert into notificaciones (tipo, titulo, mensaje, producto_id, venta_id)
    values ('venta', 'Venta de ' || v_quien,
            p_cantidad || ' × ' || v_prod.nombre || ' · Q' || to_char(v_venta.total, 'FM999999990.00')
              || case when p_forma_pago = 'fiado' then ' · FIADO a ' || v_nombre else ' · ' || p_metodo end
              || case when v_precio < v_prod.precio then ' · con descuento' else '' end,
            v_prod.id, v_venta.id);
  end if;

  if v_resto <= v_prod.stock_minimo then
    insert into notificaciones (tipo, titulo, mensaje, producto_id)
    values ('stock_bajo',
            case when v_resto = 0 then 'Se agotó: ' || v_prod.nombre else 'Queda poco: ' || v_prod.nombre end,
            'Quedan ' || v_resto || ' (' || v_prod.codigo
              || coalesce(' · Tupperware ' || v_prod.codigo_tupperware, '') || ').',
            v_prod.id);
  end if;

  -- Se devuelve un recibo SIN costo (el visualizador nunca debe verlo)
  return json_build_object(
    'id', v_venta.id, 'producto_codigo', v_venta.producto_codigo, 'producto_nombre', v_venta.producto_nombre,
    'cantidad', v_venta.cantidad, 'precio_unitario', v_venta.precio_unitario, 'total', v_venta.total,
    'cliente_nombre', v_venta.cliente_nombre, 'forma_pago', v_venta.forma_pago,
    'fecha_limite', v_venta.fecha_limite, 'vendido_por', v_venta.vendido_por, 'created_at', v_venta.created_at,
    'metodo_cobro', v_venta.metodo_cobro);
end $$;

-- Lo que vendió esta persona (para que el visualizador vea su propio recibo)
create or replace function mis_ventas(p_limite int default 40)
returns table (id uuid, producto_codigo text, producto_nombre text, cantidad int, precio_unitario numeric,
               total numeric, cliente_nombre text, forma_pago text, fecha_limite date, vendido_por text,
               anulada boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.id, v.producto_codigo, v.producto_nombre, v.cantidad, v.precio_unitario, v.total,
         v.cliente_nombre, v.forma_pago, v.fecha_limite, v.vendido_por, v.anulada, v.created_at
  from ventas v
  where v.user_id = auth.uid() and es_usuario()
  order by v.created_at desc
  limit least(coalesce(p_limite, 40), 200);
$$;

create or replace function anular_venta(p_venta_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v ventas%rowtype;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into v from ventas where id = p_venta_id for update;
  if not found then raise exception 'VENTA_NO_ENCONTRADA'; end if;
  if v.anulada then return; end if;
  if v.producto_id is not null then
    update productos set cantidad = cantidad + v.cantidad where id = v.producto_id;
  end if;
  update ventas set anulada = true, anulada_at = now() where id = v.id;
  insert into bitacora (accion, detalle) values ('venta_anulada',
    jsonb_build_object('venta', v.id, 'producto', v.producto_nombre, 'cantidad', v.cantidad, 'total', v.total));
end $$;

drop function if exists registrar_abono(uuid,numeric,text);
create or replace function registrar_abono(p_venta_id uuid, p_monto numeric, p_nota text default null,
                                           p_metodo text default 'efectivo', p_cuenta_id uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare v ventas%rowtype; v_pagado numeric; v_abono abonos%rowtype; v_cuenta uuid;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into v from ventas where id = p_venta_id for update;
  if not found or v.anulada or v.forma_pago <> 'fiado' then raise exception 'VENTA_NO_VALIDA'; end if;
  select coalesce(sum(monto), 0) into v_pagado from abonos where venta_id = v.id;
  if p_monto is null or p_monto <= 0 or p_monto > (v.total - v_pagado) then raise exception 'MONTO_INVALIDO'; end if;
  if p_metodo not in ('efectivo','transferencia','deposito') then raise exception 'METODO_INVALIDO'; end if;
  v_cuenta := p_cuenta_id;
  if v_cuenta is null then
    if p_metodo = 'efectivo' then select id into v_cuenta from cuentas where tipo = 'efectivo' and activa order by orden limit 1;
    else raise exception 'CUENTA_REQUERIDA'; end if;
  end if;
  insert into abonos (venta_id, monto, nota, metodo_cobro, cuenta_id)
  values (v.id, p_monto, nullif(trim(coalesce(p_nota, '')), ''), p_metodo, v_cuenta)
  returning * into v_abono;
  return row_to_json(v_abono);
end $$;

-- Aviso diario (8:00 am Guatemala) de deudas vencidas con saldo pendiente
create or replace function fn_avisar_deudas_vencidas() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notificaciones (tipo, titulo, mensaje, venta_id)
  select 'deuda_vencida',
         'Deuda vencida: ' || coalesce(v.cliente_nombre, 'cliente'),
         'Debe Q' || to_char(v.total - coalesce((select sum(a.monto) from abonos a where a.venta_id = v.id), 0), 'FM999999990.00')
           || ' por ' || v.producto_nombre || ' (venció ' || to_char(v.fecha_limite, 'DD/MM') || ').',
         v.id
  from ventas v
  where v.forma_pago = 'fiado' and not v.anulada and v.fecha_limite is not null and v.fecha_limite < current_date
    and v.total - coalesce((select sum(a.monto) from abonos a where a.venta_id = v.id), 0) > 0
    and not exists (select 1 from notificaciones n
                    where n.venta_id = v.id and n.tipo = 'deuda_vencida' and n.created_at > now() - interval '7 days');
end $$;

do $$ begin
  perform cron.unschedule('vedith-deudas-vencidas');
exception when others then null; end $$;
select cron.schedule('vedith-deudas-vencidas', '0 14 * * *', $$select fn_avisar_deudas_vencidas();$$);

-- ---------------------------------------------------------------------
-- 7. PUSH: cada notificación nueva dispara la Edge Function "enviar-push"
--    (llega al teléfono del admin aunque tenga el panel cerrado).
--    Necesita las filas push_url y push_secret en "secretos" — ver push_setup.sql
-- ---------------------------------------------------------------------
create or replace function fn_push_notificacion() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select valor into v_url    from secretos where clave = 'push_url';
  select valor into v_secret from secretos where clave = 'push_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('id', new.id, 'tipo', new.tipo, 'titulo', new.titulo, 'mensaje', new.mensaje)
  );
  return new;
exception when others then
  return new;   -- una falla de push jamás debe frenar una venta
end $$;
drop trigger if exists trg_push_notificacion on notificaciones;
create trigger trg_push_notificacion after insert on notificaciones
  for each row execute function fn_push_notificacion();

-- ---------------------------------------------------------------------
-- 8. SEGURIDAD (RLS): todo cerrado salvo lo que se abre aquí
-- ---------------------------------------------------------------------
alter table perfiles           enable row level security;
alter table categorias         enable row level security;
alter table productos          enable row level security;
alter table fotos_producto     enable row level security;
alter table clientes           enable row level security;
alter table ventas             enable row level security;
alter table abonos             enable row level security;
alter table gastos             enable row level security;
alter table cuentas            enable row level security;
alter table cajas              enable row level security;
alter table caja_items         enable row level security;
alter table movimientos_caja   enable row level security;
alter table notificaciones     enable row level security;
alter table push_suscripciones enable row level security;
alter table escaneos_qr        enable row level security;
alter table configuracion      enable row level security;
alter table bitacora           enable row level security;
alter table secretos           enable row level security;

do $$
declare t text;
begin
  -- Solo admin: acceso total a estas tablas
  foreach t in array array['categorias','productos','fotos_producto','clientes','ventas',
                           'abonos','gastos','notificaciones','configuracion','bitacora',
                           'cuentas','cajas','caja_items','movimientos_caja'] loop
    execute format('drop policy if exists "admin_todo" on %I', t);
    execute format('create policy "admin_todo" on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

drop policy if exists "perfil_propio" on perfiles;
create policy "perfil_propio" on perfiles for select to authenticated
  using (id = auth.uid() or es_admin());

drop policy if exists "push_propias" on push_suscripciones;
create policy "push_propias" on push_suscripciones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "escaneo_insert" on escaneos_qr;
create policy "escaneo_insert" on escaneos_qr for insert to anon, authenticated with check (true);
drop policy if exists "escaneo_admin" on escaneos_qr;
create policy "escaneo_admin" on escaneos_qr for select to authenticated using (es_admin());

-- Permisos: anon (sin sesión) solo puede leer las vistas públicas y registrar un escaneo
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all functions in schema public from public;
-- Permisos de acceso para las cuentas con sesión (authenticated). Las reglas RLS de arriba
-- deciden QUÉ filas ve cada quien; esto solo abre la puerta a la tabla. Supabase ya no da
-- estos permisos solos en proyectos nuevos. Se dan tabla por tabla (nunca a las vistas, porque
-- una vista simple permitiría escribir saltándose las reglas).
grant select on perfiles to authenticated;
grant select, insert, update, delete on
  categorias, productos, fotos_producto, clientes, ventas, abonos, gastos, cuentas, cajas,
  caja_items, movimientos_caja, notificaciones, push_suscripciones, configuracion, bitacora
  to authenticated;
grant select on escaneos_qr to authenticated;
grant usage, select on sequence productos_codigo_seq to authenticated;
grant select on vista_producto_publico, vista_config_publica to anon, authenticated;
grant select on vista_catalogo, vista_categorias, vista_cuentas to authenticated;
grant insert on escaneos_qr to anon, authenticated;
grant execute on function registrar_venta(uuid,int,text,text,text,text,date,numeric,text,uuid) to authenticated;
grant execute on function mis_ventas(int)          to authenticated;
grant execute on function anular_venta(uuid)       to authenticated;
grant execute on function registrar_abono(uuid,numeric,text,text,uuid) to authenticated;
grant execute on function recibir_caja(uuid), revertir_recepcion_caja(uuid) to authenticated;
grant execute on function es_admin(), es_usuario() to authenticated, anon;

-- ---------------------------------------------------------------------
-- 9. CATEGORÍAS INICIALES
-- ---------------------------------------------------------------------
insert into categorias (nombre, orden) values
  ('Recipientes y contenedores', 1),
  ('Botellas y jarras',          2),
  ('Cocina y utensilios',        3),
  ('Repostería',                 4),
  ('Niños',                      5),
  ('Otros',                      9)
on conflict (nombre) do nothing;

-- =====================================================================
-- LISTO. Siguiente paso: crear los 2 usuarios (ver SUPABASE_SETUP.md) y
-- correr roles.sql para asignarles su rol.
-- =====================================================================
