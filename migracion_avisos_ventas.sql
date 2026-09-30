-- =====================================================================
-- AVISOS DE VENTAS · corre esto UNA vez en el SQL Editor.
-- Antes solo avisaba cuando vendía el visualizador; ahora avisa TODA venta.
-- (Reemplaza la función; no toca datos ni permisos.)
-- =====================================================================
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

  -- TODA venta se reporta al administrador (la haga quien la haga): aviso en el panel y en el teléfono
  insert into notificaciones (tipo, titulo, mensaje, producto_id, venta_id)
  values ('venta', 'Venta de ' || v_quien,
          p_cantidad || ' × ' || v_prod.nombre || ' · Q' || to_char(v_venta.total, 'FM999999990.00')
            || case when p_forma_pago = 'fiado' then ' · FIADO a ' || v_nombre else ' · ' || p_metodo end
            || case when v_precio < v_prod.precio then ' · con descuento' else '' end,
          v_prod.id, v_venta.id);

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
