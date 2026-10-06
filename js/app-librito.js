/* Librito digital: visor del catálogo con páginas que se voltean (usa StPageFlip, guardado en vendor/).
   Lo usan dos sitios: la página pública del enlace (?c=...) y la vista previa dentro del panel.
   Las imágenes de las páginas se cargan solo cuando se acercan, para que abra rápido en el teléfono. */
(function () {
  'use strict';
  const { icon, esc, toast } = U;
  const APP = window.APP;
  const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* data = { catalogo:{id,titulo}, paginas:[{numero,url_imagen,ancho,alto}], config:{whatsapp,nombre_negocio}, enlace }
     opts = { onClose } → si viene, se muestra el botón de cerrar (vista previa en el panel) */
  APP.montarLibrito = async function (host, data, opts = {}) {
    const paginas = data.paginas.slice().sort((a, b) => a.numero - b.numero);
    const total = paginas.length;
    const titulo = data.catalogo.titulo;
    const wa = String((data.config && data.config.whatsapp) || '').replace(/\D/g, '');
    const negocio = (data.config && data.config.nombre_negocio) || 'Vedith Variedades';

    host.innerHTML = `
      <div class="lb" role="region" aria-label="Catálogo ${esc(titulo)}">
        <header class="lb-top">
          <img class="lb-logo" src="assets/logo-pequeno.png" alt="${esc(negocio)}">
          <div class="lb-title ellipsis">${esc(titulo)}</div>
          <button type="button" class="icon-btn lb-btn" id="lbShare" aria-label="Compartir catálogo">${icon('share')}</button>
          ${document.fullscreenEnabled ? `<button type="button" class="icon-btn lb-btn" id="lbFull" aria-label="Pantalla completa">${icon('expand')}</button>` : ''}
          ${opts.onClose ? `<button type="button" class="icon-btn lb-btn" id="lbClose" aria-label="Cerrar">${icon('x')}</button>` : ''}
        </header>
        <div class="lb-stage"><div class="lb-cargando" id="lbCargando">Abriendo el catálogo…</div><div class="lb-book" id="lbBook"></div></div>
        <footer class="lb-bar">
          <button type="button" class="lb-nav" id="lbPrev" aria-label="Página anterior">${icon('back')}</button>
          <div class="lb-pos" id="lbPos" aria-live="polite">Portada</div>
          <button type="button" class="lb-nav" id="lbNext" aria-label="Página siguiente">${icon('chevron')}</button>
          <button type="button" class="lb-pill" id="lbZoom">${icon('search', 'sm')} Ampliar</button>
          ${wa ? `<a class="lb-pill wa" id="lbWa" target="_blank" rel="noopener" href="#">${icon('chat', 'sm')} Preguntar</a>` : ''}
        </footer>
      </div>`;
    const g = (s) => host.querySelector(s);

    try { await U.loadScript('vendor/page-flip.browser.js'); } catch (e) { g('#lbCargando').textContent = 'No se pudo abrir el catálogo. Revisa tu internet e intenta otra vez.'; return { destroy() {} }; }

    const book = g('#lbBook');
    const els = paginas.map((p, i) => {
      const d = document.createElement('div');
      d.className = 'lb-page';
      d.dataset.density = i === 0 || i === total - 1 ? 'hard' : 'soft';
      d.innerHTML = '<img alt="" draggable="false" decoding="async">';
      d.firstChild.dataset.src = p.url_imagen;
      d.firstChild.alt = `Página ${i + 1} de ${total}`;
      return d;
    });
    const cargar = (centro) => {
      for (let i = Math.max(0, centro - 3); i <= Math.min(total - 1, centro + 6); i++) {
        const im = els[i].firstChild;
        if (!im.src && im.dataset.src) im.src = im.dataset.src;
      }
    };
    cargar(0);

    // Proporción real de las páginas (la primera de adentro)
    const ref = paginas[1] || paginas[0];
    const bw = ref.ancho || 433, bh = ref.alto || 609;
    const flip = new St.PageFlip(book, {
      width: bw, height: bh, size: 'stretch', minWidth: 300, maxWidth: 1100, minHeight: 280, maxHeight: 1600,
      showCover: true, usePortrait: true, mobileScrollSupport: false, drawShadow: !reducir(), maxShadowOpacity: .5,
      flippingTime: reducir() ? 1 : 650, disableFlipByClick: true, swipeDistance: 28, startPage: 0, autoSize: true
    });
    flip.loadFromHTML(els);
    g('#lbCargando').hidden = true;

    const actual = () => flip.getCurrentPageIndex();
    const horizontal = () => flip.getOrientation() === 'landscape';
    function etiqueta() {
      const i = actual();
      if (i === 0) return `Portada · ${total} páginas`;
      if (i === total - 1) return 'Contraportada';
      if (horizontal() && i + 1 < total - 1 + 0) return `Páginas ${i + 1}–${Math.min(i + 2, total)} de ${total}`;
      return `Página ${i + 1} de ${total}`;
    }
    function actualizar() {
      const i = actual(); cargar(i);
      g('#lbPos').textContent = etiqueta();
      g('#lbPrev').disabled = i <= 0; g('#lbNext').disabled = i >= total - 1;
      const w = g('#lbWa');
      if (w) w.href = `https://wa.me/${wa.length === 8 ? '502' + wa : wa}?text=${encodeURIComponent(`Hola, vi el catálogo "${titulo}" (página ${i + 1}) y me interesa un producto.`)}`;
    }
    flip.on('flip', actualizar);
    flip.on('changeOrientation', actualizar);
    actualizar();

    g('#lbPrev').addEventListener('click', () => flip.flipPrev());
    g('#lbNext').addEventListener('click', () => flip.flipNext());

    /* ---- ampliar: la página sola, grande, para leer los códigos y precios ---- */
    function ampliar(inicio) {
      let i = Math.max(0, Math.min(total - 1, inicio));
      const ov = document.createElement('div');
      ov.className = 'lb-zoom';
      ov.innerHTML = `<div class="lb-zoom-bar"><button type="button" class="lb-nav" data-z="-1" aria-label="Página anterior">${icon('back')}</button>
        <span class="lb-pos" data-pos></span><button type="button" class="lb-nav" data-z="1" aria-label="Página siguiente">${icon('chevron')}</button>
        <button type="button" class="lb-nav" data-zc aria-label="Cerrar la vista ampliada">${icon('x')}</button></div>
        <div class="lb-zoom-body"><img alt="" draggable="false"></div>`;
      const im = ov.querySelector('img'), pos = ov.querySelector('[data-pos]');
      const mostrar = () => { im.src = paginas[i].url_imagen; im.alt = `Página ${i + 1}`; pos.textContent = `Página ${i + 1} de ${total}`; ov.querySelector('.lb-zoom-body').scrollTo(0, 0); };
      const cerrar = () => { ov.remove(); document.removeEventListener('keydown', tecla, true); };
      const tecla = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
        else if (e.key === 'ArrowRight') { i = Math.min(total - 1, i + 1); mostrar(); }
        else if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); mostrar(); }
      };
      ov.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => { i = Math.max(0, Math.min(total - 1, i + Number(b.dataset.z))); mostrar(); }));
      ov.querySelector('[data-zc]').addEventListener('click', cerrar);
      document.addEventListener('keydown', tecla, true);
      (host.closest('.lb-overlay') || document.body).appendChild(ov);
      mostrar();
    }
    g('#lbZoom').addEventListener('click', () => ampliar(actual()));
    // Un toque rápido sobre una página (sin arrastrar) también la amplía
    let down = null;
    book.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    book.addEventListener('pointerup', (e) => {
      if (!down) return;
      const mov = Math.hypot(e.clientX - down.x, e.clientY - down.y), dur = Date.now() - down.t; down = null;
      if (mov > 8 || dur > 450) return;
      const pg = e.target.closest && e.target.closest('.lb-page'); if (!pg) return;
      ampliar(els.indexOf(pg) >= 0 ? els.indexOf(pg) : actual());
    });

    /* ---- compartir y pantalla completa ---- */
    g('#lbShare').addEventListener('click', async () => {
      const url = data.enlace;
      try {
        if (navigator.share) await navigator.share({ title: titulo, text: `Mira el catálogo ${titulo}`, url });
        else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
      } catch (e) { if (e && e.name !== 'AbortError') { try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch (_) {} } }
    });
    const bf = g('#lbFull');
    if (bf) bf.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else host.requestFullscreen && host.requestFullscreen().catch(() => {}); });
    const bc = g('#lbClose'); if (bc) bc.addEventListener('click', () => opts.onClose());

    const tecla = (e) => {
      if (document.querySelector('.lb-zoom')) return;
      if (e.key === 'ArrowRight') flip.flipNext(); else if (e.key === 'ArrowLeft') flip.flipPrev();
      else if (e.key === 'Home') flip.turnToPage(0); else if (e.key === 'End') flip.turnToPage(total - 1);
      else if (e.key === 'Escape' && opts.onClose) opts.onClose();
    };
    document.addEventListener('keydown', tecla);
    return { destroy() { document.removeEventListener('keydown', tecla); try { flip.destroy(); } catch (_) {} } };
  };

  /* Vista previa dentro del panel (pantalla completa) */
  APP.verLibrito = async function (catalogo, paginas, enlace) {
    const ov = document.createElement('div');
    ov.className = 'lb-overlay';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    let vista;
    const cerrar = () => { if (vista) vista.destroy(); ov.remove(); document.body.style.overflow = ''; };
    vista = await APP.montarLibrito(ov, { catalogo, paginas, config: APP.config, enlace }, { onClose: cerrar });
  };

  /* Página pública del enlace: ?c=<id> o ?c=vigente. No pide PIN. */
  APP.renderCatalogoPublico = async function (clave) {
    const root = document.getElementById('root');
    root.innerHTML = '<div class="lb-pagina"><div class="lb-cargando" style="position:static;padding:80px 0">Abriendo el catálogo…</div></div>';
    let r = null;
    try { r = await API.catalogoPublico(clave); } catch (e) { console.error(e); }
    if (!r || !r.catalogo || !r.paginas.length) {
      root.innerHTML = `<div class="public"><div class="public-card"><div class="top"><img src="assets/logo-pequeno.png" alt="Vedith Variedades"></div>
        <div class="card center stack"><h1>Este catálogo ya no está disponible</h1><p class="muted">Puede que haya terminado su vigencia. Pídenos el catálogo actual.</p>
        ${clave !== 'vigente' ? '<a class="btn" href="?c=vigente">Ver el catálogo vigente</a>' : ''}</div></div></div>`;
      return;
    }
    document.title = `${r.catalogo.titulo} · ${(r.config && r.config.nombre_negocio) || 'Vedith Variedades'}`;
    const base = location.origin + location.pathname;
    API.logScan && API.logScan('catalogo:' + r.catalogo.id);
    const host = document.createElement('div');
    host.className = 'lb-pagina';
    root.innerHTML = ''; root.appendChild(host);
    await APP.montarLibrito(host, { catalogo: r.catalogo, paginas: r.paginas, config: r.config, enlace: `${base}?c=${clave === 'vigente' ? 'vigente' : r.catalogo.id}` });
  };
})();
