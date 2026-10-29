/* Catálogo propio para compartir: los productos que tienes registrados (no el librito de Tupperware).
   Página pública (?tienda=1) con búsqueda, categorías, fotos, estilos y pedido por WhatsApp,
   y la pantalla de administración «Mi catálogo» con el enlace, el QR y el botón de compartir. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal } = U;
  const APP = window.APP;
  const P = APP.pages;

  APP.tiendaLink = () => {
    const b = APP.baseUrl();
    return b + (b.endsWith('/') || /\.html?$/.test(b) ? '' : '/') + '?tienda=1';
  };

  /* ---------- administración: Mi catálogo ---------- */
  P.tienda = async function (main) {
    const link = APP.tiendaLink();
    const visibles = APP.productos.filter((p) => p.activo);
    const conStock = visibles.filter((p) => p.cantidad > 0 || p.avisar_stock === false);
    const sinFoto = visibles.filter((p) => !(p.fotos && p.fotos.length));
    main.innerHTML = `
      <div class="page-head"><div><h1>Mi catálogo</h1><p class="sub">Un enlace para que tus clientas vean todo lo que tienes y te pidan por WhatsApp.</p></div></div>
      <div class="stack">
        ${APP.baseUrlEsLocal() ? `<div class="banner">${icon('alert')}<span class="small">Este enlace es de prueba (<b>${esc(APP.baseUrl())}</b>). Pon la dirección real de la app en <a href="#/ajustes">Ajustes</a> antes de compartirlo.</span></div>` : ''}
        <section class="card stack tienda-share">
          <div class="row" style="gap:16px;align-items:center"><div id="tQR" class="tienda-qr"></div>
            <div class="stack-sm grow" style="min-width:0"><b>Enlace de tu catálogo</b><span class="small muted" style="word-break:break-all">${esc(link)}</span></div></div>
          <div class="row wrap">
            <button type="button" class="btn green" id="tWa">${icon('chat')} Compartir por WhatsApp</button>
            <button type="button" class="btn secondary" id="tCopy">Copiar enlace</button>
            <a class="btn secondary" href="${esc(link)}" target="_blank" rel="noopener">${icon('eye')} Ver como la clienta</a>
          </div>
        </section>
        <section class="card stack"><h2>Qué se ve en el catálogo</h2>
          <div class="kpis"><div class="kpi"><span class="k-l">Productos que salen</span><span class="k-v num">${visibles.length}</span><span class="small muted">${conStock.length} con existencia</span></div>
            <div class="kpi ${sinFoto.length ? 'orange' : ''}"><span class="k-l">Sin foto</span><span class="k-v num">${sinFoto.length}</span><span class="small muted">se ven mejor con foto</span></div></div>
          <ul class="small muted" style="margin:0;padding-left:18px;display:grid;gap:4px">
            <li>Salen todos los productos <b>activos</b>. Los que ocultes o archives dejan de verse solos.</li>
            <li>Los agotados salen marcados; la clienta puede esconderlos.</li>
            <li>Nunca salen el costo, la ganancia ni el código de Tupperware.</li>
            <li>El catálogo siempre está al día: no hay que volver a subirlo.</li>
          </ul>
          ${sinFoto.length ? `<a class="btn ghost sm" href="#/pendientes" style="justify-self:start">${icon('camera', 'sm')} Poner fotos a ${sinFoto.length} productos</a>` : ''}
        </section>
      </div>`;
    APP.makeQR(main.querySelector('#tQR'), link, 160);
    main.querySelector('#tWa').addEventListener('click', () => { window.open(`https://wa.me/?text=${encodeURIComponent('Mira todo lo que tengo disponible 👇\n' + link)}`, '_blank', 'noopener'); });
    main.querySelector('#tCopy').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(link); toast('Enlace copiado'); });
  };

  /* ---------- página pública ---------- */
  APP.renderTienda = async function () {
    const root = document.getElementById('root');
    root.innerHTML = '<div class="public"><div class="empty muted">Cargando catálogo…</div></div>';
    let r;
    try { r = await API.tiendaPublica(); } catch (e) { r = null; }
    if (!r) { root.innerHTML = '<div class="public"><div class="public-card card center stack"><h1>No se pudo cargar</h1><p class="muted">Revisa tu internet e inténtalo otra vez.</p><button class="btn" onclick="location.reload()">Reintentar</button></div></div>'; return; }
    const cfg = r.config || {}, nombre = cfg.nombre_negocio || 'Vedith Variedades';
    const todos = r.productos || [];
    const wa = String(cfg.whatsapp || '').replace(/\D/g, '');
    const waBase = wa ? `https://wa.me/${wa.length === 8 ? '502' + wa : wa}` : 'https://wa.me/';
    document.title = `Catálogo · ${nombre}`;
    const cats = [...new Set(todos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const F = { q: '', cat: '', agot: false };
    let pedido = [];
    try { pedido = JSON.parse(localStorage.getItem('vedith-pedido') || '[]'); } catch (_) {}
    const guardar = () => { try { localStorage.setItem('vedith-pedido', JSON.stringify(pedido)); } catch (_) {} };

    root.innerHTML = `<div class="public tienda"><div class="tienda-wrap">
      <header class="tienda-top"><img src="assets/logo-pequeno.png" alt="${esc(nombre)}"><div><h1>${esc(nombre)}</h1><p>Catálogo de productos · ${todos.length} ${todos.length === 1 ? 'producto' : 'productos'}</p></div></header>
      <div class="searchbox">${icon('search')}<input class="input" id="tQ" type="search" placeholder="¿Qué estás buscando?" autocomplete="off"></div>
      ${cats.length ? `<div class="chips" id="tCats" role="group" aria-label="Categorías"><button type="button" class="chip" data-c="" aria-pressed="true">Todo</button>${cats.map((c) => `<button type="button" class="chip" data-c="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div>` : ''}
      <label class="row small" style="gap:8px"><input type="checkbox" id="tAgot" style="width:20px;height:20px;accent-color:var(--pink-600)"> Mostrar también los agotados</label>
      <div id="tGrid" class="tienda-grid"></div>
      <p class="xs faint center">${esc(nombre)} · Distribuidor independiente de Tupperware</p>
    </div>
    <div class="pedido-bar" id="tBar" hidden><button type="button" class="btn green block" id="tPedido"></button></div></div>`;

    const enOferta = (p) => Number(p.precio_anterior) > Number(p.precio);
    const esNuevo = (p) => p.creado && Date.now() - new Date(p.creado) < 14 * 86400000;
    const etiqueta = (p) => (enOferta(p) ? `<span class="tp-tag oferta">Oferta −${Math.round((1 - p.precio / p.precio_anterior) * 100)}%</span>` : esNuevo(p) ? '<span class="tp-tag nuevo">Nuevo</span>' : '');
    const lineaDe = (p, estilo) => pedido.find((l) => l.codigo === p.codigo && (l.estilo || '') === (estilo || ''));
    const pintarBarra = () => {
      const n = pedido.reduce((s, l) => s + l.cant, 0), bar = root.querySelector('#tBar');
      bar.hidden = !n;
      root.querySelector('#tPedido').innerHTML = `${icon('bag')} Mi pedido · ${n} ${n === 1 ? 'pieza' : 'piezas'} · ${money(pedido.reduce((s, l) => s + l.cant * l.precio, 0))} <span style="opacity:.85">Ver y enviar</span>`;
    };
    const pintar = () => {
      const q = F.q.trim().toLowerCase();
      const lista = todos.filter((p) => (F.agot || p.disponible) && (!F.cat || p.categoria === F.cat) && (!q || (p.nombre + ' ' + (p.descripcion || '') + ' ' + (p.colores || []).map((c) => c.color).join(' ')).toLowerCase().includes(q)));
      const g = root.querySelector('#tGrid');
      g.innerHTML = lista.length ? lista.map((p) => `<button type="button" class="tprod ${p.disponible ? '' : 'agot'}" data-c="${esc(p.codigo)}">
        <span class="tp-foto">${p.fotos && p.fotos[0] ? U.imgTag(p.fotos[0], p.nombre) : U.placeholder('Sin foto')}${p.disponible ? '' : '<span class="pill bad tp-ag">Agotado</span>'}${etiqueta(p)}</span>
        <span class="tp-n">${esc(p.nombre)}</span><span class="tp-p num">${money(p.precio)}${enOferta(p) ? ` <s class="tp-ant">${money(p.precio_anterior)}</s>` : ''}</span>
        ${(p.colores || []).length ? `<span class="tp-v">${APP.dots({ usa_colores: true, colores: p.colores.map((c) => ({ ...c, cantidad: null })) }, 5)}</span>` : ''}</button>`).join('')
        : '<div class="card empty" style="grid-column:1/-1"><p>No encontré productos con eso.</p></div>';
      g.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => detalle(todos.find((p) => p.codigo === b.dataset.c))));
    };
    function detalle(p) {
      const cols = p.colores || [], dis = cols.some((c) => c.diseno);
      let sel = '';
      const unidades = dis ? [...new Map(cols.filter((c) => c.diseno).map((c) => [c.diseno, c])).values()].map((c) => ({ n: c.diseno, foto: c.foto, c, ok: cols.filter((x) => x.diseno === c.diseno).some((x) => x.disponible) })) : cols.map((c) => ({ n: c.color, foto: c.foto, c, ok: c.disponible }));
      const m = openModal({ title: p.nombre, wide: true, body: `
        ${APP.gallery(p.fotos, p.nombre)}
        <div class="row between wrap"><div class="price-big num">${money(p.precio)}${enOferta(p) ? ` <s class="tp-ant" style="font-size:1rem">${money(p.precio_anterior)}</s>` : ''}</div>${p.disponible ? '<span class="pill ok">Disponible</span>' : '<span class="pill bad">Agotado por ahora</span>'}</div>
        ${p.descripcion ? `<p class="muted">${esc(p.descripcion)}</p>` : ''}
        ${unidades.length ? `<div class="stack-sm"><b class="small">${dis ? 'Elige el diseño' : 'Elige el color'}</b><div class="chips" style="flex-wrap:wrap;overflow:visible" id="tEst">${unidades.map((u) => `<button type="button" class="chip" data-e="${esc(u.n)}" ${u.ok ? '' : 'disabled style="opacity:.45;text-decoration:line-through"'} aria-pressed="false">${APP.vdot({ ...u.c, color: u.n, tono: dis ? '' : u.c.tono })}${esc(u.n)}</button>`).join('')}</div></div>` : ''}
        <p class="xs faint">Código ${esc(p.codigo)}</p>`,
        footer: `<a class="btn secondary" target="_blank" rel="noopener" href="${waBase}?text=${encodeURIComponent('Hola, me interesa: ' + p.nombre + ' (' + p.codigo + ')')}">${icon('chat')} Preguntar</a><button type="button" class="btn green" id="tAdd" ${p.disponible ? '' : 'disabled'}>${icon('plus')} Agregar al pedido</button>` });
      APP.bindGallery(m.body, p.fotos || [], p.nombre); APP.bindVarFotos(m.body);
      m.body.querySelectorAll('#tEst [data-e]').forEach((b) => b.addEventListener('click', () => { sel = sel === b.dataset.e ? '' : b.dataset.e; m.body.querySelectorAll('#tEst .chip').forEach((x) => x.setAttribute('aria-pressed', x.dataset.e === sel)); const u = unidades.find((x) => x.n === sel); if (u && u.foto) { const mf = m.body.querySelector('.main-foto'); if (mf) mf.innerHTML = U.imgTag(u.foto, p.nombre); } }));
      m.foot.querySelector('#tAdd').addEventListener('click', () => {
        if (unidades.length && !sel) return toast(`Elige ${dis ? 'el diseño' : 'el color'} primero.`, { error: true });
        const l = lineaDe(p, sel); if (l) l.cant += 1; else pedido.push({ codigo: p.codigo, nombre: p.nombre, estilo: sel, precio: Number(p.precio), cant: 1 });
        guardar(); pintarBarra(); m.close(); toast('Agregado a tu pedido');
      });
    }
    function verPedido() {
      const m = openModal({ title: 'Mi pedido', wide: true, body: '<div id="pLista" class="stack"></div>', footer: '<button type="button" class="btn secondary" data-vaciar>Vaciar</button><button type="button" class="btn green" data-enviar>' + icon('chat') + ' Enviar por WhatsApp</button>' });
      const pintarLista = () => {
        const box = m.body.querySelector('#pLista');
        if (!pedido.length) { box.innerHTML = '<p class="muted center">Tu pedido está vacío.</p>'; return; }
        box.innerHTML = pedido.map((l, i) => `<div class="cart-line"><div class="grow"><div class="t1">${esc(l.nombre)}${l.estilo ? ' · ' + esc(l.estilo) : ''}</div><div class="small muted">${money(l.precio)} c/u</div></div>
          <button type="button" class="icon-btn" data-del="${i}" aria-label="Quitar">${icon('x')}</button>
          <div class="stepper"><button type="button" data-m="${i}" aria-label="Menos">${icon('minus')}</button><input type="number" value="${l.cant}" min="1" readonly aria-label="Cantidad"><button type="button" data-p="${i}" aria-label="Más">${icon('plus')}</button></div>
          <div class="amt num" style="justify-self:end">${money(l.precio * l.cant)}</div></div>`).join('')
          + `<div class="total-bar"><span>Total aproximado</span><b class="num">${money(pedido.reduce((s, l) => s + l.precio * l.cant, 0))}</b></div>`;
        box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { pedido.splice(+b.dataset.del, 1); guardar(); pintarBarra(); pintarLista(); }));
        box.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { const l = pedido[+b.dataset.m]; l.cant = Math.max(1, l.cant - 1); guardar(); pintarBarra(); pintarLista(); }));
        box.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { pedido[+b.dataset.p].cant += 1; guardar(); pintarBarra(); pintarLista(); }));
      };
      pintarLista();
      m.foot.querySelector('[data-vaciar]').addEventListener('click', () => { pedido = []; guardar(); pintarBarra(); m.close(); });
      m.foot.querySelector('[data-enviar]').addEventListener('click', () => {
        if (!pedido.length) return;
        const total = pedido.reduce((s, l) => s + l.precio * l.cant, 0);
        const txt = `Hola, quisiera pedir:\n${pedido.map((l) => `• ${l.cant} × ${l.nombre}${l.estilo ? ' (' + l.estilo + ')' : ''} — ${money(l.precio * l.cant)}`).join('\n')}\nTotal aproximado: ${money(total)}\n¿Me confirmas la disponibilidad? Gracias.`;
        window.open(`${waBase}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
      });
    }
    root.querySelector('#tQ').addEventListener('input', U.debounce((e) => { F.q = e.target.value; pintar(); }, 120));
    root.querySelector('#tAgot').addEventListener('change', (e) => { F.agot = e.target.checked; pintar(); });
    root.querySelectorAll('#tCats [data-c]').forEach((b) => b.addEventListener('click', () => { F.cat = b.dataset.c; root.querySelectorAll('#tCats .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); pintar(); }));
    root.querySelector('#tPedido').addEventListener('click', verPedido);
    pintar(); pintarBarra();
  };
})();
