/* Service worker: funciona sin conexión para lo básico y recibe avisos push.
   Todas las rutas son relativas porque GitHub Pages sirve bajo /<repo>/. */
const CACHE = 'vedith-v7';
const SHELL = ['./', 'index.html', 'config.js', 'css/styles.css', 'js/util.js', 'js/api-supabase.js', 'js/app-core.js',
  'js/app-pages1.js', 'js/app-pages2.js', 'js/app-pages3.js', 'js/app-estados.js', 'js/app-librito.js', 'js/app-catalogos.js', 'js/app-ocr.js', 'js/app-importador.js', 'js/app-boot.js', 'assets/logo-pequeno.png', 'assets/logo-completo.jpg', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (siempre lo más nuevo); si no hay internet, lo guardado. Nunca se guardan datos de Supabase.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))));
});

self.addEventListener('push', (e) => {
  let d = { title: 'Vedith Variedades', body: '', url: './#/notificaciones' };
  try { d = { ...d, ...e.data.json() }; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag, data: { url: d.url }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => x.url.startsWith(self.registration.scope));
    if (w) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
