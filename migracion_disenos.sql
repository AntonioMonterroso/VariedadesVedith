-- =====================================================================
-- DISEÑOS Y COLORES JUNTOS + BORRADO MÁS SEGURO
-- Corre esto UNA vez en el SQL Editor, DESPUÉS de migracion_colores.sql y migracion_campanas.sql.
-- Es seguro correrlo más de una vez.
--
-- Una variante de un producto puede ser un color ("Rosa"), un diseño ("Capibara") o los dos juntos
-- ("Capibara · Rosa"). Cada variante lleva su propia existencia. Sigue usando producto_colores:
--   color  → el nombre completo de la variante (lo que se elige al vender)
--   diseno → la parte de diseño (opcional)
--   tono   → la parte de color (opcional)
-- Las variantes que ya existían quedan como color (tono = color).
-- =====================================================================
alter table producto_colores add column if not exists diseno text;
alter table producto_colores add column if not exists tono   text;
update producto_colores set tono = color where tono is null and diseno is null;

create or replace view vista_catalogo as
select p.id, p.codigo, p.nombre, p.categoria_id, c.nombre as categoria,
       p.descripcion, p.precio, p.cantidad,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       p.precio_regateo,
       p.usa_colores,
       (not p.avisar_stock) as sin_control,
       coalesce((select json_agg(json_build_object('id', k.id, 'color', k.color, 'hex', k.hex, 'cantidad', k.cantidad, 'diseno', k.diseno, 'tono', k.tono) order by k.orden, k.color)
                   from producto_colores k where k.producto_id = p.id), '[]'::json) as colores
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo and es_usuario();

create or replace view vista_producto_publico as
select p.codigo, p.nombre, p.descripcion, c.nombre as categoria, p.precio,
       (p.cantidad > 0 or not p.avisar_stock) as disponible,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       coalesce((select json_agg(json_build_object('color', k.color, 'hex', k.hex, 'disponible', (k.cantidad > 0 or not p.avisar_stock), 'diseno', k.diseno, 'tono', k.tono) order by k.orden, k.color)
                   from producto_colores k where k.producto_id = p.id and p.usa_colores), '[]'::json) as colores
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo;

-- Ingreso rápido: al crear una variante nueva guarda también su diseño y su color
create or replace function ingreso_rapido(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; v_uc boolean; v_n int; v_col text; v_total int := 0; v_pid uuid; v_d text; v_t text;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_pid := (it->>'producto_id')::uuid;
    v_n   := coalesce((it->>'cantidad')::int, 0);
    v_col := nullif(trim(coalesce(it->>'color', '')), '');
    v_d   := nullif(trim(coalesce(it->>'diseno', '')), '');
    v_t   := nullif(trim(coalesce(it->>'tono', '')), '');
    if v_n < 1 then continue; end if;
    select usa_colores into v_uc from productos where id = v_pid for update;
    if not found then raise exception 'PRODUCTO_NO_ENCONTRADO'; end if;
    if v_uc then
      insert into producto_colores (producto_id, color, hex, cantidad, diseno, tono)
      values (v_pid, coalesce(v_col, 'Sin especificar'),
              case when (it->>'hex') ~* '^#[0-9a-f]{6}$' then it->>'hex' end, v_n, v_d,
              case when v_d is null and v_t is null then coalesce(v_col, 'Sin especificar') else v_t end)
      on conflict (producto_id, color) do update
        set cantidad = producto_colores.cantidad + excluded.cantidad, hex = coalesce(producto_colores.hex, excluded.hex);
    else
      update productos set cantidad = cantidad + v_n where id = v_pid;
    end if;
    v_total := v_total + v_n;
  end loop;
  if v_total > 0 then insert into bitacora (accion, detalle) values ('ingreso_rapido', jsonb_build_object('piezas', v_total)); end if;
  return v_total;
end $$;

-- Limpieza más prudente: lo archivado que todavía tenía piezas espera el DOBLE de plazo antes de borrarse
create or replace function fn_depurar(p_dias int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d int; a int; n int; e int; b int;
begin
  if auth.uid() is not null and not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  d := coalesce(p_dias, nullif((select valor from configuracion where clave = 'dias_borrar_archivados'), '')::int, 30);
  delete from productos
   where archivado and archivado_at <= now() - make_interval(days => d)
     and (cantidad = 0 or archivado_at <= now() - make_interval(days => d * 2));
  get diagnostics a = row_count;
  delete from notificaciones where leida and created_at < now() - interval '60 days';
  get diagnostics n = row_count;
  delete from escaneos_qr where created_at < now() - interval '90 days';
  get diagnostics e = row_count;
  delete from bitacora where created_at < now() - interval '180 days';
  get diagnostics b = row_count;
  return jsonb_build_object('productos', a, 'avisos', n, 'escaneos', e, 'bitacora', b);
end $$;
