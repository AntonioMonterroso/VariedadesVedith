-- =====================================================================
-- NOTIFICACIONES PUSH · correr UNA vez, después de desplegar la función
-- "enviar-push" (ver SUPABASE_SETUP.md, paso 6).
--
-- La función de avisos quedó con el nombre «hyper-responder» (así la nombró el panel de Supabase).
-- Cambia <TU_SECRETO> por el mismo valor que pusiste en el secret PUSH_SECRET
-- de la función. NO guardes el secreto en este archivo: pega el SQL directo en el
-- SQL Editor, con el secreto puesto solo ahí, y no lo subas a GitHub.
-- =====================================================================
insert into secretos (clave, valor) values
  ('push_url',    'https://blrmfbvqxndhxglvqfku.supabase.co/functions/v1/hyper-responder'),
  ('push_secret', '<TU_SECRETO>')
on conflict (clave) do update set valor = excluded.valor;
