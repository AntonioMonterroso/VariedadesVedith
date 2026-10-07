/* Importador de productos desde el catálogo (solo administración).
   1) Se abre una página del catálogo y se marca con un recuadro el texto de cada producto.
   2) La lectura (OCR) propone código, nombre y precio; se revisa y se agrega a la lista.
   3) Al importar, los productos nacen como BORRADOR: ocultos, sin precio de venta y sin foto.
   4) En "Pendientes de completar" se les pone su precio y el enlace de su foto.
   El precio del catálogo se guarda solo como referencia. No se sube ninguna foto. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal, confirmDialog } = U;
  const APP = window.APP;
  const P = APP.pages;
  const normCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  /* Productos a medio completar */
  APP.pendientes = () => APP.productos.filter((p) => (p.precio_catalogo != null ? (!p.activo || !p.fotos.length || !(p.precio > 0)) : (p.activo && !p.fotos.length)));

  /* =====================================================================
     IMPORTADOR
     ===================================================================== */
  APP.abrirImportador = async function (catalogo) {
    let paginas;
    try { paginas = (await API.paginasCatalogo(catalogo.id)).slice().sort((a, b) => a.numero - b.numero); } catch (e) { return APP.handleErr(e); }
    if (!paginas.length) return toast('Ese catálogo no tiene páginas.', { error: true });
    const LLAVE = 'vedith-imp-' + catalogo.id;
    let items = U.lsGet(LLAVE, []);
    let n = 1, zoom = 1, marcar = true, ocupado = false;

    const ov = document.createElement('div');
    ov.className = 'imp-overlay';
    ov.innerHTML = `
      <div class="imp" role="dialog" aria-modal="true" aria-label="Importar productos">
        <header class="imp-top"><div class="grow"><b>Importar productos</b><div class="small muted ellipsis">${esc(catalogo.titulo)}</div></div>
          <button type="button" class="icon-btn" id="impCerrar" aria-label="Cerrar">${icon('x')}</button></header>
        <div class="imp-main">
          <section class="imp-visor">
            <div class="imp-barra">
              <button type="button" class="icon-btn" id="impPrev" aria-label="Página anterior">${icon('back')}</button>
              <label class="row" style="gap:6px">Pág. <input class="input imp-num" id="impNum" type="number" min="1" max="${paginas.length}" value="1" aria-label="Número de página"> de ${paginas.length}</label>
              <button type="button" class="icon-btn" id="impNext" aria-label="Página siguiente">${icon('chevron')}</button>
              <span class="grow"></span>
              <button type="button" class="chip" id="impMenos" aria-label="Alejar">${icon('minus', 'sm')}</button>
              <button type="button" class="chip" id="impMas" aria-label="Acercar">${icon('plus', 'sm')}</button>
              <button type="button" class="chip" id="impMarcar" aria-pressed="true">${icon('scan', 'sm')} Marcar</button>
            </div>
            <div class="imp-scroll" id="impScroll"><div class="imp-lienzo" id="impLienzo"><img id="impImg" alt="Página del catálogo" crossorigin="anonymous" draggable="false"><div id="impCajas"></div><div class="imp-goma" id="impGoma" hidden></div></div></div>
            <p class="imp-ayuda small" id="impAyuda">Arrastra un recuadro sobre el texto de un producto: su código, su nombre y su precio.</p>
            <div class="imp-leyendo" id="impLeyendo" hidden><span class="spin"></span> Leyendo…</div>
          </section>
          <aside class="imp-lista">
            <div class="row between"><h3>Para importar <span class="pill pink" id="impCuenta">0</span></h3><button type="button" class="btn ghost sm" id="impVaciar">Vaciar</button></div>
            <div class="imp-items" id="impItems"></div>
            <button type="button" class="btn green block" id="impImportar" disabled>Importar productos</button>
            <p class="xs muted">Quedan como borradores ocultos. Les pones tu precio y su foto en «Pendientes de completar».</p>
          </aside>
        </div>
      </div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    const g = (s) => ov.querySelector(s);
    const img = g('#impImg'), lienzo = g('#impLienzo'), goma = g('#impGoma');

    const guardar = () => U.lsSet(LLAVE, items);
    const cerrar = () => { ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', teclas); APP.ocrCerrar(); };

    function irA(num) {
      n = Math.max(1, Math.min(paginas.length, num || 1));
      g('#impNum').value = n; img.src = paginas[n - 1].url_imagen; g('#impScroll').scrollTo(0, 0);
      pintarCajas();
    }
    function aplicarZoom() { lienzo.style.width = (zoom * 100) + '%'; }
    function pintarCajas() {
      g('#impCajas').innerHTML = items.map((it, i) => it.pagina !== n ? '' :
        `<div class="imp-caja" style="left:${it.x * 100}%;top:${it.y * 100}%;width:${it.w * 100}%;height:${it.h * 100}%"><span>${i + 1}</span></div>`).join('');
    }
    function pintarLista() {
      g('#impCuenta').textContent = items.length;
      const nuevos = items.filter((it) => !existente(it));
      g('#impImportar').disabled = !nuevos.length;
      g('#impImportar').textContent = nuevos.length ? `Importar ${nuevos.length} ${nuevos.length === 1 ? 'producto' : 'productos'}` : 'Importar productos';
      g('#impItems').innerHTML = items.length ? items.map((it, i) => {
        const ya = existente(it);
        return `<div class="imp-item ${ya ? 'ya' : ''}" data-i="${i}">
          <img src="${it.thumb}" alt="">
          <button type="button" class="imp-edit grow" data-edit="${i}"><b>${i + 1}. ${esc(it.nombre || 'Sin nombre')}</b><span class="xs muted">${esc(it.codigo || 'sin código')} · pág. ${it.pagina}${it.precio_catalogo ? ' · cat. $' + it.precio_catalogo : ''}</span>
            ${ya ? '<span class="pill warn">Ya existe en tu inventario</span>' : ''}</button>
          <button type="button" class="icon-btn" data-del="${i}" aria-label="Quitar">${icon('x')}</button></div>`;
      }).join('') : '<p class="muted small">Todavía no marcas ningún producto.</p>';
      g('#impItems').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { items.splice(Number(b.dataset.del), 1); guardar(); pintarLista(); pintarCajas(); }));
      g('#impItems').querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => revisar(items[Number(b.dataset.edit)], false)));
    }
    const existente = (it) => !!it.codigo && APP.productos.some((p) => normCodigo(p.codigo_tupperware) === normCodigo(it.codigo));

    /* ---- revisar lo que se leyó ---- */
    function revisar(it, esNuevo) {
      const m = openModal({
        title: esNuevo ? 'Revisa el producto' : 'Editar producto',
        body: `<div class="stack">
          <img src="${it.thumb}" alt="Recorte marcado" class="imp-recorte">
          ${existente(it) ? `<div class="banner">${icon('alert')}<span class="small">Ya tienes un producto con este código de Tupperware. Si lo agregas, se omite al importar.</span></div>` : ''}
          <label class="field">Código de Tupperware<input class="input" id="rvCodigo" value="${esc(it.codigo)}" maxlength="30" placeholder="Ej.: D-702C"></label>
          <label class="field">Nombre *<input class="input" id="rvNombre" value="${esc(it.nombre)}" maxlength="120" autofocus></label>
          <label class="field">Descripción <span class="hint">opcional</span><input class="input" id="rvDesc" value="${esc(it.descripcion)}" maxlength="300"></label>
          <label class="field">Precio del catálogo <span class="hint">solo de referencia; tu precio lo pones después</span><input class="input" id="rvPrecio" type="number" inputmode="decimal" step="0.01" min="0" value="${it.precio_catalogo ?? ''}"></label>
          <details><summary class="small muted">Texto que se leyó</summary><p class="small muted" style="margin-top:6px">${esc(it.crudo || '')}</p></details></div>`,
        footer: `<button type="button" class="btn secondary" data-no>${esNuevo ? 'Descartar' : 'Cancelar'}</button><button type="button" class="btn" data-ok>${esNuevo ? 'Agregar a la lista' : 'Guardar'}</button>`
      });
      const leer = () => ({ codigo: m.body.querySelector('#rvCodigo').value.trim(), nombre: m.body.querySelector('#rvNombre').value.trim(), descripcion: m.body.querySelector('#rvDesc').value.trim(), precio_catalogo: m.body.querySelector('#rvPrecio').value === '' ? null : Number(m.body.querySelector('#rvPrecio').value) });
      m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
      const ok = () => {
        const v = leer();
        if (!v.nombre) { m.body.querySelector('#rvNombre').focus(); return toast('Falta el nombre.', { error: true }); }
        Object.assign(it, v);
        if (esNuevo) items.push(it);
        guardar(); pintarLista(); pintarCajas(); m.close();
      };
      m.foot.querySelector('[data-ok]').addEventListener('click', ok);
      m.body.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    }

    /* ---- marcar un producto con el dedo o el mouse ---- */
    let ini = null;
    const pos = (e) => { const r = lienzo.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
    lienzo.addEventListener('pointerdown', (e) => { if (!marcar || ocupado || e.button > 0) return; ini = pos(e); try { lienzo.setPointerCapture(e.pointerId); } catch (_) {} goma.hidden = false; dibujarGoma(ini); });
    lienzo.addEventListener('pointermove', (e) => { if (ini) dibujarGoma(pos(e)); });
    const dibujarGoma = (p) => { const x = Math.min(ini.x, p.x), y = Math.min(ini.y, p.y); Object.assign(goma.style, { left: x * 100 + '%', top: y * 100 + '%', width: Math.abs(p.x - ini.x) * 100 + '%', height: Math.abs(p.y - ini.y) * 100 + '%' }); };
    lienzo.addEventListener('pointerup', async (e) => {
      if (!ini) return; const p = pos(e); const r = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.abs(p.x - ini.x), h: Math.abs(p.y - ini.y) }; ini = null; goma.hidden = true;
      if (r.w < 0.04 || r.h < 0.02) return toast('Marca un recuadro más grande sobre el texto del producto.', { ms: 2600 });
      await procesar(r);
    });
    lienzo.addEventListener('pointercancel', () => { ini = null; goma.hidden = true; });

    async function procesar(r) {
      if (!img.naturalWidth) return toast('La página todavía está cargando.', { error: true });
      ocupado = true; g('#impLeyendo').hidden = false;
      try {
        const px = { x: Math.round(r.x * img.naturalWidth), y: Math.round(r.y * img.naturalHeight), w: Math.round(r.w * img.naturalWidth), h: Math.round(r.h * img.naturalHeight) };
        const leido = await APP.ocrLeer(img, px);
        const t = document.createElement('canvas'); const k = Math.min(1, 220 / px.w); t.width = Math.round(px.w * k); t.height = Math.round(px.h * k);
        t.getContext('2d').drawImage(img, px.x, px.y, px.w, px.h, 0, 0, t.width, t.height);
        revisar({ pagina: n, x: r.x, y: r.y, w: r.w, h: r.h, thumb: t.toDataURL('image/jpeg', 0.8), ...leido }, true);
      } catch (e) {
        console.error(e);
        toast(/tainted|Security|cross/i.test(String(e)) ? 'El navegador no deja leer esa imagen. Avísame para revisarlo.' : 'No se pudo leer el texto. Intenta marcar otra vez.', { error: true, ms: 5000 });
      } finally { ocupado = false; g('#impLeyendo').hidden = true; }
    }

    /* ---- controles ---- */
    g('#impPrev').addEventListener('click', () => irA(n - 1));
    g('#impNext').addEventListener('click', () => irA(n + 1));
    g('#impNum').addEventListener('change', (e) => irA(parseInt(e.target.value, 10)));
    g('#impMas').addEventListener('click', () => { zoom = Math.min(3, +(zoom + 0.6).toFixed(1)); aplicarZoom(); });
    g('#impMenos').addEventListener('click', () => { zoom = Math.max(1, +(zoom - 0.6).toFixed(1)); aplicarZoom(); });
    g('#impMarcar').addEventListener('click', (e) => {
      marcar = !marcar; e.currentTarget.setAttribute('aria-pressed', String(marcar)); lienzo.classList.toggle('mover', !marcar);
      g('#impAyuda').textContent = marcar ? 'Arrastra un recuadro sobre el texto de un producto: su código, su nombre y su precio.' : 'Modo mover: desliza la página. Toca «Marcar» para volver a marcar productos.';
    });
    g('#impCerrar').addEventListener('click', async () => { if (items.length && !await confirmDialog({ title: 'Salir del importador', message: `Tienes ${items.length} productos en la lista. Se guardan para que sigas después. ¿Salir?`, okLabel: 'Salir' })) return; cerrar(); });
    g('#impVaciar').addEventListener('click', async () => { if (items.length && await confirmDialog({ title: 'Vaciar la lista', message: '¿Quitar todos los productos marcados?', okLabel: 'Vaciar', danger: true })) { items = []; guardar(); pintarLista(); pintarCajas(); } });
    g('#impImportar').addEventListener('click', async () => {
      const nuevos = items.filter((it) => !existente(it));
      if (!await confirmDialog({ title: 'Importar productos', message: `Se crearán ${nuevos.length} productos como borradores (ocultos, sin precio de venta ni foto).${items.length > nuevos.length ? ` Se omiten ${items.length - nuevos.length} que ya existen.` : ''}`, okLabel: 'Importar' })) return;
      const btn = g('#impImportar'); btn.disabled = true; btn.textContent = 'Importando…';
      try {
        await API.importarProductos(catalogo.id, nuevos);
        items = []; guardar(); await APP.refreshCore(); cerrar();
        toast(`${nuevos.length} productos importados. Falta ponerles precio y foto.`, { ms: 7000, action: { label: 'Completar ahora', fn: () => APP.go('pendientes') } });
        APP.render();
      } catch (e) { APP.handleErr(e); btn.disabled = false; pintarLista(); }
    });
    const teclas = (e) => {
      if (document.querySelector('.overlay') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'ArrowRight') irA(n + 1); else if (e.key === 'ArrowLeft') irA(n - 1);
    };
    document.addEventListener('keydown', teclas);

    aplicarZoom(); irA(1); pintarLista();
    // se prepara el lector mientras se mira la primera página
    U.loadScript('vendor/ocr/tesseract.min.js').catch(() => {});
  };

  /* =====================================================================
     PENDIENTES DE COMPLETAR
     ===================================================================== */
  P.pendientes = async function (main) {
    const [zonas] = await Promise.all([API.zonasProductos().catch(() => [])]);
    const catIds = [...new Set(zonas.map((z) => z.catalogo_id))];
    const paginasPor = {};
    await Promise.all(catIds.map(async (id) => { try { (await API.paginasCatalogo(id)).forEach((p) => { paginasPor[id + ':' + p.numero] = p; }); } catch (_) {} }));
    const zonaDe = (pid) => zonas.find((z) => z.producto_id === pid);
    let filtro = 'todos';

    const paint = () => {
      const todos = APP.pendientes();
      const lista = todos.filter((p) => filtro === 'todos' || (filtro === 'precio' && !(p.precio > 0)) || (filtro === 'foto' && !p.fotos.length));
      main.innerHTML = `
        <div class="page-head"><div><h1>Pendientes de completar</h1><p class="sub">${todos.length ? `${todos.length} ${todos.length === 1 ? 'producto espera' : 'productos esperan'} su precio o su foto.` : 'Todo al día.'}</p></div></div>
        <div class="chips" role="group" aria-label="Filtro">${[['todos', 'Todos'], ['precio', 'Falta precio'], ['foto', 'Falta foto']].map(([k, l]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${filtro === k}">${l}</button>`).join('')}</div>
        ${lista.length ? `<div class="stack">${lista.map(tarjeta).join('')}</div>` : `<div class="card empty">${icon('check', 'lg')}<p>${todos.length ? 'No hay productos con ese filtro.' : 'No hay productos pendientes. Los que importes del catálogo aparecen aquí hasta que tengan precio y foto.'}</p></div>`}`;
      main.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; paint(); }));
      main.querySelectorAll('.pend').forEach(enlazar);
    };

    function recorte(p) {
      const z = zonaDe(p.id), pg = z && paginasPor[z.catalogo_id + ':' + z.pagina];
      if (!z || !pg) return `<div class="pend-ref vacio">${icon('image')}<span class="xs">Sin referencia</span></div>`;
      const ancho = (pg.ancho || 867) * z.w, alto = (pg.alto || 1218) * z.h;
      return `<div class="pend-ref" style="aspect-ratio:${ancho} / ${alto};background-image:url('${esc(pg.url_imagen)}');background-size:${100 / z.w}% ${100 / z.h}%;background-position:${z.w >= 1 ? 0 : z.x / (1 - z.w) * 100}% ${z.h >= 1 ? 0 : z.y / (1 - z.h) * 100}%" role="img" aria-label="Recorte del catálogo"></div>`;
    }
    function tarjeta(p) {
      return `<section class="card pend" data-id="${esc(p.id)}">
        ${recorte(p)}
        <div class="stack-sm" style="min-width:0">
          <div><h3>${esc(p.nombre)}</h3><p class="xs muted">${esc(p.codigo)}${p.codigo_tupperware ? ' · Tupperware ' + esc(p.codigo_tupperware) : ''}${p.precio_catalogo != null ? ' · catálogo $' + p.precio_catalogo : ''}</p>
            <div class="row wrap" style="gap:6px;margin-top:4px">${p.precio > 0 ? '' : '<span class="pill bad">Falta precio</span>'}${p.fotos.length ? '' : '<span class="pill warn">Falta foto</span>'}</div></div>
          <div class="grid-2">
            <label class="field">Tu precio (Q)<input class="input" data-precio type="number" inputmode="decimal" min="0" step="0.01" value="${p.precio > 0 ? p.precio : ''}" placeholder="0.00"></label>
            <label class="field">Cantidad<input class="input" data-cant type="number" inputmode="numeric" min="0" value="${p.cantidad}"></label>
          </div>
          <label class="field">Enlace de la foto<div class="foto-link" style="grid-template-columns:48px 1fr"><div class="prev" data-prev style="width:48px;height:48px">${p.fotos[0] ? U.imgTag(p.fotos[0], '') : icon('image')}</div><div><input class="input" data-url type="url" inputmode="url" placeholder="https://…" value="${esc(p.fotos[0] || '')}"><div class="msg" data-msg hidden></div></div></div></label>
          <div class="row wrap"><button type="button" class="btn sm" data-guardar>Guardar</button>${p.activo ? '' : '<span class="xs muted">Está oculto hasta que tenga precio.</span>'}</div>
        </div></section>`;
    }
    function enlazar(card) {
      const p = APP.prod(card.dataset.id);
      const inp = card.querySelector('[data-url]'), prev = card.querySelector('[data-prev]'), msg = card.querySelector('[data-msg]');
      let urlOk = !!p.fotos[0];
      const revisarUrl = U.debounce(() => {
        const raw = inp.value.trim(); msg.hidden = true; inp.classList.remove('bad');
        if (!raw) { urlOk = false; prev.innerHTML = icon('image'); return; }
        const url = U.imageUrl(raw);
        if (!U.validUrl(url)) { urlOk = false; msg.textContent = 'Debe empezar con https://'; msg.hidden = false; inp.classList.add('bad'); return; }
        const im = new Image(); im.referrerPolicy = 'no-referrer';
        im.onload = () => { urlOk = true; prev.innerHTML = ''; prev.appendChild(im); im.style.cssText = 'width:100%;height:100%;object-fit:cover'; };
        im.onerror = () => { urlOk = false; msg.textContent = 'No se pudo cargar. Usa el enlace directo de la imagen.'; msg.hidden = false; inp.classList.add('bad'); prev.innerHTML = icon('alert'); };
        im.src = url;
      }, 350);
      inp.addEventListener('input', revisarUrl);
      const guardar = async () => {
        const precio = parseFloat(card.querySelector('[data-precio]').value) || 0;
        const cantidad = parseInt(card.querySelector('[data-cant]').value, 10) || 0;
        const raw = inp.value.trim(), url = raw ? U.imageUrl(raw) : '';
        if (raw && !U.validUrl(url)) { inp.focus(); return toast('El enlace de la foto debe empezar con https://', { error: true }); }
        if (!precio && !url) return toast('Escribe al menos el precio o el enlace de la foto.', { error: true });
        const btn = card.querySelector('[data-guardar]'); btn.disabled = true;
        try {
          await API.saveProducto({ ...p, precio, cantidad, fotos: url ? [url] : [], activo: precio > 0 ? true : p.activo });
          await APP.refreshCore();
          toast(precio > 0 && url ? `«${p.nombre}» listo` : 'Guardado');
          paint();
        } catch (e) { btn.disabled = false; APP.handleErr(e); }
      };
      card.querySelector('[data-guardar]').addEventListener('click', guardar);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } });
    }
    paint();
  };
})();
