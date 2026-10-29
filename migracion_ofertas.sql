-- Ofertas y novedades en el catálogo propio.
-- Pegar completo en Supabase → SQL Editor → Run (después de migracion_fotos_disenos.sql). Se puede correr otra vez.

-- Precio anterior: si es mayor que el precio actual, el catálogo lo muestra tachado con la etiqueta «Oferta».
alter table productos add column if not exists precio_anterior numeric(12,2);

-- La ficha pública y el catálogo reciben también el precio anterior, la fecha de alta y la tanda.
-- (Las columnas nuevas van al final para no mover las que ya existen.)
create or replace view vista_producto_publico as
select p.codigo, p.nombre, p.descripcion, c.nombre as categoria, p.precio,
       (p.cantidad > 0 or not p.avisar_stock) as disponible,
       coalesce((select json_agg(f.url_foto order by f.orden)
                   from fotos_producto f where f.producto_id = p.id), '[]'::json) as fotos,
       coalesce((select json_agg(json_build_object('color', k.color, 'hex', k.hex, 'disponible', (k.cantidad > 0 or not p.avisar_stock), 'diseno', k.diseno, 'tono', k.tono, 'hexes', k.hexes, 'foto', k.foto_url) order by k.orden, k.color)
                   from producto_colores k where k.producto_id = p.id and p.usa_colores), '[]'::json) as colores,
       p.precio_anterior, p.created_at as creado
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo;

grant select on vista_producto_publico to anon, authenticated;
