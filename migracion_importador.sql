-- =====================================================================
-- IMPORTADOR DE PRODUCTOS DESDE EL CATÁLOGO · corre esto UNA vez en el SQL Editor.
-- Es seguro correrlo más de una vez.
--
--  productos.precio_catalogo → el precio que trae el catálogo (SOLO de referencia, solo admin)
--  catalogo_productos        → en qué página y en qué rectángulo del catálogo está cada producto
--                              importado (para mostrar su recorte como referencia). Se borra
--                              junto con el catálogo; el producto y su inventario se quedan.
-- =====================================================================
alter table productos add column if not exists precio_catalogo numeric(12,2);

create table if not exists catalogo_productos (
  id          uuid primary key default gen_random_uuid(),
  catalogo_id uuid not null references catalogos(id)  on delete cascade,
  producto_id uuid not null references productos(id)  on delete cascade,
  pagina      int  not null,                    -- número de página dentro del librito
  x numeric not null, y numeric not null,       -- rectángulo en proporciones de 0 a 1
  w numeric not null, h numeric not null,
  created_at  timestamptz not null default now(),
  unique (catalogo_id, producto_id)
);
create index if not exists idx_catprod_producto on catalogo_productos (producto_id);

alter table catalogo_productos enable row level security;
drop policy if exists "admin_todo" on catalogo_productos;
create policy "admin_todo" on catalogo_productos for all to authenticated using (es_admin()) with check (es_admin());
grant select, insert, update, delete on catalogo_productos to authenticated;
grant all on catalogo_productos to service_role;
