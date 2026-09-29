// Configuración pública del panel. Aquí NO va ningún secreto:
// la "anon key" es pública por diseño; lo protegido lo cuidan las reglas (RLS) de la base.
window.VEDITH_CONFIG = {
  SUPABASE_URL: 'https://blrmfbvqxndhxglvqfku.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscm1mYnZxeG5kaHhnbHZxZmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MDAxNTcsImV4cCI6MjEwNjI3NjE1N30.gN4pZtVnat_Me64T1mAFgz9CJV8N33M82gA0bFg8row',

  // Cuentas fijas de Supabase Auth. El PIN de 6 dígitos es su contraseña.
  ADMIN_EMAIL: 'admin@vedith.example.com',
  VISOR_EMAIL: 'visor@vedith.example.com',

  // Llave PÚBLICA de notificaciones push (VAPID). Vacía = push desactivado.
  // Se genera con: node generar-vapid.mjs
  VAPID_PUBLIC_KEY: 'BP9_fBM3fJOViZbH_ZHgr1lhiKsuwP6iFngqL8s026R_cdt0O4eh9tEONMtzPZ8IL1fq7sMakuy3w6VoQP-tvjo',

  NEGOCIO: 'Vedith Variedades'
};
