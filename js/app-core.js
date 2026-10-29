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
    archivados: [],
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
    FALTA_SQL_DISENOS: 'Para guardar diseños falta correr migracion_disenos.sql en Supabase.',
    COLOR_REQUERIDO: 'Elige de qué color es.',
    COLOR_NO_ENCONTRADO: 'Ese color ya no existe en el producto.',
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
  // Confirmación "escribe la palabra" para acciones que no se deshacen fácil
  APP.confirmarEscribiendo = ({ title, message, palabra, okLabel = 'Confirmar' }) => new Promise((resolve) => {
    let fin = false; const done = (v) => { if (!fin) { fin = true; resolve(v); } };
    const m = openModal({ title, onClose: () => done(false),
      body: `<p>${esc(message)}</p><label class="field">Para confirmar, escribe <b>${esc(palabra)}</b><input class="input" id="cwIn" autocomplete="off" autocapitalize="characters" placeholder="${esc(palabra)}"></label>`,
      footer: `<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn danger" data-ok disabled>${esc(okLabel)}</button>` });
    const ok = m.foot.querySelector('[data-ok]'), inp = m.body.querySelector('#cwIn');
    inp.addEventListener('input', () => { ok.disabled = inp.value.trim().toUpperCase() !== palabra.toUpperCase(); });
    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    ok.addEventListener('click', () => { done(true); m.close(); });
  });
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
    APP.productosTodos = prods; APP.productos = prods.filter((p) => !p.archivado); APP.archivados = prods.filter((p) => p.archivado); APP.categorias = cats; APP.config = cfg; APP.cuentas = cuentas; APP.notifs = notifs || [];
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
  APP.stockEstado = (p) => (p.avisar_stock === false ? 'ok' : p.cantidad <= 0 ? 'agotado' : p.cantidad <= (p.stock_minimo ?? 2) ? 'poco' : 'ok');
  APP.stockPill = (p) => {
    const e = APP.stockEstado(p);
    if (e === 'agotado') return '<span class="pill bad">Agotado</span>';
    if (e === 'poco') return `<span class="pill warn">Quedan ${p.cantidad}</span>`;
    if (p.avisar_stock === false && p.cantidad <= 0) return '<span class="pill">0 en stock</span>';
    return `<span class="pill ok">${p.cantidad} disponibles</span>`;
  };

  /* Dirección base de los QR: la de Ajustes, o la de esta misma página */
  APP.baseUrl = () => {
    const cfg = (APP.config.url_base_qr || '').trim();
    const here = new URL('./', location.href).href;
    return (cfg || here).replace(/[?#].*$/, '');
  };
  APP.qrLink = (codigo, estilo) => {
    const b = APP.baseUrl();
    return b + (b.endsWith('/') || /\.html?$/.test(b) ? '' : '/') + '?p=' + encodeURIComponent(codigo) + (estilo ? '&e=' + encodeURIComponent(estilo) : '');
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
      { id: 'inventario', label: 'Inventario', icon: 'package' },
      { id: 'vender', label: 'Vender', icon: 'bag', sell: true },
      { id: 'ingreso', label: 'Recibir', icon: 'plus' }
    ] : [
      { id: 'inventario', label: 'Inventario', icon: 'package' },
      { id: 'vender', label: 'Vender', icon: 'bag', sell: true },
      { id: 'mis-ventas', label: 'Mis ventas', icon: 'receipt' }
    ];
  }
  // Menú «Más», en grupos con nombres sencillos
  // Lo avanzado que el «Modo fácil» esconde del menú (sigue disponible al apagarlo)
  const AVANZADO = ['dinero', 'gastos', 'reportes', 'notificaciones', 'catalogos'];
  APP.facil = () => !!U.lsGet('vedith-facil', false);
  APP.aplicarLetra = () => { const t = U.lsGet('vedith-letra', 'normal'); document.documentElement.style.fontSize = t === 'grande' ? '112.5%' : t === 'extra' ? '125%' : ''; };
  function moreItems() {
    const todo = moreItemsTodos();
    if (!isAdmin() || !APP.facil()) return todo;
    let g = '', pendiente = '';
    const out = [];
    todo.forEach((n) => {
      if (n.g) { g = n.g; pendiente = n.g; }
      if (AVANZADO.includes(n.id)) return;
      out.push(pendiente ? { ...n, g: pendiente } : { ...n, g: undefined });
      pendiente = '';
    });
    return out;
  }
  function moreItemsTodos() {
    return isAdmin() ? [
      { g: 'Mi día', id: 'inicio', label: 'Resumen del día', icon: 'home', d: 'Ventas de hoy y avisos' },
      { id: 'ventas', label: 'Ventas', icon: 'receipt', d: 'Todo lo vendido' },
      { id: 'cobrar', label: 'Por cobrar', icon: 'users', d: 'Quién te debe' },
      { g: 'Mercadería', id: 'productos', label: 'Administrar productos', icon: 'package', d: 'Editar, ocultar, archivar' },
      { id: 'cajas', label: 'Cajas (pedidos)', icon: 'box', d: 'Lo que pides a Tupperware' },
      { id: 'pendientes', label: 'Falta foto o precio', icon: 'alert', d: 'Productos por completar' },
      { id: 'etiquetas', label: 'Etiquetas QR', icon: 'printer', d: 'Imprimir con tu tamaño' },
      { g: 'Dinero', id: 'dinero', label: 'Dinero y depósitos', icon: 'wallet', d: 'Efectivo y bancos' },
      { id: 'gastos', label: 'Gastos', icon: 'wallet', d: 'Lo que gastas' },
      { id: 'reportes', label: 'Reportes', icon: 'chart', d: 'Ganancias y Excel' },
      { g: 'Compartir', id: 'tienda', label: 'Mi catálogo', icon: 'tag', d: 'Tus productos para compartir' },
      { id: 'catalogos', label: 'Catálogo Tupperware', icon: 'book', d: 'PDF a librito' },
      { id: 'estados', label: 'Imágenes para estados', icon: 'image', d: 'Para WhatsApp' },
      { g: 'Privado', id: 'dulces', label: 'Dulces', icon: 'lock', d: 'Gelatinas y gomitas' },
      { g: 'Sistema', id: 'notificaciones', label: 'Notificaciones', icon: 'bell', d: 'Avisos de ventas' },
      { id: 'ajustes', label: 'Ajustes', icon: 'sliders', d: 'PIN, espacio, colores' }
    ] : [
      { id: 'estados', label: 'Imágenes para estados', icon: 'image', d: 'Para WhatsApp' }
    ];
  }
  const conGrupos = (items, fila) => items.map((n) => (n.g ? `<div class="grp-t">${esc(n.g)}</div>` : '') + fila(n)).join('');

  APP.buildShell = function () {
    const nav = navItems(), more = moreItems();
    const rolTxt = isAdmin() ? 'Administración' : 'Visualizador';
    document.getElementById('root').innerHTML = `
    <div id="app">
      <header class="topbar">
        <a class="brand" href="#/inventario" aria-label="Inicio">
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
          ${conGrupos(more, (n) => `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)} ${esc(n.label)}</a>`)}
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
    const badge = (id) => {
      const n = id === 'notificaciones' ? APP.unread() : id === 'pendientes' && APP.pendientes ? APP.pendientes().length : id === 'etiquetas' ? APP.productos.filter((p) => p.activo && !p.etiqueta_impresa_at).length : 0;
      return n ? `<span class="mo-badge">${n > 99 ? '99+' : n}</span>` : '';
    };
    let grupo = '';
    const tiles = more.map((n) => { if (n.g) grupo = n.g; return { ...n, grupo }; });
    const grupos = [...new Set(tiles.map((t) => t.grupo))];
    const m = openModal({
      title: 'Más opciones', wide: true,
      body: `<div class="mo-user"><span class="mo-av">${icon(isAdmin() ? 'lock' : 'users')}</span><div class="grow"><b>${esc(APP.user.nombre || (isAdmin() ? 'Administración' : 'Visualizador'))}</b><div class="xs muted">${isAdmin() ? 'Administración · ves todo' : 'Visualizador · puedes vender'}</div></div></div>
        ${more.length > 4 ? `<div class="searchbox">${icon('search')}<input class="input" id="moQ" type="search" placeholder="¿Qué buscas? (ej.: etiquetas, dinero)" autocomplete="off"></div>` : ''}
        <div id="moLista" class="stack">${grupos.map((g) => `<section class="mo-grp" data-g><h3 class="grp-t">${esc(g || 'Opciones')}</h3><div class="mo-grid">${tiles.filter((t) => t.grupo === g).map((n) => `<a class="mo-tile" href="#/${n.id}" data-go data-k="${esc((n.label + ' ' + (n.d || '')).toLowerCase())}"><span class="mo-ic">${icon(n.icon, 'lg')}${badge(n.id)}</span><span class="mo-t"><b>${esc(n.label)}</b><small>${esc(n.d || '')}</small></span></a>`).join('')}</div></section>`).join('')}</div>
        ${isAdmin() && APP.facil() ? `<p class="small muted" style="margin:0">Modo fácil: hay opciones avanzadas escondidas. Las puedes mostrar en <a href="#/ajustes" data-go>Ajustes</a>.</p>` : ''}
        <section class="mo-grp"><h3 class="grp-t">Ayuda y cuenta</h3><div class="mo-grid">
          <button type="button" class="mo-tile" id="mAyuda"><span class="mo-ic">${icon('help', 'lg')}</span><span class="mo-t"><b>Cómo usar el panel</b><small>Lo básico paso a paso</small></span></button>
          <button type="button" class="mo-tile" id="mInstall" ${APP.installEvent ? '' : 'hidden'}><span class="mo-ic">${icon('download', 'lg')}</span><span class="mo-t"><b>Instalar app</b><small>En la pantalla de inicio</small></span></button>
          <button type="button" class="mo-tile" id="mSalir"><span class="mo-ic">${icon('logout', 'lg')}</span><span class="mo-t"><b>Salir</b><small>Cerrar sesión</small></span></button></div></section>`
    });
    m.body.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', () => m.close()));
    m.body.querySelector('#mAyuda').addEventListener('click', () => { m.close(); APP.openHelp(); });
    m.body.querySelector('#mInstall').addEventListener('click', () => { m.close(); APP.installApp(); });
    m.body.querySelector('#mSalir').addEventListener('click', APP.logout);
    const q = m.body.querySelector('#moQ');
    if (q) q.addEventListener('input', () => {
      const t = q.value.trim().toLowerCase();
      m.body.querySelectorAll('#moLista [data-k]').forEach((a) => { a.hidden = !!t && !a.dataset.k.includes(t); });
      m.body.querySelectorAll('#moLista [data-g]').forEach((g) => { g.hidden = ![...g.querySelectorAll('[data-k]')].some((a) => !a.hidden); });
    });
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
    const id = name || 'inventario';
    return { id, params: new URLSearchParams(qs || '') };
  };
  APP.go = (id) => { location.hash = '#/' + id; };
  /* ---------- ayuda de cada pantalla: «¿Cómo se hace?» ---------- */
  const AYUDAS = {
    inventario: ['Mi inventario', ['Aquí ves todo lo que tienes, con su foto y cuántas piezas hay.', 'Toca un producto para ver cuántos hay de cada estilo (diseño o color).', 'Si se equivocó el conteo, abre el producto y corrige con − y +.', 'Arriba: «Nuevo» crea un producto y «Recibí mercadería» suma lo que llegó.']],
    vender: ['Vender', ['Toca la foto de lo que se lleva la clienta (o búscalo arriba).', 'Si tiene estilos, elige cuál.', 'Elige si pagó al contado o queda fiado.', 'Toca «Registrar venta». El inventario baja solo.']],
    ingreso: ['Recibí mercadería', ['Busca lo que llegó escribiendo su nombre o escaneando su QR. Si es nuevo, toca «Es un producto nuevo».', 'Pon cuántas piezas llegaron de cada estilo.', 'Toca «Sumar al inventario».']],
    productos: ['Administrar productos', ['Aquí editas, ocultas o archivas productos.', 'Filtra por tanda para ver lo de una campaña.', 'Al terminar una tanda, «Archivar esta tanda» guarda todo junto y lo puedes deshacer.']],
    etiquetas: ['Etiquetas QR', ['Marca los productos que quieres imprimir.', 'Elige si quieres una etiqueta por producto o por cada diseño o color.', 'Escoge el tamaño de la etiqueta y de la hoja. Te dice cuántas caben.', 'Toca «Imprimir» y luego marca que salieron bien.']],
    tienda: ['Mi catálogo', ['Es una página con todos tus productos para que tus clientas los vean.', 'Toca «Compartir por WhatsApp» y mándales el enlace.', 'Ellas arman su pedido y te llega por WhatsApp ya escrito.', 'Lo que ocultes o archives deja de verse solo.']],
    cajas: ['Cajas (pedidos)', ['Anota cada pedido que le haces a Tupperware con lo que trae.', 'Cuando llegue la caja, márcala como recibida: las piezas se suman al inventario.', 'Marca cuándo la pagaste y de qué cuenta salió el dinero.']],
    dinero: ['Dinero y depósitos', ['Aquí está el dinero que tienes en efectivo y en cada banco.', 'Cuando llevas efectivo al banco, regístralo como depósito.']],
    cobrar: ['Por cobrar', ['Son las ventas fiadas que todavía no te pagan.', 'Toca una para registrar un abono o recordarle el pago por WhatsApp.']],
    ventas: ['Ventas', ['Todo lo vendido, con quién vendió y cómo pagó.', 'Si una venta estuvo mal, ábrela y anúlala: las piezas vuelven al inventario.']],
    'mis-ventas': ['Mis ventas', ['Aquí ves lo que tú has vendido.']],
    pendientes: ['Falta foto o precio', ['Son productos a los que todavía les falta algo para verse bien.', 'Toca uno, ponle su precio y su foto, y listo.']],
    dulces: ['Dulces', ['«+ Entrega»: anota qué entregaste, a quién y lo que gastaste.', '«Cobré» o «Registrar pago» cuando te paguen. «Repetir» copia una entrega anterior.', 'El comprobante para la clienta no lleva gastos ni ganancias.', 'Esta sección es privada: nadie más la ve.']],
    gastos: ['Gastos', ['Anota lo que gastas en el negocio para saber cuánto ganas de verdad.']],
    reportes: ['Reportes', ['Elige las fechas para ver lo vendido y lo ganado.', 'Puedes bajarlo a Excel.']],
    estados: ['Imágenes para estados', ['Elige un producto y un estilo de imagen.', 'Se crea una imagen lista para subir a tus estados de WhatsApp.']],
    catalogos: ['Catálogo de Tupperware', ['Sube el PDF del catálogo de la campaña y se convierte en un librito para compartir.', 'Al terminar la campaña, archívalo: se borran las hojas y ahorras espacio.']],
    ajustes: ['Ajustes', ['Aquí cambias el tamaño de la letra, activas el Modo fácil, ves el espacio de fotos y cambias los PIN.']],
    inicio: ['Resumen del día', ['«Qué hacer hoy» te dice lo más importante. Toca cada línea para ir directo.', 'Abajo ves lo vendido hoy y este mes.']],
    notificaciones: ['Notificaciones', ['Aquí ves los avisos, por ejemplo cada venta.', 'Toca «Activar avisos» para que también lleguen al teléfono.']]
  };
  APP.botonAyuda = function (main, id) {
    const a = AYUDAS[id]; const cab = main.querySelector('.page-head');
    if (!a || !cab || cab.querySelector('.ayuda-btn')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost sm ayuda-btn'; b.innerHTML = `${icon('help', 'sm')} ¿Cómo se hace?`;
    b.addEventListener('click', () => openModal({ title: a[0], body: `<p class="muted">Paso a paso:</p><ol class="ayuda-pasos">${a[1].map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`, footer: '<button type="button" class="btn" data-ok>Entendido</button>' }).foot.querySelector('[data-ok]').addEventListener('click', () => U.closeAllModals()));
    cab.appendChild(b);
  };
  APP.render = async function (animar) {
    if (!APP.user) return;
    let { id, params } = APP.route();
    const adminOnly = ['inicio', 'ventas', 'ingreso', 'dulces', 'catalogos', 'pendientes', 'cajas', 'dinero', 'cobrar', 'reportes', 'gastos', 'etiquetas', 'tienda', 'notificaciones', 'ajustes'];
    if (!isAdmin() && (adminOnly.includes(id) || id === 'productos')) id = 'inventario';
    if (isAdmin() && id === 'mis-ventas') id = 'ventas';
    const page = APP.pages[id] || APP.pages.inventario;
    APP.current = id;
    APP.$$('[data-nav]').forEach((a) => { if (a.dataset.nav === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const main = APP.$('#main');
    main.innerHTML = '<div class="empty muted">Cargando…</div>';
    try { await page(main, params); } catch (e) { APP.handleErr(e); main.innerHTML = `<div class="empty">${icon('alert', 'lg')}<p>No se pudo cargar esta pantalla.</p><button class="btn secondary" onclick="location.reload()">Reintentar</button></div>`; }
    APP.botonAyuda(main, id);
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
  // Enlace para compartir una ficha (opcionalmente de un diseño o color en concreto)
  APP.compartir = async function (p, estilo) {
    const link = APP.qrLink(p.codigo, estilo);
    const texto = `${p.nombre}${estilo ? ' · ' + estilo : ''} — ${money(p.precio)}`;
    try { if (navigator.share) { await navigator.share({ title: p.nombre, text: texto, url: link }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto + '\n' + link)}`, '_blank', 'noopener');
  };

  APP.openFicha = function (p) {
    const ad = isAdmin();
    const gan = ad && p.costo != null ? p.precio - p.costo : null;
    if (ad && APP.cargarRitmo && !APP.ritmo) APP.cargarRitmo();
    const est = APP.stockEstado(p);
    const es = APP.estilosDe ? APP.estilosDe(p) : [];
    const tarjetasEstilo = es.map((e) => {
      const foto = e.foto || '';
      const cols = e.items.length > 1 || (e.items[0] && e.items[0].diseno && e.items[0].tono) ? e.items.filter((c) => c.tono) : [];
      return `<div class="fe-card ${e.n <= 0 ? 'cero' : ''}">
        <span class="fe-img" ${foto ? `data-foto="${esc(foto)}"` : ''}>${foto ? U.imgTag(foto, '') : e.solo ? APP.vdot(e.solo) : icon('tag')}</span>
        <span class="fe-n num">${e.n}</span>
        <span class="fe-nm">${esc(e.nombre)}</span>
        ${cols.length ? `<span class="fe-cols">${cols.map((c) => `<span class="fe-col" title="${esc(c.tono)}">${APP.dot(c.tono, c.hex, c.hexes)}<b class="num">${c.cantidad == null ? '' : c.cantidad}</b></span>`).join('')}</span>` : ''}
        <span class="fe-act"><button type="button" class="icon-btn" data-share="${esc(e.nombre)}" aria-label="Compartir ${esc(e.nombre)}">${icon('share')}</button>${ad ? `<button type="button" class="icon-btn" data-qr-est="${esc(e.nombre)}" aria-label="QR de ${esc(e.nombre)}">${icon('qr')}</button>` : ''}</span>
      </div>`;
    }).join('');
    const m = openModal({
      title: p.nombre,
      wide: true,
      body: `
        ${APP.gallery(p.fotos, p.nombre)}
        <div class="ficha-top">
          <div><div class="price-big num">${money(p.precio)}</div>
            <div class="row wrap" style="margin-top:6px">${p.precio_anterior > p.precio ? `<span class="pill ok">Oferta · antes ${money(p.precio_anterior)}</span>` : ''}${ad && APP.ritmoPill ? APP.ritmoPill(p) : ''}${p.categoria ? `<span class="pill pink">${esc(p.categoria)}</span>` : ''}${ad && p.campana ? `<span class="pill">${esc(p.campana)}</span>` : ''}${ad && !p.activo ? '<span class="pill">Oculto</span>' : ''}</div></div>
          <div class="inv-tot ${est}" style="min-width:84px"><b class="num">${p.cantidad}</b><small>${est === 'agotado' ? 'agotado' : 'tengo'}</small></div>
        </div>
        ${p.descripcion ? `<p class="muted">${esc(p.descripcion)}</p>` : ''}
        ${es.length ? `<section class="stack-sm"><h3 class="ficha-h">Cuántos hay de cada ${APP.textoVar(p)[2]}</h3><div class="fe-grid">${tarjetasEstilo}</div></section>` : ''}
        ${p.precio_regateo != null ? (ad
          ? `<div class="banner info">${icon('tag')}<span class="small">Descuento (Regateo): <b class="num">${money(p.precio_regateo)}</b> — el precio más bajo al que se puede vender.</span></div>`
          : `<div class="stack-sm"><button type="button" class="btn ghost sm" id="regBtn" aria-expanded="false" style="justify-self:start">${icon('tag', 'sm')} Descuento (Regateo)</button>
             <div id="regBox" hidden class="row wrap"><span class="muted small">Último precio:</span><b class="num" style="font-size:1.15rem">${money(p.precio_regateo)}</b>
             <button type="button" class="btn secondary sm" data-a="vender-reg" ${APP.sinStock(p) ? 'disabled' : ''}>Vender a este precio</button></div></div>`) : ''}
        ${ad ? `<details class="card flat ficha-det"><summary>Datos solo para ti</summary>
          <dl class="kv">
            <dt>Costo</dt><dd class="num">${money(p.costo)}</dd>
            <dt>Ganancia por pieza</dt><dd class="num">${money(gan)}${gan != null && p.precio > 0 ? ` <span class="muted">(${Math.round((gan / p.precio) * 100)} %)</span>` : ''}</dd>
            <dt>Vale lo que tengo</dt><dd class="num">${money(p.precio * p.cantidad)}</dd>
            <dt>Código Tupperware</dt><dd>${p.codigo_tupperware ? esc(p.codigo_tupperware) : '<span class="faint">sin anotar</span>'}</dd>
            <dt>Tanda</dt><dd>${p.campana ? esc(p.campana) : '<span class="faint">sin tanda</span>'}</dd>
            <dt>Aviso de poco stock</dt><dd>${p.avisar_stock === false ? 'Apagado' : 'Con ' + p.stock_minimo + ' o menos'}</dd>
            <dt>Etiqueta QR</dt><dd>${p.etiqueta_impresa_at ? `Impresa · ${U.fmtDate(p.etiqueta_impresa_at)}` : '<span class="pill warn">Sin imprimir</span>'}</dd>
          </dl></details>` : ''}
        <p class="xs faint">Código ${esc(p.codigo)}</p>`,
      footer: `<button type="button" class="btn secondary" data-a="mas" aria-label="Más opciones">${icon('more')} Más</button>
               ${ad ? `<button type="button" class="btn secondary" data-a="editar">${icon('edit')} Editar</button>` : `<button type="button" class="btn secondary" data-a="compartir">${icon('share')} Compartir</button>`}
               <button type="button" class="btn" data-a="vender" ${APP.sinStock(p) ? 'disabled' : ''}>${icon('bag')} Vender</button>`
    });
    APP.bindGallery(m.body, p.fotos, p.nombre);
    APP.bindVarFotos(m.body);
    m.body.querySelectorAll('.fe-img[data-foto]').forEach((el) => el.addEventListener('click', () => APP.lightbox([el.dataset.foto], 0)));
    m.body.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', () => APP.compartir(p, b.dataset.share)));
    m.body.querySelectorAll('[data-qr-est]').forEach((b) => b.addEventListener('click', () => APP.openQR(p, b.dataset.qrEst)));
    const on = (a, fn) => { m.el.querySelectorAll(`[data-a="${a}"]`).forEach((b) => b.addEventListener('click', fn)); };
    const irVender = () => { if (APP.current === 'vender') APP.render(); else APP.go('vender'); };
    on('vender', () => { m.close(); APP.addToCart(p.id, { despues: irVender }); });
    on('vender-reg', () => { m.close(); APP.addToCart(p.id, { regateo: true, despues: irVender }); });
    const rb = m.body.querySelector('#regBtn');
    if (rb) rb.addEventListener('click', () => { const box = m.body.querySelector('#regBox'); box.hidden = !box.hidden; rb.setAttribute('aria-expanded', String(!box.hidden)); });
    on('editar', () => { m.close(); APP.openProductoForm(p); });
    on('compartir', () => APP.compartir(p));
    const archivar = async () => {
      if (!await confirmDialog({ title: 'Archivar producto', message: `«${p.nombre}» sale de la lista, del catálogo y del QR. Las ventas ya hechas no cambian. Lo puedes restaurar desde «Archivados».`, okLabel: 'Archivar' })) return;
      try { await API.archivarProductos([p.id]); await APP.refreshCore(); m.close(); APP.render(); toast('Producto archivado', { ms: 15000, action: { label: 'Deshacer', fn: async () => { try { await API.restaurarProductos([p.id]); await APP.refreshCore(); APP.render(); toast('Producto restaurado'); } catch (er) { APP.handleErr(er); } } } }); } catch (e) { APP.handleErr(e); }
    };
    on('mas', () => {
      const mm = openModal({ title: 'Más opciones', body: `<div class="list">
        <button type="button" class="item" data-x="compartir">${icon('share')}<span class="grow t1">Compartir por WhatsApp</span>${icon('chevron', 'sm')}</button>
        ${ad ? `<button type="button" class="item" data-x="ingreso">${icon('plus')}<span class="grow t1">Llegó mercadería de este producto</span>${icon('chevron', 'sm')}</button>
        <button type="button" class="item" data-x="qr">${icon('qr')}<span class="grow t1">Ver código QR</span>${icon('chevron', 'sm')}</button>
        <button type="button" class="item" data-x="etiq">${icon('printer')}<span class="grow t1">Imprimir etiqueta${es.length > 1 ? 's (una por estilo)' : ''}</span>${icon('chevron', 'sm')}</button>
        <button type="button" class="item" data-x="archivar">${icon('box')}<span class="grow t1">Archivar</span>${icon('chevron', 'sm')}</button>` : ''}</div>` });
      const x = (k, fn) => { const b = mm.body.querySelector(`[data-x="${k}"]`); if (b) b.addEventListener('click', () => { mm.close(); fn(); }); };
      x('compartir', () => APP.compartir(p));
      x('ingreso', () => { m.close(); APP.loteInicial = [p.id]; APP.go('ingreso'); });
      x('qr', () => APP.openQR(p));
      x('etiq', () => { m.close(); APP.preselect = [p.id]; APP.go('etiquetas'); });
      x('archivar', archivar);
    });
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
        if (APP.current === 'inventario') APP.pages.inventario.paint && APP.pages.inventario.paint();
      } catch (e) { APP.handleErr(e); }
    });
  }

  /* ---------- QR de un producto ---------- */
  APP.makeQR = function (el, text, size) {
    el.innerHTML = '';
    if (!window.QRCode) { el.textContent = text; return; }
    new QRCode(el, { text, width: size, height: size, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  };
  APP.openQR = function (p, estilo) {
    const link = APP.qrLink(p.codigo, estilo);
    const m = openModal({
      title: 'Código QR · ' + p.codigo + (estilo ? ' · ' + estilo : ''),
      body: `<div class="center stack">
        <div id="qrBox" style="display:grid;place-items:center;background:#fff;border-radius:16px;padding:16px;margin:0 auto"></div>
        <b>${esc(p.nombre)}${estilo ? ' · ' + esc(estilo) : ''}</b>
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
    p = p || { nombre: '', categoria_id: '', descripcion: '', precio: '', costo: '', precio_regateo: '', cantidad: 1, stock_minimo: 2, codigo_tupperware: '', activo: true, fotos: [], usa_colores: false, avisar_stock: false, colores: [], campana: U.lsGet('vedith-campana', ''), conservar: false, ...(opts.prefill || {}) };
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
        <label class="field">Tanda <span class="hint">La tanda a la que pertenece (ej.: Tupper Tips 11). Sirve para filtrar y archivar todo junto cuando termine.</span>
          <input class="input" id="pfCamp" list="pfCampList" value="${esc(p.campana || '')}" maxlength="60" placeholder="Ej.: Tupper Tips 11 · oct 2026" autocomplete="off"></label>
        <datalist id="pfCampList">${[...new Set(APP.productosTodos.map((x) => x.campana).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <div class="grid-3">
          <label class="field">Precio de venta *<input class="input" id="pfPrecio" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.precio)}" placeholder="0.00"></label>
          <label class="field">Costo<input class="input" id="pfCosto" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.costo)}" placeholder="0.00"></label>
          <label class="field">Cantidad<input class="input" id="pfCant" type="number" inputmode="numeric" min="0" value="${esc(p.cantidad)}"></label>
        </div>
        <section class="stack-sm">
          <label class="row"><input type="checkbox" id="pfUsaCol" ${p.usa_colores ? 'checked' : ''} ${API._colores === false ? 'disabled' : ''} style="width:22px;height:22px;accent-color:var(--pink-600)"> <span><b>Viene en varios colores o diseños</b> <span class="small muted">Cada opción (color, diseño o los dos juntos) lleva su propia existencia.</span></span></label>
          ${API._colores === false ? `<div class="banner">${icon('alert')}<span class="small">Para usar colores falta correr <b>migracion_colores.sql</b> en Supabase.</span></div>` : ''}
          <div id="pfColBox" ${p.usa_colores ? '' : 'hidden'}></div>
        </section>
        <label class="field">Descuento (Regateo) <span class="hint">Opcional. El precio más bajo al que aceptas vender. Se muestra aparte del precio principal; quien vende lo ve solo si lo toca.</span>
          <input class="input" id="pfReg" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.precio_regateo ?? '')}" placeholder="Ej.: 135"></label>
        <label class="field">Precio anterior (oferta) <span class="hint">Opcional. Si es mayor que el precio de venta, en tu catálogo se ve tachado con la etiqueta «Oferta».${API._ofertas === false ? ' <b>Falta correr migracion_ofertas.sql en Supabase.</b>' : ''}</span>
          <input class="input" id="pfAnt" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.precio_anterior ?? '')}" placeholder="Ej.: 150"></label>
        <section class="stack-sm">
          <label class="row"><input type="checkbox" id="pfAvisar" ${p.avisar_stock !== false ? 'checked' : ''} ${API._colores === false ? 'disabled' : ''} style="width:22px;height:22px;accent-color:var(--pink-600)"> <span><b>Avisarme cuando se acabe</b> <span class="small muted">Si lo apagas no sale la alerta de poco stock y se puede vender aunque ya no haya.</span></span></label>
          <label class="field" id="pfMinBox" ${p.avisar_stock !== false ? '' : 'hidden'}>Avisarme cuando queden<input class="input" id="pfMin" type="number" inputmode="numeric" min="0" value="${esc(p.stock_minimo)}"><span class="hint">Piezas o menos: sale la alerta de poco stock.</span></label>
        </section>
        <label class="field">Descripción<textarea class="input" id="pfDesc" maxlength="500" placeholder="Para qué sirve, medidas, colores…">${esc(p.descripcion || '')}</textarea></label>
        <fieldset class="stack-sm" style="border:0;padding:0;margin:0">
          <legend class="small" style="font-weight:800;margin-bottom:6px">Fotos (links de internet, hasta 5)</legend>
          <p class="small muted">Pega el link de la foto. Debe ser el link directo a la imagen. Los de Google Drive y Dropbox se arreglan solos.</p>
          <div id="pfFotos" class="stack-sm"></div>
          <button type="button" class="btn secondary sm" id="pfAddFoto">${icon('plus', 'sm')} Otra foto</button>
        </fieldset>
        <label class="row"><input type="checkbox" id="pfActivo" ${p.activo !== false ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--pink-600)"> <span><b>Visible en el catálogo</b> <span class="small muted">(si lo desmarcas, solo tú lo ves)</span></span></label>
        <label class="row"><input type="checkbox" id="pfConservar" ${p.conservar ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--pink-600)"> <span><b>Mantener siempre</b> <span class="small muted">No se archiva solo aunque se agote.</span></span></label>
      </form>`,
      footer: `${!nuevo ? `<button type="button" class="btn secondary" style="flex:0 0 auto" id="pfDel" aria-label="Eliminar producto">${icon('trash')}</button>` : ''}
        <button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" id="pfSave">Guardar</button>`
    });

    // ---- colores y aviso de stock
    const colBox = m.body.querySelector('#pfColBox'), chkCol = m.body.querySelector('#pfUsaCol'), chkAv = m.body.querySelector('#pfAvisar');
    let ed = null;
    const montarEd = () => {
      ed = APP.editorColores(colBox, p.colores || [], { sinDisenos: API._variantes === false, sinFotos: API._fotosDis === false, piezasPrevias: (p.colores && p.colores.length) || nuevo ? 0 : Number(p.cantidad) || 0, onChange: (t) => { m.body.querySelector('#pfCant').value = t; } });
      m.body.querySelector('#pfCant').value = ed.total();
    };
    const alternarCol = () => { const on = chkCol.checked; colBox.hidden = !on; m.body.querySelector('#pfCant').disabled = on; if (on && !ed) montarEd(); };
    chkCol.addEventListener('change', alternarCol); alternarCol();
    chkAv.addEventListener('change', () => { m.body.querySelector('#pfMinBox').hidden = !chkAv.checked; });
    const fotosBox = m.body.querySelector('#pfFotos');
    const addSlot = (val = '') => {
      if (fotosBox.children.length >= 5) return;
      const row = document.createElement('div');
      row.className = 'foto-link';
      row.innerHTML = `<div class="prev" aria-hidden="true">${icon('image')}</div>
        <div><input class="input" type="url" inputmode="url" placeholder="https://…" value="${esc(val)}" aria-label="Link de la foto"><div class="msg" hidden></div></div>
        <button type="button" class="icon-btn" aria-label="Quitar foto">${icon('x')}</button>`;
      const input = row.querySelector('input'), prev = row.querySelector('.prev'), msg = row.querySelector('.msg');
      APP.agregarSubir(input);
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
      const usa = chkCol.checked; let colores = [];
      if (usa) {
        const r = ed.get(); if (r.error) return toast(r.error, { error: true });
        colores = r.colores; if (!colores.length) return toast('Elige al menos un diseño o un color, o desmarca «Viene en varios colores o diseños».', { error: true });
      }
      if (nuevo && g('#pfCamp').value.trim()) U.lsSet('vedith-campana', g('#pfCamp').value.trim());
      const btn = m.foot.querySelector('#pfSave'); btn.disabled = true;
      try {
        const id = await API.saveProducto({
          usa_colores: usa, colores, avisar_stock: chkAv.checked, campana: g('#pfCamp').value, conservar: g('#pfConservar').checked,
          id: p.id, nombre, categoria_id: g('#pfCat').value, descripcion: g('#pfDesc').value, precio,
          costo: g('#pfCosto').value, precio_regateo: reg, precio_anterior: g('#pfAnt').value, cantidad: usa ? colores.reduce((s, c) => s + c.cantidad, 0) : g('#pfCant').value, stock_minimo: g('#pfMin').value,
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
      <span class="grow"><div class="t1 ellipsis">${esc(p.nombre)}</div><div class="t2">${esc(p.codigo)}${isAdmin() && p.codigo_tupperware ? ' · Tupperware ' + esc(p.codigo_tupperware) : ''} ${APP.dots ? APP.dots(p, 5) : ''}</div></span>
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
        <h3>Lo básico en 3 toques</h3>
        <ol><li><b>Inventario</b>: ves cada producto con su foto y cuántos tienes de cada estilo.</li>
        <li><b>Vender</b>: tocas la foto de lo que se lleva el cliente y registras.</li>
        ${ad ? '<li><b>Recibir</b>: cuando llega mercadería, buscas el producto (o lo creas) y pones cuántos de cada estilo.</li>' : '<li><b>Mis ventas</b>: ves lo que has vendido.</li>'}</ol>
        <h3>Buscar rápido</h3>
        <ul><li>Toca la lupa de arriba (o <b>Ctrl + K</b> en computadora) y escribe el nombre o el código.</li>
        <li>Toca el ícono de cámara para <b>escanear la etiqueta QR</b> de un producto y ver su precio al instante.</li></ul>
        <h3>Vender</h3>
        <ol><li>Toca el botón rosado <b>Vender</b>.</li><li>Busca el producto y tócalo para agregarlo. Cambia la cantidad si hace falta.</li>
        <li>Elige <b>Contado</b> o <b>Fiado</b> (si es fiado, escribe el nombre del cliente).</li><li>Escribe quién vende y toca <b>Registrar venta</b>. El inventario baja solo${ad ? '' : ' y la administración recibe el aviso'}.</li></ol>
        ${ad ? `<h3>Agregar productos</h3>
        <ol><li>Lo más fácil: toca <b>Recibir</b> y, si es nuevo, <b>Es un producto nuevo</b>. También puedes ir a <b>Más → Administrar productos → + Producto</b>.</li><li>Llena nombre, precio y cantidad. Pon el <b>código de Tupperware</b> si lo tienes (solo tú lo ves).</li>
        <li>Para las fotos, toca <b>Subir foto</b> (cámara o galería; se achica sola) o pega el link de la imagen (hasta 5).</li></ol>
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
