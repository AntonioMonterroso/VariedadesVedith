-- =====================================================================
-- NOTIFICACIONES PUSH · correr UNA vez, después de desplegar la función
-- "enviar-push" (ver SUPABASE_SETUP.md, paso 6).
--
-- Cambia <TU_SECRETO> por el mismo valor que pusiste en el secret PUSH_SECRET
-- de la función. NO subas este archivo a GitHub con el secreto escrito.
-- =====================================================================
insert into secretos (clave, valor) values
  ('push_url',    'https://blrmfbvqxndhxglvqfku.supabase.co/functions/v1/enviar-push'),
  ('push_secret', '<TU_SECRETO>')
on conflict (clave) do update set valor = excluded.valor;
