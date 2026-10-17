-- =====================================================================
-- FOTO POR DISEÑO
-- Corre esto UNA vez en el SQL Editor, DESPUÉS de migracion_disenos.sql.
-- Es seguro correrlo más de una vez.
--
-- Cada diseño de un producto puede tener su propia foto (un link de internet, como el resto de las
-- fotos). Se guarda en producto_colores.foto_url, repetida en todas las opciones de ese diseño.
-- El visualizador y el QR público ven la foto de cada opción.
-- =====================================================================
alter table producto_colores add column if not exists foto_url text;
do $$ begin
  alter table producto_colores add constraint producto_colores_foto_chk check (foto_url is null or foto_url ~* '^https?://');
exception when duplicate_object then null; end $$;

create or replace view vista_catalogo as
select p.id, p.codigo, p.nombre, p.categoria_id, c.nombre as categoria,
       p.descripcion, p.precio, p.cantidad,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       p.precio_regateo,
       p.usa_colores,
       (not p.avisar_stock) as sin_control,
       coalesce((select json_agg(json_build_object('id', k.id, 'color', k.color, 'hex', k.hex, 'cantidad', k.cantidad, 'diseno', k.diseno, 'tono', k.tono, 'hexes', k.hexes, 'foto', k.foto_url) order by k.orden, k.color)
                   from producto_colores k where k.producto_id = p.id), '[]'::json) as colores
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo and es_usuario();

create or replace view vista_producto_publico as
select p.codigo, p.nombre, p.descripcion, c.nombre as categoria, p.precio,
       (p.cantidad > 0 or not p.avisar_stock) as disponible,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       coalesce((select json_agg(json_build_object('color', k.color, 'hex', k.hex, 'disponible', (k.cantidad > 0 or not p.avisar_stock), 'diseno', k.diseno, 'tono', k.tono, 'hexes', k.hexes, 'foto', k.foto_url) order by k.orden, k.color)
                   from producto_colores k where k.producto_id = p.id and p.usa_colores), '[]'::json) as colores
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo;

-- Ingreso rápido: una opción nueva de un diseño que ya tiene foto hereda esa foto
create or replace function ingreso_rapido(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; v_uc boolean; v_n int; v_col text; v_total int := 0; v_pid uuid; v_d text; v_t text; v_hx text;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_pid := (it->>'producto_id')::uuid;
    v_n   := coalesce((it->>'cantidad')::int, 0);
    v_col := nullif(trim(coalesce(it->>'color', '')), '');
    v_d   := nullif(trim(coalesce(it->>'diseno', '')), '');
    v_t   := nullif(trim(coalesce(it->>'tono', '')), '');
    v_hx  := nullif(trim(coalesce(it->>'hexes', '')), '');
    if v_n < 1 then continue; end if;
    select usa_colores into v_uc from productos where id = v_pid for update;
    if not found then raise exception 'PRODUCTO_NO_ENCONTRADO'; end if;
    if v_uc then
      insert into producto_colores (producto_id, color, hex, cantidad, diseno, tono, hexes, foto_url)
      values (v_pid, coalesce(v_col, 'Sin especificar'),
              case when (it->>'hex') ~* '^#[0-9a-f]{6}$' then it->>'hex' end, v_n, v_d,
              case when v_d is null and v_t is null then coalesce(v_col, 'Sin especificar') else v_t end, v_hx,
              case when v_d is not null then (select k.foto_url from producto_colores k where k.producto_id = v_pid and k.diseno = v_d and k.foto_url is not null limit 1) end)
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
