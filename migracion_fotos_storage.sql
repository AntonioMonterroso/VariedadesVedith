-- Fotos subidas desde el panel (con compresión en el navegador) + medidor de espacio.
-- Pegar completo en Supabase → SQL Editor → Run. Se puede correr otra vez sin problema.

-- 1. Carpeta de fotos: pública para leer (las fichas y el QR las muestran), solo la administración sube y borra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "fotos_admin_insert" on storage.objects;
drop policy if exists "fotos_admin_update" on storage.objects;
drop policy if exists "fotos_admin_delete" on storage.objects;
drop policy if exists "fotos_admin_select" on storage.objects;
create policy "fotos_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and es_admin());
create policy "fotos_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and es_admin());
create policy "fotos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and es_admin()) with check (bucket_id = 'fotos' and es_admin());
create policy "fotos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and es_admin());

-- 2. Espacio usado (en bytes), solo para la administración.
create or replace function public.uso_almacenamiento()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare f bigint; c bigint;
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  select coalesce(sum((metadata->>'size')::bigint), 0) into f from storage.objects where bucket_id = 'fotos';
  select coalesce(sum((metadata->>'size')::bigint), 0) into c from storage.objects where bucket_id = 'catalogos';
  return jsonb_build_object('fotos', f, 'catalogos', c, 'total', f + c);
end $$;
revoke all on function public.uso_almacenamiento() from public, anon;
grant execute on function public.uso_almacenamiento() to authenticated;

-- 3. Espacio total disponible que se muestra en la barra (MB). El plan gratis de Supabase da 1 GB (1024).
insert into configuracion (clave, valor) values ('espacio_total_mb', '1024') on conflict (clave) do nothing;
