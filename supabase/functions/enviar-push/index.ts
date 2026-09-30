// Edge Function: enviar-push
// La llama la base de datos (trigger + pg_net) cada vez que nace una notificación
// y manda una notificación push a los teléfonos del ADMINISTRADOR, aunque tenga
// el panel cerrado.
//
// Despliegue (ver SUPABASE_SETUP.md, paso 6):
//   supabase functions deploy enviar-push --no-verify-jwt
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... PUSH_SECRET=... VAPID_SUBJECT=mailto:tu@correo.com
//
// La protege el header x-push-secret (no es pública en la práctica).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SECRET = Deno.env.get('PUSH_SECRET') ?? '';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  if (!SECRET || req.headers.get('x-push-secret') !== SECRET) return new Response('No autorizado', { status: 401 });

  const n = await req.json().catch(() => null);
  if (!n?.titulo) return new Response('Datos inválidos', { status: 400 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Solo las suscripciones de usuarios con rol administrador
  const { data: admins } = await sb.from('perfiles').select('id').eq('rol', 'administrador');
  const ids = (admins ?? []).map((a) => a.id);
  if (!ids.length) return new Response(JSON.stringify({ enviados: 0, suscripciones: 0, motivo: 'no hay usuarios administrador en perfiles' }), { status: 200 });

  const { data: subs } = await sb.from('push_suscripciones').select('*').in('user_id', ids);
  const payload = JSON.stringify({
    title: n.titulo,
    body: n.mensaje ?? '',
    tag: `${n.tipo}-${n.id}`,
    url: n.tipo === 'venta' ? './#/ventas' : n.tipo === 'stock_bajo' ? './#/productos?f=stock' : './#/notificaciones',
  });

  let enviados = 0;
  const fallos: { codigo?: number; detalle?: string }[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      enviados++;
    } catch (e) {
      // 404/410 = el teléfono ya no está suscrito: se limpia
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from('push_suscripciones').delete().eq('id', s.id);
      else { console.error('push falló', e?.statusCode, e?.body); fallos.push({ codigo: e?.statusCode, detalle: String(e?.body ?? e?.message ?? '').slice(0, 120) }); }
    }
  }));

  // El resultado explica por qué no llegó un aviso (útil para diagnosticar)
  return new Response(JSON.stringify({ enviados, suscripciones: (subs ?? []).length, fallos }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
