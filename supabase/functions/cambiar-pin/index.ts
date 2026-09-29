// Edge Function: cambiar-pin
// Deja que el ADMINISTRADOR cambie el PIN (de 6 dígitos) del administrador o del
// visualizador desde el panel (Ajustes → Cambiar PIN). Solo se puede llamar con
// la sesión de un administrador.
//
// Despliegue:  supabase functions deploy cambiar-pin
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'METODO' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. ¿Quién llama? Debe ser un administrador
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const admin = createClient(url, service);
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: 'NO_AUTORIZADO' }, 401);
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).maybeSingle();
  if (perfil?.rol !== 'administrador') return json({ error: 'NO_AUTORIZADO' }, 403);

  // 2. Validar datos
  const { rol, pin } = await req.json().catch(() => ({}));
  if (!['administrador', 'visualizador'].includes(rol)) return json({ error: 'ROL_INVALIDO' }, 400);
  if (!/^\d{6}$/.test(pin ?? '')) return json({ error: 'PIN_INVALIDO' }, 400);

  // 3. Buscar la cuenta del rol pedido y la del otro rol
  const { data: perfiles } = await admin.from('perfiles').select('id, rol');
  const objetivo = perfiles?.find((p) => p.rol === rol);
  const otro = perfiles?.find((p) => p.rol !== rol);
  if (!objetivo) return json({ error: 'CUENTA_NO_ENCONTRADA' }, 404);

  // 4. Los dos PIN deben ser distintos (si no, el login no sabría quién eres)
  if (otro) {
    const { data: u } = await admin.auth.admin.getUserById(otro.id);
    if (u?.user?.email) {
      const probe = createClient(url, anon, { auth: { persistSession: false } });
      const { data: r } = await probe.auth.signInWithPassword({ email: u.user.email, password: pin });
      if (r?.session) return json({ error: 'PIN_REPETIDO' }, 409);
    }
  }

  const { error } = await admin.auth.admin.updateUserById(objetivo.id, { password: pin });
  if (error) return json({ error: 'NO_SE_PUDO_CAMBIAR' }, 500);
  return json({ ok: true });
});
