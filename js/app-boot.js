/* Arranque: pantalla de PIN, ficha pública (QR), service worker y refresco periódico. */
(function () {
  'use strict';
  const { icon, esc, money, toast } = U;
  const APP = window.APP;
  const C = window.VEDITH_CONFIG;
  const root = () => document.getElementById('root');

  /* =====================================================================
     PANTALLA DE PIN (6 dígitos)
     ===================================================================== */
  function renderLogin() {
    const demo = API.mode === 'demo';
    root().innerHTML = `
      <main class="login">
        <div class="login-card">
          <img class="logo" src="assets/logo-completo.jpg" alt="Vedith Variedades · Distribuidor independiente de Tupperware" width="240" height="240">
          <h1>Escribe tu PIN</h1>
          <div class="pin-dots" id="dots" role="img" aria-label="PIN de 6 números"><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="login-msg" id="msg" role="alert" aria-live="assertive"></div>
          <div class="keypad" id="pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}" aria-label="${n}">${n}</button>`).join('')}
            <button type="button" class="blank" tabindex="-1" aria-hidden="true"></button>
            <button type="button" data-k="0" aria-label="0">0</button>
            <button type="button" class="aux" data-k="del" aria-label="Borrar">${icon('backspace', 'lg')}</button>
          </div>
          ${demo ? '<p class="small muted center">Modo demostración · PIN administración <b>111111</b> · PIN visualizador <b>222222</b></p>' : ''}
          <p class="xs faint center">Distribuidor independiente de Tupperware</p>
        </div>
      </main>`;
    let pin = '', busy = false;
    const dots = document.getElementById('dots'), msg = document.getElementById('msg');
    const paint = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < pin.length));

    const bloqueo = () => Math.max(0, (U.lsGet('vedith-bloqueo', 0) || 0) - Date.now());
    const fallos = () => U.lsGet('vedith-fallos', 0) || 0;

    async function intentar() {
      if (busy) return;
      const espera = bloqueo();
      if (espera > 0) { msg.textContent = `Demasiados intentos. Espera ${Math.ceil(espera / 1000)} segundos.`; pin = ''; paint(); return; }
      busy = true; msg.textContent = '';
      try {
        APP.user = await API.login(pin);
        U.lsSet('vedith-fallos', 0);
        await startApp();
      } catch (e) {
        pin = ''; paint(); busy = false;
        const code = e.message || '';
        if (code === 'PIN_INCORRECTO') {
          const n = fallos() + 1; U.lsSet('vedith-fallos', n);
          if (n >= 5) { U.lsSet('vedith-bloqueo', Date.now() + 30000); U.lsSet('vedith-fallos', 0); msg.textContent = 'Demasiados intentos. Espera 30 segundos.'; }
          else msg.textContent = 'PIN incorrecto. Intenta otra vez.';
          dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake', 'bad');
          setTimeout(() => dots.classList.remove('bad'), 700);
        } else if (code === 'MUCHOS_INTENTOS') msg.textContent = 'Demasiados intentos. Espera unos minutos.';
        else if (code === 'RED') msg.textContent = 'Sin conexión. Revisa tu internet.';
        else if (code === 'SIN_PERFIL') msg.textContent = 'Esta cuenta aún no tiene rol. Avisa a quien administra el sistema.';
        else { msg.textContent = 'No se pudo entrar. Intenta otra vez.'; console.error(e); }
      }
    }
    function press(k) {
      if (busy) return;
      msg.textContent = '';
      if (k === 'del') pin = pin.slice(0, -1);
      else if (pin.length < 6) pin += k;
      paint();
      if (pin.length === 6) intentar();
    }
    document.getElementById('pad').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
    window.onkeydown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
  }

  /* =====================================================================
     ARRANQUE DEL PANEL
     ===================================================================== */
  async function startApp() {
    window.onkeydown = null;
    APP.buildShell();
    document.getElementById('main').innerHTML = '<div class="empty muted">Cargando…</div>';
    try { await APP.refreshCore(); } catch (e) { APP.handleErr(e); }
    // Accesos rápidos de la app instalada (?accion=vender, buscar, escanear, etiquetas)
    const accion = new URLSearchParams(location.search).get('accion');
    if (accion) {
      history.replaceState(null, '', location.pathname + location.hash);
      if (accion === 'vender') location.hash = '#/vender';
      else if (accion === 'etiquetas' && APP.isAdmin()) location.hash = '#/etiquetas';
    }
    await APP.render();
    if (accion === 'buscar') APP.openSearch();
    if (accion === 'escanear') APP.openScanner();
    // Refresco cada 45 s: datos y globito de avisos. Nunca pisa lo que estás escribiendo.
    setInterval(async () => {
      if (document.hidden || !APP.user) return;
      try {
        await APP.refreshCore();
        if (!document.querySelector('.overlay')) {
          if (APP.current === 'productos' && APP.pages.productos.paint && document.activeElement.tagName !== 'INPUT') APP.pages.productos.paint();
          if (APP.current === 'inicio' || APP.current === 'notificaciones') APP.render();
        }
      } catch (_) {}
    }, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && APP.user) APP.refreshCore().catch(() => {}); });
  }

  /* =====================================================================
     FICHA PÚBLICA (QR) · no pide PIN
     ===================================================================== */
  async function renderPublic(codigo) {
    root().innerHTML = '<div class="public"><div class="empty muted">Cargando…</div></div>';
    let r;
    try { r = await API.publicProducto(codigo); } catch (e) { r = null; }
    const p = r && r.producto, cfg = (r && r.config) || {};
    API.logScan(codigo);
    if (!p) {
      root().innerHTML = `<div class="public"><div class="public-card"><div class="top"><img src="assets/logo-pequeno.png" alt="Vedith Variedades"></div>
        <div class="card center stack"><h1>Producto no disponible</h1><p class="muted">Este código ya no está en el catálogo o no existe.</p></div></div></div>`;
      return;
    }
    const fotos = p.fotos || [];
    const wa = String(cfg.whatsapp || '').replace(/\D/g, '');
    const waUrl = wa ? `https://wa.me/${wa.length === 8 ? '502' + wa : wa}?text=${encodeURIComponent(`Hola, me interesa: ${p.nombre} (${p.codigo})`)}` : '';
    document.title = `${p.nombre} · ${cfg.nombre_negocio || 'Vedith Variedades'}`;
    root().innerHTML = `<div class="public"><div class="public-card">
      <div class="top"><img src="assets/logo-pequeno.png" alt="${esc(cfg.nombre_negocio || 'Vedith Variedades')}"></div>
      <div class="card stack">
        ${APP.gallery(fotos, p.nombre)}
        <div><h1>${esc(p.nombre)}</h1>${p.categoria ? `<span class="pill pink" style="margin-top:6px">${esc(p.categoria)}</span>` : ''}</div>
        <div class="row between wrap"><div class="price-big num">${money(p.precio)}</div>${p.disponible ? '<span class="pill ok">Disponible</span>' : '<span class="pill bad">Agotado por ahora</span>'}</div>
        ${p.descripcion ? `<p class="muted">${esc(p.descripcion)}</p>` : ''}
        <p class="xs faint">Código ${esc(p.codigo)}</p>
        ${waUrl ? `<a class="btn green block" target="_blank" rel="noopener" href="${waUrl}">${icon('chat')} Preguntar por WhatsApp</a>` : ''}
      </div>
      <p class="xs faint center">${esc(cfg.nombre_negocio || 'Vedith Variedades')} · Distribuidor independiente de Tupperware</p>
    </div></div>`;
    APP.bindGallery(root(), fotos, p.nombre);
  }

  /* =====================================================================
     SERVICE WORKER (PWA + avisos push)
     ===================================================================== */
  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }

  /* =====================================================================
     ENTRADA
     ===================================================================== */
  async function boot() {
    registrarSW();
    const codigo = new URLSearchParams(location.search).get('p');
    if (codigo) return renderPublic(codigo);
    let s = null;
    try { s = await API.init(); } catch (e) { console.error(e); }
    if (s) { APP.user = s; await startApp(); } else renderLogin();
  }
  boot();
})();
