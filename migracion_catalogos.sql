-- =====================================================================
-- CATÁLOGOS (librito digital) · corre esto UNA vez en el SQL Editor.
-- Es seguro correrlo más de una vez.
--
--  catalogos            → los libritos vigentes (cada página es una imagen en Storage)
--  catalogo_paginas     → una fila por página (y la ruta del archivo, para poder borrarlo)
--  catalogos_archivados → solo el registro: nombre y número de páginas. Sin imágenes.
--
-- Al "Archivar y borrar" se borran las imágenes de Storage y las filas de las páginas;
-- queda una línea en catalogos_archivados. El inventario y las fotos de los productos
-- (que son enlaces) no se tocan.
-- =====================================================================
create table if not exists catalogos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descripcion text,
  paginas     int  not null default 0,
  publicado   boolean not null default false,   -- ¿se puede ver con el enlace?
  vigente     boolean not null default false,   -- el catálogo "actual" (enlace ?c=vigente)
  portada_url text,
  created_at  timestamptz not null default now()
);
-- Solo uno puede ser el vigente
create unique index if not exists uq_catalogo_vigente on catalogos ((true)) where vigente;

create table if not exists catalogo_paginas (
  id          uuid primary key default gen_random_uuid(),
  catalogo_id uuid not null references catalogos(id) on delete cascade,
  numero      int  not null,
  url_imagen  text not null check (url_imagen ~* '^https?://'),
  ruta        text not null,                    -- ruta dentro del bucket (para borrarla después)
  ancho       int,
  alto        int,
  unique (catalogo_id, numero)
);

create table if not exists catalogos_archivados (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  paginas      int  not null,
  creado_el    date,
  archivado_el timestamptz not null default now()
);

alter table catalogos            enable row level security;
alter table catalogo_paginas     enable row level security;
alter table catalogos_archivados enable row level security;

do $$
declare t text;
begin
  foreach t in array array['catalogos','catalogo_paginas','catalogos_archivados'] loop
    execute format('drop policy if exists "admin_todo" on %I', t);
    execute format('create policy "admin_todo" on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

grant select, insert, update, delete on catalogos, catalogo_paginas, catalogos_archivados to authenticated;
grant all on catalogos, catalogo_paginas, catalogos_archivados to service_role;

-- Lo que ve cualquiera con el enlace (sin PIN): solo catálogos publicados
create or replace view vista_catalogo_publico as
select id, titulo, descripcion, paginas, vigente from catalogos where publicado;

create or replace view vista_catalogo_paginas_pub as
select p.catalogo_id, p.numero, p.url_imagen, p.ancho, p.alto
from catalogo_paginas p join catalogos c on c.id = p.catalogo_id
where c.publicado;

grant select on vista_catalogo_publico, vista_catalogo_paginas_pub to anon, authenticated;

-- Marcar un catálogo como el vigente (quita la marca al anterior)
create or replace function marcar_catalogo_vigente(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  update catalogos set vigente = false where vigente and id <> p_id;
  update catalogos set vigente = true where id = p_id;
end $$;

-- Archivar: deja solo el registro (nombre y número de páginas) y borra el catálogo.
-- OJO: las imágenes de Storage las borra la app ANTES de llamar a esta función.
create or replace function archivar_catalogo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c catalogos%rowtype;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select * into c from catalogos where id = p_id for update;
  if not found then raise exception 'CATALOGO_NO_ENCONTRADO'; end if;
  insert into catalogos_archivados (titulo, paginas, creado_el) values (c.titulo, c.paginas, c.created_at::date);
  delete from catalogos where id = p_id;
end $$;

revoke all on function marcar_catalogo_vigente(uuid), archivar_catalogo(uuid) from public, anon;
grant execute on function marcar_catalogo_vigente(uuid), archivar_catalogo(uuid) to authenticated;

-- Almacenamiento: carpeta pública de lectura; solo la administración puede subir y borrar
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogos', 'catalogos', true, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "catalogos_admin_select" on storage.objects;
drop policy if exists "catalogos_admin_insert" on storage.objects;
drop policy if exists "catalogos_admin_update" on storage.objects;
drop policy if exists "catalogos_admin_delete" on storage.objects;
create policy "catalogos_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'catalogos' and es_admin());
create policy "catalogos_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalogos' and es_admin());
create policy "catalogos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'catalogos' and es_admin()) with check (bucket_id = 'catalogos' and es_admin());
create policy "catalogos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'catalogos' and es_admin());
