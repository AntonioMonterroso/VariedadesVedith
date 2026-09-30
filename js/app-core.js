/* Núcleo de la app: estado, carga de datos, estructura (menús), ficha de producto,
   formulario de producto, buscador, escáner de QR y notificaciones push. */
(function () {
  'use strict';
  const { icon, esc, money, norm, toast, openModal, confirmDialog } = U;
  const C = window.VEDITH_CONFIG;

  const APP = (window.APP = {
    user: null,
    productos: [],
    categorias: [],
    cuentas: [],
    notifs: [],
    config: {},
    cart: [],
    pages: {},              // se llena en app-pages.js
    filtros: { q: '', cat: '', f: '' },
    installEvent: null
  });

  const isAdmin = () => APP.user && APP.user.rol === 'administrador';
  APP.isAdmin = isAdmin;
  APP.$ = (sel, root = document) => root.querySelector(sel);
  APP.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- errores en español ---------- */
  const ERR = {
    STOCK_INSUFICIENTE: 'No hay suficiente existencia de ese producto.',
    CLIENTE_REQUERIDO: 'Para vender fiado hace falta el nombre del cliente.',
    PRODUCTO_NO_ENCONTRADO: 'Ese producto ya no está disponible.',
    CANTIDAD_INVALIDA: 'La cantidad no es válida.',
    NO_AUTORIZADO: 'Tu sesión terminó. Vuelve a entrar con tu PIN.',
    MONTO_INVALIDO: 'El monto no es válido (no puede ser mayor a lo que se debe).',
    VENTA_NO_VALIDA: 'Esa venta no admite abonos.',
    PIN_REPETIDO: 'Ese PIN ya lo usa la otra cuenta. Elige uno distinto.',
    PIN_INVALIDO: 'El PIN debe tener exactamente 6 números.',
    MAXIMO_5_FOTOS: 'Máximo 5 fotos por producto.',
    CUENTA_REQUERIDA: 'Elige a qué cuenta entró el dinero.',
    CUENTA_INVALIDA: 'Esa cuenta ya no está disponible.',
    METODO_INVALIDO: 'Elige cómo pagó el cliente.'
  };
  APP.errMsg = (e) => {
    const m = (e && e.message) || '';
    for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
    if (/JWT|expired|not authenticated/i.test(m)) return ERR.NO_AUTORIZADO;
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta otra vez.';
    return 'Algo salió mal. Intenta otra vez.' + (m ? ' (' + m.slice(0, 80) + ')' : '');
  };
  APP.handleErr = (e) => {
    console.error(e);
    toast(APP.errMsg(e), { error: true, ms: 5000 });
    if ((e && e.message || '').includes('NO_AUTORIZADO')) APP.logout();
  };

  /* ---------- datos ---------- */
  APP.refreshCore = async function () {
    const jobs = [API.categorias(), API.productos(), API.config(), API.cuentas()];
    if (isAdmin()) jobs.push(API.notificaciones());
    const [cats, prods, cfg, cuentas, notifs] = await Promise.all(jobs);
    APP.categorias = cats; APP.productos = prods; APP.config = cfg; APP.cuentas = cuentas; APP.notifs = notifs || [];
    APP.paintBadges();
  };
  APP.cuentaNombre = (id) => (APP.cuentas.find((c) => c.id === id) || {}).nombre || '';
  APP.METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', deposito: 'Depósito' };
  APP.unread = () => APP.notifs.filter((n) => !n.leida).length;
  APP.paintBadges = () => {
    const n = APP.unread();
    APP.$$('[data-bell-badge]').forEach((b) => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
  };
  APP.prod = (id) => APP.productos.find((p) => p.id === id);
  APP.prodByCode = (c) => APP.productos.find((p) => p.codigo.toLowerCase() === String(c).toLowerCase());
  APP.stockEstado = (p) => (p.cantidad <= 0 ? 'agotado' : p.cantidad <= (p.stock_minimo ?? 2) ? 'poco' : 'ok');
  APP.stockPill = (p) => {
    const e = APP.stockEstado(p);
    if (e === 'agotado') return '<span class="pill bad">Agotado</span>';
    if (e === 'poco') return `<span class="pill warn">Quedan ${p.cantidad}</span>`;
    return `<span class="pill ok">${p.cantidad} disponibles</span>`;
  };

  /* Dirección base de los QR: la de Ajustes, o la de esta misma página */
  APP.baseUrl = () => {
    const cfg = (APP.config.url_base_qr || '').trim();
    const here = new URL('./', location.href).href;
    return (cfg || here).replace(/[?#].*$/, '');
  };
  APP.qrLink = (codigo) => {
    const b = APP.baseUrl();
    return b + (b.endsWith('/') || /\.html?$/.test(b) ? '' : '/') + '?p=' + encodeURIComponent(codigo);
  };
  APP.baseUrlEsLocal = () => /^(file:|https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.))/i.test(APP.baseUrl());

  /* ---------- sesión ---------- */
  APP.logout = async function () {
    try { await API.logout(); } catch (_) {}
    location.hash = '';
    location.reload();
  };

  /* ---------- estructura: barra superior, menú lateral, navegación inferior ---------- */
  function navItems() {
    return isAdmin() ? [
      { id: 'inicio', label: 'Inicio', icon: 'home' },
      { id: 'productos', label: 'Productos', icon: 'package' },
      { id: 'vender', label: 'Vender', icon: 'bag', sell: true },
      { id: 'ventas', label: 'Ventas', icon: 'receipt' }
    ] : [
      { id: 'productos', label: 'Catálogo', icon: 'package' },
      { id: 'vender', label: 'Vender', icon: 'bag', sell: true },
      { id: 'mis-ventas', label: 'Mis ventas', icon: 'receipt' }
    ];
  }
  function moreItems() {
    return isAdmin() ? [
      { id: 'cajas', label: 'Cajas (pedidos)', icon: 'box' },
      { id: 'dinero', label: 'Dinero y depósitos', icon: 'wallet' },
      { id: 'cobrar', label: 'Por cobrar', icon: 'users' },
      { id: 'reportes', label: 'Reportes', icon: 'chart' },
      { id: 'gastos', label: 'Gastos', icon: 'wallet' },
      { id: 'etiquetas', label: 'Imprimir etiquetas QR', icon: 'printer' },
      { id: 'estados', label: 'Imágenes para estados', icon: 'image' },
      { id: 'notificaciones', label: 'Notificaciones', icon: 'bell' },
      { id: 'ajustes', label: 'Ajustes', icon: 'sliders' }
    ] : [
      { id: 'estados', label: 'Imágenes para estados', icon: 'image' }
    ];
  }

  APP.buildShell = function () {
    const nav = navItems(), more = moreItems();
    const rolTxt = isAdmin() ? 'Administración' : 'Visualizador';
    document.getElementById('root').innerHTML = `
    <div id="app">
      <header class="topbar">
        <a class="brand" href="#/${isAdmin() ? 'inicio' : 'productos'}" aria-label="Inicio">
          <img src="assets/logo-pequeno.png" alt="Vedith Variedades">
          <span class="b-text">Vedith<small>${esc(rolTxt)}</small></span>
        </a>
        <button type="button" class="top-search" id="btnSearch" aria-label="Buscar producto">${icon('search')}<span>Buscar producto…</span><kbd>Ctrl K</kbd></button>
        <button type="button" class="icon-btn" id="btnScan" aria-label="Escanear código QR">${icon('scan')}</button>
        ${isAdmin() ? `<a class="icon-btn" href="#/notificaciones" aria-label="Notificaciones">${icon('bell')}<span class="badge-dot" data-bell-badge hidden></span></a>` : ''}
        <button type="button" class="icon-btn" id="btnHelp" aria-label="Ayuda">${icon('help')}</button>
      </header>
      <div class="shell">
        <aside class="side" aria-label="Menú">
          <a class="btn sell-btn block" href="#/vender">${icon('bag')} Vender</a>
          ${nav.filter((n) => !n.sell).map((n) => `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)} ${esc(n.label)}</a>`).join('')}
          ${more.length ? '<div class="sep"></div>' : ''}
          ${more.map((n) => `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)} ${esc(n.label)}</a>`).join('')}
          <div class="sep"></div>
          <button type="button" class="nav-link" id="sideInstall" hidden>${icon('download')} Instalar app</button>
          <button type="button" class="nav-link" id="sideLogout">${icon('logout')} Salir</button>
        </aside>
        <main class="main" id="main" tabindex="-1"></main>
      </div>
      <nav class="bottomnav" aria-label="Principal">
        ${nav.map((n) => n.sell
          ? `<a class="sell" href="#/${n.id}" data-nav="${n.id}" aria-label="${esc(n.label)}"><span class="fab">${icon(n.icon, 'lg')}</span><span class="lbl">${esc(n.label)}</span></a>`
          : `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon, 'lg')}<span>${esc(n.label)}</span></a>`).join('')}
        <button type="button" id="btnMore">${icon('more', 'lg')}<span>Más</span></button>
      </nav>
    </div>`;
    APP.$('#btnSearch').addEventListener('click', () => APP.openSearch());
    APP.$('#btnScan').addEventListener('click', () => APP.openScanner());
    APP.$('#btnHelp').addEventListener('click', APP.openHelp);
    APP.$('#sideLogout').addEventListener('click', APP.logout);
    APP.$('#btnMore').addEventListener('click', openMore);
    const si = APP.$('#sideInstall');
    si.addEventListener('click', APP.installApp);
    si.hidden = !APP.installEvent;
    APP.paintBadges();
  };

  function openMore() {
    const more = moreItems();
    const m = openModal({
      title: 'Más opciones',
      body: `<div class="list">
        ${more.map((n) => `<a class="item" href="#/${n.id}" data-go>${icon(n.icon)}<span class="grow t1">${esc(n.label)}</span>${icon('chevron', 'sm')}</a>`).join('')}
        <button type="button" class="item" id="mAyuda">${icon('help')}<span class="grow t1">Cómo usar el panel</span>${icon('chevron', 'sm')}</button>
        <button type="button" class="item" id="mInstall" ${APP.installEvent ? '' : 'hidden'}>${icon('download')}<span class="grow t1">Instalar app en el teléfono</span>${icon('chevron', 'sm')}</button>
        <button type="button" class="item" id="mSalir">${icon('logout')}<span class="grow t1">Salir</span></button>
      </div>`
    });
    m.body.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', () => m.close()));
    m.body.querySelector('#mAyuda').addEventListener('click', () => { m.close(); APP.openHelp(); });
    m.body.querySelector('#mInstall').addEventListener('click', () => { m.close(); APP.installApp(); });
    m.body.querySelector('#mSalir').addEventListener('click', APP.logout);
  }

  APP.installApp = async function () {
    if (!APP.installEvent) return toast('Abre el menú del navegador y elige "Agregar a pantalla de inicio".');
    APP.installEvent.prompt();
    await APP.installEvent.userChoice.catch(() => {});
    APP.installEvent = null;
    const si = APP.$('#sideInstall'); if (si) si.hidden = true;
  };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); APP.installEvent = e; const si = document.getElementById('sideInstall'); if (si) si.hidden = false; });

  /* ---------- router ---------- */
  APP.route = function () {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, qs] = h.split('?');
    const id = name || (isAdmin() ? 'inicio' : 'productos');
    return { id, params: new URLSearchParams(qs || '') };
  };
  APP.go = (id) => { location.hash = '#/' + id; };
  APP.render = async function (animar) {
    if (!APP.user) return;
    let { id, params } = APP.route();
    const adminOnly = ['inicio', 'ventas', 'cajas', 'dinero', 'cobrar', 'reportes', 'gastos', 'etiquetas', 'notificaciones', 'ajustes'];
    if (!isAdmin() && adminOnly.includes(id)) id = 'productos';
    if (isAdmin() && id === 'mis-ventas') id = 'ventas';
    const page = APP.pages[id] || APP.pages[isAdmin() ? 'inicio' : 'productos'];
    APP.current = id;
    APP.$$('[data-nav]').forEach((a) => { if (a.dataset.nav === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const main = APP.$('#main');
    main.innerHTML = '<div class="empty muted">Cargando…</div>';
    try { await page(main, params); } catch (e) { APP.handleErr(e); main.innerHTML = `<div class="empty">${icon('alert', 'lg')}<p>No se pudo cargar esta pantalla.</p><button class="btn secondary" onclick="location.reload()">Reintentar</button></div>`; }
    if (animar === true) { main.classList.remove('page-in'); void main.offsetWidth; main.classList.add('page-in'); }
    window.scrollTo({ top: 0 });
  };
  window.addEventListener('hashchange', () => { if (APP.user) APP.render(true); });
  window.addEventListener('scroll', () => { const t = document.querySelector('.topbar'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });

  /* ---------- fotos por link: vista + galería ---------- */
  APP.gallery = function (fotos, nombre) {
    if (!fotos || !fotos.length) return `<div class="gallery"><div class="main-foto">${U.placeholder('Sin foto')}</div></div>`;
    return `<div class="gallery">
      <button type="button" class="main-foto" data-zoom aria-label="Ver foto en grande">${U.imgTag(fotos[0], nombre)}</button>
      ${fotos.length > 1 ? `<div class="thumbs">${fotos.map((f, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}" ${i === 0 ? 'aria-current="true"' : ''}>${U.imgTag(f, '')}</button>`).join('')}</div>` : ''}
    </div>`;
  };
  APP.bindGallery = function (root, fotos, nombre) {
    let cur = 0;
    const main = root.querySelector('.main-foto');
    if (!main || !fotos.length) return;
    main.addEventListener('click', () => lightbox(fotos, cur));
    root.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
      cur = Number(b.dataset.i);
      main.innerHTML = U.imgTag(fotos[cur], nombre);
      root.querySelectorAll('.thumbs button').forEach((x) => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
    }));
  };
  function lightbox(fotos, i) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<button type="button" class="icon-btn" aria-label="Cerrar">${icon('x')}</button>${U.imgTag(fotos[i], '')}`;
    const close = () => { lb.remove(); document.removeEventListener('keydown', k); };
    const k = (e) => { if (e.key === 'Escape') close(); };
    lb.addEventListener('click', close); document.addEventListener('keydown', k);
    document.body.appendChild(lb);
  }
  APP.lightbox = lightbox;

  /* ---------- ficha de producto ---------- */
  APP.openFicha = function (p) {
    const ad = isAdmin();
    const gan = ad && p.costo != null ? p.precio - p.costo : null;
    const m = openModal({
      title: p.nombre,
      wide: true,
      body: `
        ${APP.gallery(p.fotos, p.nombre)}
        <div class="row between wrap">
          <div class="price-big num">${money(p.precio)}</div>
          <div class="row wrap">${p.categoria ? `<span class="pill pink">${esc(p.categoria)}</span>` : ''}${APP.stockPill(p)}${ad && !p.activo ? '<span class="pill">Oculto</span>' : ''}</div>
        </div>
        ${p.descripcion ? `<p class="muted">${esc(p.descripcion)}</p>` : ''}
        ${p.precio_regateo != null ? (ad
          ? `<div class="banner info">${icon('tag')}<span class="small">Descuento (Regateo): <b class="num">${money(p.precio_regateo)}</b> — el precio más bajo al que se puede vender.</span></div>`
          : `<div class="stack-sm"><button type="button" class="btn ghost sm" id="regBtn" aria-expanded="false" style="justify-self:start">${icon('tag', 'sm')} Descuento (Regateo)</button>
             <div id="regBox" hidden class="row wrap"><span class="muted small">Último precio:</span><b class="num" style="font-size:1.15rem">${money(p.precio_regateo)}</b>
             <button type="button" class="btn secondary sm" data-a="vender-reg" ${p.cantidad <= 0 ? 'disabled' : ''}>Vender a este precio</button></div></div>`) : ''}
        <dl class="kv card flat">
          <dt>Código</dt><dd>${esc(p.codigo)}</dd>
          ${ad ? `<dt>Código Tupperware</dt><dd>${p.codigo_tupperware ? esc(p.codigo_tupperware) : '<span class="faint">sin anotar</span>'}</dd>
          <dt>Costo</dt><dd class="num">${money(p.costo)}</dd>
          <dt>Ganancia por pieza</dt><dd class="num">${money(gan)}</dd>
          <dt>Mínimo antes de avisar</dt><dd>${p.stock_minimo}</dd>
          <dt>Etiqueta QR</dt><dd>${p.etiqueta_impresa_at ? `Impresa · ${U.fmtDate(p.etiqueta_impresa_at)}` : '<span class="pill warn">Sin imprimir</span>'}</dd>` : ''}
        </dl>
        <div class="row wrap">
          ${ad ? `<button type="button" class="btn secondary sm" data-a="ingreso">${icon('plus', 'sm')} Ingreso de mercadería</button>
          <button type="button" class="btn secondary sm" data-a="qr">${icon('qr', 'sm')} Ver QR</button>` : ''}
          <button type="button" class="btn secondary sm" data-a="estado">${icon('image', 'sm')} Imagen para estado</button>
        </div>`,
      footer: `${ad ? `<button type="button" class="btn secondary" data-a="editar">${icon('edit')} Editar</button>` : ''}
               <button type="button" class="btn" data-a="vender" ${p.cantidad <= 0 ? 'disabled' : ''}>${icon('bag')} Vender</button>`
    });
    APP.bindGallery(m.body, p.fotos, p.nombre);
    const on = (a, fn) => { m.el.querySelectorAll(`[data-a="${a}"]`).forEach((b) => b.addEventListener('click', fn)); };
    on('vender', () => { m.close(); APP.addToCart(p.id); APP.go('vender'); });
    on('vender-reg', () => { m.close(); APP.addToCart(p.id, { regateo: true }); APP.go('vender'); });
    const rb = m.body.querySelector('#regBtn');
    if (rb) rb.addEventListener('click', () => { const box = m.body.querySelector('#regBox'); box.hidden = !box.hidden; rb.setAttribute('aria-expanded', String(!box.hidden)); });
    on('editar', () => { m.close(); APP.openProductoForm(p); });
    on('qr', () => APP.openQR(p));
    on('estado', () => APP.openEstado(p));
    on('ingreso', () => ingresoMercaderia(p, m));
  };

  function ingresoMercaderia(p, parent) {
    const m = openModal({
      title: 'Ingreso de mercadería',
      body: `<p class="muted">¿Cuántas piezas de <b>${esc(p.nombre)}</b> llegaron? Hoy hay ${p.cantidad}.</p>
        <label class="field">Cantidad que llegó<input class="input" type="number" inputmode="numeric" min="1" id="ingQty" value="1" autofocus></label>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn green" data-ok>Sumar al inventario</button>'
    });
    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const q = parseInt(m.body.querySelector('#ingQty').value, 10);
      if (!(q >= 1)) return toast('Escribe una cantidad válida.', { error: true });
      try {
        await API.saveProducto({ ...p, cantidad: p.cantidad + q });
        await APP.refreshCore(); m.close(); if (parent) parent.close();
        toast(`Listo: ahora hay ${p.cantidad + q} de ${p.nombre}.`);
        if (APP.current === 'productos') APP.pages.productos.paint && APP.pages.productos.paint();
      } catch (e) { APP.handleErr(e); }
    });
  }

  /* ---------- QR de un producto ---------- */
  APP.makeQR = function (el, text, size) {
    el.innerHTML = '';
    if (!window.QRCode) { el.textContent = text; return; }
    new QRCode(el, { text, width: size, height: size, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  };
  APP.openQR = function (p) {
    const link = APP.qrLink(p.codigo);
    const m = openModal({
      title: 'Código QR · ' + p.codigo,
      body: `<div class="center stack">
        <div id="qrBox" style="display:grid;place-items:center;background:#fff;border-radius:16px;padding:16px;margin:0 auto"></div>
        <b>${esc(p.nombre)}</b>
        <p class="small muted" style="word-break:break-all">${esc(link)}</p>
        ${APP.baseUrlEsLocal() ? `<div class="banner">${icon('alert')}<span class="small">Este QR apunta a una dirección de prueba. Cuando la app esté publicada, pon la dirección final en Ajustes antes de imprimir.</span></div>` : ''}
      </div>`,
      footer: '<button type="button" class="btn secondary" data-copy>Copiar enlace</button><button type="button" class="btn" data-print>Imprimir etiqueta</button>'
    });
    APP.makeQR(m.body.querySelector('#qrBox'), link, 220);
    m.foot.querySelector('[data-copy]').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(link); toast('Enlace copiado'); });
    m.foot.querySelector('[data-print]').addEventListener('click', () => { m.close(); U.closeAllModals(); APP.preselect = [p.id]; APP.go('etiquetas'); });
  };

  /* ---------- formulario de producto (admin) ---------- */
  APP.openProductoForm = function (p, opts = {}) {
    const nuevo = !p;
    p = p || { nombre: '', categoria_id: '', descripcion: '', precio: '', costo: '', precio_regateo: '', cantidad: 1, stock_minimo: 2, codigo_tupperware: '', activo: true, fotos: [], ...(opts.prefill || {}) };
    const catOpts = APP.categorias.map((c) => `<option value="${esc(c.id)}" ${c.id === p.categoria_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
    const slots = Math.min(5, Math.max(1, (p.fotos || []).length + (nuevo || (p.fotos || []).length < 5 ? 1 : 0)));
    const m = openModal({
      title: nuevo ? 'Producto nuevo' : 'Editar producto',
      wide: true,
      body: `<form id="pf" class="stack" novalidate>
        <label class="field">Nombre del producto *<input class="input" id="pfNombre" value="${esc(p.nombre)}" maxlength="120" placeholder="Ej.: Set Cristalwave 4 piezas" autofocus></label>
        <div class="grid-2">
          <label class="field">Categoría<select class="input" id="pfCat"><option value="">Sin categoría</option>${catOpts}</select></label>
          <label class="field">Código Tupperware <span class="hint">Para volver a pedirlo. Solo lo ves tú; nunca sale en la ficha ni en el QR.</span>
            <input class="input" id="pfTup" value="${esc(p.codigo_tupperware || '')}" maxlength="40" placeholder="Ej.: 4581"></label>
        </div>
        <div class="grid-3">
          <label class="field">Precio de venta *<input class="input" id="pfPrecio" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.precio)}" placeholder="0.00"></label>
          <label class="field">Costo<input class="input" id="pfCosto" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.costo)}" placeholder="0.00"></label>
          <label class="field">Cantidad<input class="input" id="pfCant" type="number" inputmode="numeric" min="0" value="${esc(p.cantidad)}"></label>
        </div>
        <label class="field">Descuento (Regateo) <span class="hint">Opcional. El precio más bajo al que aceptas vender. Se muestra aparte del precio principal; quien vende lo ve solo si lo toca.</span>
          <input class="input" id="pfReg" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.precio_regateo ?? '')}" placeholder="Ej.: 135"></label>
        <label class="field">Avisarme cuando queden<input class="input" id="pfMin" type="number" inputmode="numeric" min="0" value="${esc(p.stock_minimo)}"><span class="hint">Piezas o menos: sale la alerta de poco stock.</span></label>
        <label class="field">Descripción<textarea class="input" id="pfDesc" maxlength="500" placeholder="Para qué sirve, medidas, colores…">${esc(p.descripcion || '')}</textarea></label>
        <fieldset class="stack-sm" style="border:0;padding:0;margin:0">
          <legend class="small" style="font-weight:800;margin-bottom:6px">Fotos (links de internet, hasta 5)</legend>
          <p class="small muted">Pega el link de la foto. Debe ser el link directo a la imagen. Los de Google Drive y Dropbox se arreglan solos.</p>
          <div id="pfFotos" class="stack-sm"></div>
          <button type="button" class="btn secondary sm" id="pfAddFoto">${icon('plus', 'sm')} Otra foto</button>
        </fieldset>
        <label class="row"><input type="checkbox" id="pfActivo" ${p.activo !== false ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--pink-600)"> <span><b>Visible en el catálogo</b> <span class="small muted">(si lo desmarcas, solo tú lo ves)</span></span></label>
      </form>`,
      footer: `${!nuevo ? `<button type="button" class="btn secondary" style="flex:0 0 auto" id="pfDel" aria-label="Eliminar producto">${icon('trash')}</button>` : ''}
        <button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" id="pfSave">Guardar</button>`
    });

    const fotosBox = m.body.querySelector('#pfFotos');
    const addSlot = (val = '') => {
      if (fotosBox.children.length >= 5) return;
      const row = document.createElement('div');
      row.className = 'foto-link';
      row.innerHTML = `<div class="prev" aria-hidden="true">${icon('image')}</div>
        <div><input class="input" type="url" inputmode="url" placeholder="https://…" value="${esc(val)}" aria-label="Link de la foto"><div class="msg" hidden></div></div>
        <button type="button" class="icon-btn" aria-label="Quitar foto">${icon('x')}</button>`;
      const input = row.querySelector('input'), prev = row.querySelector('.prev'), msg = row.querySelector('.msg');
      const check = U.debounce(() => {
        const raw = input.value.trim();
        msg.hidden = true; prev.classList.remove('bad'); prev.innerHTML = icon('image'); input.classList.remove('bad');
        if (!raw) return;
        const url = U.imageUrl(raw);
        if (!U.validUrl(url)) { msg.textContent = 'Debe empezar con https://'; msg.hidden = false; prev.classList.add('bad'); input.classList.add('bad'); return; }
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.onload = () => { prev.innerHTML = ''; prev.appendChild(img); img.style.cssText = 'width:100%;height:100%;object-fit:cover'; };
        img.onerror = () => { msg.textContent = 'No se pudo cargar. Usa el link directo de la imagen (termina en .jpg, .png…).'; msg.hidden = false; prev.classList.add('bad'); prev.innerHTML = icon('alert'); };
        img.src = url;
      }, 350);
      input.addEventListener('input', check);
      row.querySelector('.icon-btn').addEventListener('click', () => { row.remove(); if (!fotosBox.children.length) addSlot(); updateAdd(); });
      fotosBox.appendChild(row);
      if (val) check();
      updateAdd();
    };
    const updateAdd = () => { m.body.querySelector('#pfAddFoto').hidden = fotosBox.children.length >= 5; };
    (p.fotos || []).forEach((f) => addSlot(f));
    if (!fotosBox.children.length) addSlot();
    m.body.querySelector('#pfAddFoto').addEventListener('click', () => addSlot());

    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    const del = m.foot.querySelector('#pfDel');
    if (del) del.addEventListener('click', async () => {
      if (!await confirmDialog({ title: 'Eliminar producto', message: `¿Eliminar "${p.nombre}" para siempre? Las ventas ya hechas se quedan en el historial. Si solo quieres ocultarlo, desmarca "Visible en el catálogo".`, okLabel: 'Eliminar', danger: true })) return;
      try { await API.deleteProducto(p.id); await APP.refreshCore(); m.close(); toast('Producto eliminado'); APP.render(); } catch (e) { APP.handleErr(e); }
    });
    m.foot.querySelector('#pfSave').addEventListener('click', async () => {
      const g = (id) => m.body.querySelector(id);
      const nombre = g('#pfNombre').value.trim();
      const precio = g('#pfPrecio').value;
      if (!nombre) { g('#pfNombre').classList.add('bad'); g('#pfNombre').focus(); return toast('Falta el nombre del producto.', { error: true }); }
      if (precio === '' || Number(precio) < 0) { g('#pfPrecio').classList.add('bad'); g('#pfPrecio').focus(); return toast('Falta el precio de venta.', { error: true }); }
      const reg = g('#pfReg').value;
      if (reg !== '' && Number(reg) > Number(precio)) { g('#pfReg').classList.add('bad'); g('#pfReg').focus(); return toast('El precio con descuento no puede ser mayor al precio de venta.', { error: true }); }
      const fotos = [...fotosBox.querySelectorAll('input')].map((i) => U.imageUrl(i.value)).filter(Boolean);
      if (fotos.some((u) => !U.validUrl(u))) return toast('Alguna foto tiene un link inválido. Debe empezar con https://', { error: true });
      const btn = m.foot.querySelector('#pfSave'); btn.disabled = true;
      try {
        const id = await API.saveProducto({
          id: p.id, nombre, categoria_id: g('#pfCat').value, descripcion: g('#pfDesc').value, precio,
          costo: g('#pfCosto').value, precio_regateo: reg, cantidad: g('#pfCant').value, stock_minimo: g('#pfMin').value,
          codigo_tupperware: g('#pfTup').value, activo: g('#pfActivo').checked, fotos
        });
        await APP.refreshCore(); m.close();
        if (opts.onSaved) { opts.onSaved(id); return; }
        toast(nuevo ? 'Producto creado' : 'Cambios guardados', nuevo ? { action: { label: 'Imprimir etiqueta', fn: () => { APP.preselect = [id]; APP.go('etiquetas'); } } } : {});
        APP.render();
      } catch (e) { btn.disabled = false; APP.handleErr(e); }
    });
  };

  /* ---------- buscador (Ctrl/Cmd + K) ---------- */
  APP.matchProducto = (p, q) => {
    const n = norm(q); if (!n) return true;
    const hay = norm(p.nombre + ' ' + p.codigo + ' ' + (p.categoria || '') + ' ' + (isAdmin() ? p.codigo_tupperware || '' : ''));
    return n.split(/\s+/).every((w) => hay.includes(w));
  };
  APP.productoItem = (p, tag = 'button') => `
    <${tag} type="button" class="item" data-id="${esc(p.id)}">
      <span class="thumb">${p.fotos && p.fotos[0] ? U.imgTag(p.fotos[0], '') : icon('image')}</span>
      <span class="grow"><div class="t1 ellipsis">${esc(p.nombre)}</div><div class="t2">${esc(p.codigo)}${isAdmin() && p.codigo_tupperware ? ' · Tupperware ' + esc(p.codigo_tupperware) : ''}</div></span>
      <span style="text-align:right"><div class="amt num">${money(p.precio)}</div><div>${APP.stockPill(p)}</div></span>
    </${tag}>`;

  APP.openSearch = function (opts = {}) {
    const m = openModal({
      title: opts.title || 'Buscar producto',
      wide: true,
      body: `<div class="searchbox">${icon('search')}<input class="input" id="gsQ" type="search" placeholder="Nombre, código${isAdmin() ? ' o código Tupperware' : ''}…" autocomplete="off" autofocus></div>
             <div id="gsRes" class="list"></div>`
    });
    const q = m.body.querySelector('#gsQ'), res = m.body.querySelector('#gsRes');
    const paint = () => {
      const list = APP.productos.filter((p) => APP.matchProducto(p, q.value)).slice(0, 30);
      res.innerHTML = list.length ? list.map((p) => APP.productoItem(p)).join('') : '<div class="empty">No encontré nada con eso.</div>';
      res.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
        const p = APP.prod(b.dataset.id); m.close();
        if (opts.onPick) opts.onPick(p); else APP.openFicha(p);
      }));
    };
    q.addEventListener('input', paint); paint();
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = res.querySelector('[data-id]'); if (f) f.click(); } });
  };
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && APP.user) {
      e.preventDefault();
      if (!document.querySelector('.overlay')) APP.openSearch();
    }
  });

  /* ---------- escáner de QR con la cámara ---------- */
  APP.openScanner = function (opts) {
    opts = (opts && opts.onPick) ? opts : {};
    let stream, stopped = false;
    const m = openModal({
      title: 'Escanear etiqueta QR',
      body: `<div class="scanner"><video playsinline muted></video><div class="frame"></div></div>
             <p class="small muted center" id="scMsg">Apunta la cámara al QR de la etiqueta.</p>
             <form id="scForm" class="row"><input class="input grow" id="scCode" placeholder="…o escribe el código (VED-0001)" autocomplete="off"><button class="btn secondary" type="submit">Abrir</button></form>`,
      onClose: () => { stopped = true; if (stream) stream.getTracks().forEach((t) => t.stop()); }
    });
    const found = (text) => {
      let code = text;
      try { const u = new URL(text); code = u.searchParams.get('p') || text; } catch (_) {}
      const p = APP.prodByCode(code);
      if (!p) return false;
      stopped = true; m.close(); if (opts.onPick) opts.onPick(p); else APP.openFicha(p); return true;
    };
    m.body.querySelector('#scForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = m.body.querySelector('#scCode').value.trim();
      if (!v) return;
      if (!found(v)) toast('No encontré ese código.', { error: true });
    });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { m.body.querySelector('#scMsg').textContent = 'Este navegador no deja usar la cámara. Escribe el código abajo.'; return; }
    const video = m.body.querySelector('video');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(async (s) => {
      if (stopped) return s.getTracks().forEach((t) => t.stop());
      stream = s; video.srcObject = s; await video.play().catch(() => {});
      const detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
      let lastMiss = 0;
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          let text = null;
          try {
            if (detector) { const r = await detector.detect(video); if (r[0]) text = r[0].rawValue; }
            else if (window.jsQR) {
              canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
              const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const r = jsQR(d.data, d.width, d.height); if (r) text = r.data;
            }
          } catch (_) {}
          if (text && !found(text) && Date.now() - lastMiss > 2500) { lastMiss = Date.now(); toast('Ese QR no es de un producto de este panel.', { error: true }); }
        }
        setTimeout(tick, 200);
      };
      tick();
    }).catch(() => { m.body.querySelector('#scMsg').textContent = 'No pude abrir la cámara (falta el permiso). Puedes escribir el código abajo.'; });
  };

  /* ---------- notificaciones push ---------- */
  const b64ToU8 = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  };
  APP.pushEstado = async function () {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { ok: false, motivo: 'no-soportado' };
    if (!C.VAPID_PUBLIC_KEY) return { ok: false, motivo: 'sin-llave' };
    if (Notification.permission === 'denied') return { ok: false, motivo: 'bloqueado' };
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return { ok: true, activo: !!sub && Notification.permission === 'granted' };
  };
  APP.pushActivar = async function () {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('PERMISO_DENEGADO');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(C.VAPID_PUBLIC_KEY) });
    await API.pushSubscribe(sub);
  };
  APP.pushDesactivar = async function () {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { await API.pushUnsubscribe(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
  };

  /* ---------- ayuda ---------- */
  APP.openHelp = function () {
    const ad = isAdmin();
    openModal({
      title: 'Cómo usar el panel',
      wide: true,
      body: `<div class="help">
        <h3>Buscar rápido</h3>
        <ul><li>Toca la lupa de arriba (o <b>Ctrl + K</b> en computadora) y escribe el nombre o el código.</li>
        <li>Toca el ícono de cámara para <b>escanear la etiqueta QR</b> de un producto y ver su precio al instante.</li></ul>
        <h3>Vender</h3>
        <ol><li>Toca el botón rosado <b>Vender</b>.</li><li>Busca el producto y tócalo para agregarlo. Cambia la cantidad si hace falta.</li>
        <li>Elige <b>Contado</b> o <b>Fiado</b> (si es fiado, escribe el nombre del cliente).</li><li>Escribe quién vende y toca <b>Registrar venta</b>. El inventario baja solo${ad ? '' : ' y la administración recibe el aviso'}.</li></ol>
        ${ad ? `<h3>Agregar productos</h3>
        <ol><li>En <b>Productos</b> toca <b>+ Producto</b>.</li><li>Llena nombre, precio y cantidad. Pon el <b>código de Tupperware</b> si lo tienes (solo tú lo ves).</li>
        <li>Para las fotos, pega el link de la imagen de internet (hasta 5).</li></ol>
        <h3>Etiquetas QR</h3>
        <p>En <b>Más → Imprimir etiquetas QR</b> eliges los productos y sale una hoja lista para imprimir. El panel te muestra cuáles ya imprimiste y cuáles faltan; siempre puedes volver a imprimir.</p>
        <h3>Avisos en el teléfono</h3>
        <p>En <b>Notificaciones</b> toca <b>Activar avisos</b>. Así te llega un mensaje cuando alguien vende o cuando algo se está acabando, aunque tengas la app cerrada. En iPhone primero hay que instalar la app (Compartir → Agregar a pantalla de inicio).</p>` : ''}
        <h3>Instalar como app</h3>
        <ul><li><b>Android:</b> menú del navegador → <i>Instalar app</i> / <i>Agregar a pantalla principal</i>.</li>
        <li><b>iPhone:</b> botón Compartir → <i>Agregar a pantalla de inicio</i>.</li></ul>
      </div>`
    });
  };
})();
