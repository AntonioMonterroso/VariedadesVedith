/* Catálogos (solo administración): subir un PDF, convertirlo en librito, publicarlo, compartirlo
   y archivarlo. El PDF se convierte aquí mismo, en el navegador (pdf.js); solo se suben las
   imágenes de las páginas. Al archivar se borran esas imágenes y queda un registro mínimo. */
(function () {
  'use strict';
  const { icon, esc, toast, openModal, confirmDialog, fmtDate } = U;
  const APP = window.APP;
  const P = APP.pages;
  const MAX_LADO = 1800;      // píxeles del lado más largo de cada página
  const CALIDAD = 0.82;       // calidad JPEG: ~150 a 250 KB por página

  const enlace = (clave) => {
    const b = APP.baseUrl();
    return b + (b.endsWith('/') || /\.html?$/.test(b) ? '' : '/') + '?c=' + encodeURIComponent(clave);
  };

  /* =====================================================================
     Pantalla: lista de catálogos
     ===================================================================== */
  P.catalogos = async function (main) {
    let lista, archivados;
    try { [lista, archivados] = await Promise.all([API.catalogos(), API.catalogosArchivados()]); }
    catch (e) {
      // Las tablas de catálogos todavía no existen en Supabase: se explica qué falta en vez de un error genérico
      if (/PGRST205|schema cache|does not exist|42P01/i.test((e.code || '') + ' ' + (e.message || ''))) {
        main.innerHTML = `<div class="page-head"><div><h1>Catálogos</h1></div></div>
          <div class="card stack center">${icon('alert', 'lg')}<h2>Falta un paso en Supabase</h2>
          <p class="muted">Para usar los catálogos hay que crear sus tablas una sola vez. En Supabase abre <b>SQL Editor</b>, pega todo el archivo <b>migracion_catalogos.sql</b> (está en el repositorio) y toca <b>Run</b>. Luego vuelve aquí.</p>
          <button type="button" class="btn" onclick="location.reload()">Ya lo hice, volver a cargar</button></div>`;
        return;
      }
      throw e;
    }
    main.innerHTML = `
      <div class="page-head"><div><h1>Catálogos</h1><p class="sub">Sube el PDF y compártelo como un librito.</p></div><button type="button" class="btn" id="cNuevo">${icon('plus')} Catálogo</button></div>
      ${lista.length ? `<div class="stack">${lista.map((c) => `
        <section class="card cat-card" data-id="${esc(c.id)}">
          <div class="cat-portada">${c.portada_url ? U.imgTag(c.portada_url, '') : U.placeholder('Sin portada')}</div>
          <div class="stack-sm" style="min-width:0">
            <h3 class="ellipsis">${esc(c.titulo)}</h3>
            <div class="row wrap" style="gap:6px"><span class="pill">${c.paginas} páginas</span>
              <span class="pill ${c.publicado ? 'ok' : 'warn'}">${c.publicado ? 'Publicado' : 'Borrador'}</span>
              ${c.vigente ? '<span class="pill pink">Vigente</span>' : ''}</div>
            <p class="xs faint">Subido el ${fmtDate(c.created_at)}</p>
            <div class="row wrap">
              <button type="button" class="btn secondary sm" data-a="ver">${icon('book', 'sm')} Ver</button>
              <button type="button" class="btn sm" data-a="compartir">${icon('share', 'sm')} Compartir</button>
            </div>
            <div class="row wrap">
              <button type="button" class="btn ghost sm" data-a="publicar">${c.publicado ? 'Dejar de publicar' : 'Publicar'}</button>
              ${c.vigente ? '' : '<button type="button" class="btn ghost sm" data-a="vigente">Marcar vigente</button>'}
              <button type="button" class="btn ghost sm" data-a="archivar" style="color:var(--red-600)">${icon('trash', 'sm')} Archivar y borrar</button>
            </div>
          </div>
        </section>`).join('')}</div>`
        : `<div class="card empty">${icon('book', 'lg')}<p>Aún no hay catálogos. Sube el PDF de la campaña y se convierte en un librito para compartir por WhatsApp.</p><button type="button" class="btn" id="cVacio">Subir mi primer catálogo</button></div>`}
      <section class="stack-sm" style="margin-top:28px"><h2>Catálogos archivados</h2>
        ${archivados.length ? `<div class="list">${archivados.map((a) => `<div class="item"><span class="grow"><div class="t1">${esc(a.titulo)}</div><div class="t2">${a.paginas} hojas · archivado el ${fmtDate(a.archivado_el)}</div></span>
          <button type="button" class="icon-btn" data-reg="${esc(a.id)}" aria-label="Quitar de la lista">${icon('x')}</button></div>`).join('')}</div>`
          : '<p class="muted small">Cuando archives un catálogo quedará aquí solo su nombre y su número de hojas.</p>'}</section>`;

    main.querySelector('#cNuevo').addEventListener('click', () => nuevoCatalogo());
    const v = main.querySelector('#cVacio'); if (v) v.addEventListener('click', () => nuevoCatalogo());
    main.querySelectorAll('.cat-card').forEach((card) => {
      const c = lista.find((x) => x.id === card.dataset.id);
      const on = (a, fn) => card.querySelector(`[data-a="${a}"]`) && card.querySelector(`[data-a="${a}"]`).addEventListener('click', fn);
      on('ver', async () => { try { const pags = await API.paginasCatalogo(c.id); APP.verLibrito(c, pags, enlace(c.id)); } catch (e) { APP.handleErr(e); } });
      on('compartir', () => compartir(c));
      on('publicar', async () => { try { await API.setCatalogoPublicado(c.id, !c.publicado); toast(c.publicado ? 'Ya no se puede ver con el enlace' : 'Publicado: ya se puede ver con el enlace'); APP.render(); } catch (e) { APP.handleErr(e); } });
      on('vigente', async () => { try { await API.marcarVigente(c.id); toast('Es el catálogo vigente'); APP.render(); } catch (e) { APP.handleErr(e); } });
      on('archivar', () => archivar(c));
    });
    main.querySelectorAll('[data-reg]').forEach((b) => b.addEventListener('click', async () => {
      if (!await confirmDialog({ title: 'Quitar de la lista', message: 'Se quita este registro de la lista de archivados.', okLabel: 'Quitar', danger: true })) return;
      try { await API.eliminarRegistroArchivado(b.dataset.reg); APP.render(); } catch (e) { APP.handleErr(e); }
    }));
  };

  /* ---------- compartir ---------- */
  function compartir(c) {
    const lnk = enlace(c.id), vig = enlace('vigente');
    const m = openModal({
      title: 'Compartir catálogo',
      body: `<div class="stack">
        ${c.publicado ? '' : `<div class="banner">${icon('alert')}<span class="small">Este catálogo está en <b>borrador</b>: quien abra el enlace verá que no está disponible. Publícalo primero.</span></div>`}
        ${APP.baseUrlEsLocal() ? `<div class="banner">${icon('alert')}<span class="small">El enlace apunta a una dirección de prueba. Pon la dirección real de la app en Ajustes.</span></div>` : ''}
        <div class="center stack-sm"><div id="cqr" style="display:grid;place-items:center;background:#fff;border-radius:16px;padding:14px;margin:0 auto"></div>
          <p class="small muted" style="word-break:break-all">${esc(lnk)}</p></div>
        <div class="row wrap"><button type="button" class="btn secondary" data-copiar>${icon('copy')} Copiar enlace</button>
          <a class="btn green" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Mira nuestro catálogo ${c.titulo}: ${lnk}`)}">${icon('chat')} Enviar por WhatsApp</a></div>
        ${c.vigente ? `<div class="card flat stack-sm"><b>Enlace que siempre abre el catálogo vigente</b><p class="small muted">Úsalo en tu perfil o en un QR impreso: cuando cambies de campaña, el mismo enlace muestra el catálogo nuevo.</p>
          <p class="small" style="word-break:break-all">${esc(vig)}</p><button type="button" class="btn secondary sm" data-copiar-vig>${icon('copy', 'sm')} Copiar este enlace</button></div>` : ''}
      </div>`
    });
    APP.makeQR(m.body.querySelector('#cqr'), lnk, 200);
    m.body.querySelector('[data-copiar]').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(lnk); toast('Enlace copiado'); });
    const cv = m.body.querySelector('[data-copiar-vig]'); if (cv) cv.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(vig); toast('Enlace copiado'); });
  }

  /* ---------- archivar y borrar ---------- */
  async function archivar(c) {
    const ok = await confirmDialog({
      title: 'Archivar y borrar',
      message: `Se borrarán las ${c.paginas} páginas de "${c.titulo}" y el enlace dejará de funcionar. Solo quedará anotado su nombre y que tenía ${c.paginas} hojas. Tu inventario y las fotos de tus productos no se tocan.`,
      okLabel: 'Archivar y borrar', danger: true
    });
    if (!ok) return;
    try { toast('Borrando páginas…'); await API.archivarCatalogo(c.id); toast('Catálogo archivado'); APP.render(); } catch (e) { APP.handleErr(e); }
  }

  /* =====================================================================
     Subir un PDF
     ===================================================================== */
  async function cargarPdfjs() {
    await U.loadScript('vendor/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    return window.pdfjsLib;
  }

  function nuevoCatalogo() {
    const m = openModal({
      title: 'Subir catálogo', wide: true,
      body: `<div class="stack" id="nc">
        <label class="field">Nombre del catálogo *<input class="input" id="ncTitulo" maxlength="80" placeholder="Ej.: Tupper Tips 11 · octubre 2026" autofocus></label>
        <label class="field">Archivo PDF *<input class="input" id="ncArchivo" type="file" accept="application/pdf,.pdf"><span class="hint">Se convierte en tu teléfono o computadora; el PDF original no se sube.</span></label>
        <p class="small muted">Las páginas dobles (dos hojas juntas) se parten en dos para que se lean bien en el celular. Antes de subir podrás revisar cada una.</p>
      </div>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok>Continuar</button>'
    });
    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const titulo = m.body.querySelector('#ncTitulo').value.trim();
      const file = m.body.querySelector('#ncArchivo').files[0];
      if (!titulo) { m.body.querySelector('#ncTitulo').focus(); return toast('Ponle un nombre al catálogo.', { error: true }); }
      if (!file) return toast('Elige el archivo PDF.', { error: true });
      if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) return toast('Ese archivo no es un PDF.', { error: true });
      m.foot.querySelector('[data-ok]').disabled = true;
      try { await revisar(m, titulo, file); } catch (e) { console.error(e); toast('No se pudo leer ese PDF.', { error: true }); m.foot.querySelector('[data-ok]').disabled = false; }
    });
    return m;
  }
  APP.nuevoCatalogo = nuevoCatalogo;

  /* Paso 2: revisar páginas (cada hoja del PDF: dividir, dejar sola o girar) */
  async function revisar(m, titulo, file) {
    const pdfjs = await cargarPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const N = doc.numPages;
    const modos = [];
    const body = m.body;
    body.innerHTML = `<div class="stack"><p class="muted">Se ve así tu PDF. Revisa que cada hoja tenga la opción correcta.</p>
      <div class="banner info">${icon('info')}<span class="small"><b>Dividir</b>: hoja con dos páginas. <b>Una página</b>: portada, contraportada o página suelta. <b>Girar</b>: si se ve de lado, gírala hasta que quede derecha.</span></div>
      <div class="rev-grid" id="revGrid"></div><p class="small muted" id="revResumen" aria-live="polite"></p></div>`;
    m.foot.innerHTML = '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok>Subir catálogo</button>';
    const grid = body.querySelector('#revGrid');
    const OPC = [['dividir', 'Dividir en 2'], ['una', 'Una página'], ['der', 'Girar ↻'], ['izq', 'Girar ↺']];

    // 1) Se muestran todas las hojas enseguida; 2) las miniaturas se dibujan después, sin bloquear.
    const miniaturas = [];
    let cerrado = false;
    for (let n = 1; n <= N; n++) {
      const page = await doc.getPage(n);
      const vp1 = page.getViewport({ scale: 1 });
      modos[n] = n === 1 || n === N || vp1.width / vp1.height < 0.9 ? 'una' : 'dividir';
      const card = document.createElement('div');
      card.className = 'rev-card';
      card.innerHTML = `<canvas aria-label="Hoja ${n}" style="aspect-ratio:${vp1.width} / ${vp1.height}"></canvas><div class="rev-n">Hoja ${n}</div>
        <select class="input" aria-label="Qué hacer con la hoja ${n}">${OPC.map(([k, l]) => `<option value="${k}" ${modos[n] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      grid.appendChild(card);
      const cv = card.querySelector('canvas');
      const dibujarMini = async (extra) => {
        if (cerrado) return;
        const vp = page.getViewport({ scale: 0.3, rotation: (page.rotate + extra) % 360 });
        cv.width = vp.width; cv.height = vp.height; cv.style.aspectRatio = `${vp.width} / ${vp.height}`;
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      };
      miniaturas.push(() => dibujarMini(0));
      card.querySelector('select').addEventListener('change', async (e) => {
        modos[n] = e.target.value;
        await dibujarMini(modos[n] === 'der' ? 90 : modos[n] === 'izq' ? 270 : 0).catch(() => {});
        resumen();
      });
    }
    (async () => { for (const f of miniaturas) { if (cerrado) break; try { await f(); } catch (_) {} } })();
    const resumen = () => { body.querySelector('#revResumen').textContent = `Quedarán ${planear(modos, N).length} páginas en el librito.`; };
    resumen();
    m.foot.querySelector('[data-no]').addEventListener('click', () => { cerrado = true; doc.destroy(); m.close(); });
    m.foot.querySelector('[data-ok]').addEventListener('click', () => { cerrado = true; subir(m, titulo, doc, modos); });
  }

  /* Orden final de las páginas. Con portada sola al inicio, las páginas se agrupan de dos en dos;
     una página suelta en medio lleva al lado una página de contacto para no desacomodar las demás. */
  function planear(modos, N) {
    const plan = [];
    const relleno = () => plan.push({ relleno: true });
    for (let n = 1; n <= N; n++) {
      const modo = modos[n];
      if (modo === 'dividir') { plan.push({ pdf: n, parte: 'izq' }); plan.push({ pdf: n, parte: 'der' }); continue; }
      const rot = modo === 'der' ? 90 : modo === 'izq' ? 270 : 0;
      if (n === 1) { plan.push({ pdf: n, parte: 'completa', rot }); continue; }
      if (n === N) { if (plan.length % 2 === 0) relleno(); plan.push({ pdf: n, parte: 'completa', rot }); continue; }
      if (plan.length % 2 === 0) relleno();           // que caiga en el lado izquierdo
      plan.push({ pdf: n, parte: 'completa', rot });
      relleno();                                      // y su lado derecho no queda vacío
    }
    return plan.map((p, i) => ({ ...p, numero: i + 1 }));
  }

  const aBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', CALIDAD));

  /* Página de contacto que ocupa el lugar de una hoja suelta en medio del catálogo */
  async function paginaRelleno(ancho, alto) {
    const cv = document.createElement('canvas'); cv.width = ancho; cv.height = alto;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, alto); g.addColorStop(0, '#F7FBFA'); g.addColorStop(1, '#DDF1EF');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ancho, alto);
    const logo = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = 'assets/logo-pequeno.png'; });
    if (logo) { const h = alto * 0.34, w = h * logo.width / logo.height; ctx.drawImage(logo, (ancho - w) / 2, alto * 0.18, w, h); }
    ctx.textAlign = 'center'; ctx.fillStyle = '#16302F';
    ctx.font = `600 ${ancho * 0.07}px Fraunces, Georgia, serif`;
    ctx.fillText(APP.config.nombre_negocio || 'Vedith Variedades', ancho / 2, alto * 0.64);
    ctx.fillStyle = '#48605F'; ctx.font = `700 ${ancho * 0.036}px "Nunito Sans", sans-serif`;
    ctx.fillText('Distribuidor independiente de Tupperware', ancho / 2, alto * 0.70);
    if (APP.config.whatsapp) { ctx.fillStyle = '#0E7C7B'; ctx.font = `800 ${ancho * 0.05}px "Nunito Sans", sans-serif`; ctx.fillText(`WhatsApp ${APP.config.whatsapp}`, ancho / 2, alto * 0.80); }
    return cv;
  }

  /* Paso 3: convertir y subir */
  async function subir(m, titulo, doc, modos) {
    const N = doc.numPages;
    const plan = planear(modos, N);
    let cancelado = false;
    m.body.innerHTML = `<div class="stack center"><h2>Subiendo tu catálogo…</h2>
      <div class="barra"><div class="barra-fill" id="bf"></div></div>
      <p class="muted" id="bt" aria-live="polite">Preparando…</p>
      <p class="small faint">No cierres esta ventana. Puede tardar un par de minutos.</p></div>`;
    m.foot.innerHTML = '<button type="button" class="btn secondary" data-cancel>Cancelar</button>';
    m.foot.querySelector('[data-cancel]').addEventListener('click', () => { cancelado = true; m.foot.querySelector('[data-cancel]').disabled = true; });
    const progreso = (i, txt) => { m.body.querySelector('#bf').style.width = Math.round(i / plan.length * 100) + '%'; m.body.querySelector('#bt').textContent = txt; };

    let cat = null; const subidas = []; const pendientes = new Set();
    try {
      cat = await API.crearCatalogo(titulo);
      let cache = { n: 0, canvas: null }; let rellenoCv = null; let hechas = 0;
      for (const item of plan) {
        if (cancelado) throw new Error('CANCELADO');
        progreso(hechas, `Preparando página ${item.numero} de ${plan.length}`);
        let canvas;
        if (item.relleno) { rellenoCv = rellenoCv || await paginaRelleno(866, 1218); canvas = rellenoCv; }
        else {
          if (cache.n !== item.pdf || cache.rot !== item.rot) {
            const page = await doc.getPage(item.pdf);
            const rotacion = (page.rotate + (item.rot || 0)) % 360;
            const vp0 = page.getViewport({ scale: 1, rotation: rotacion });
            const escala = Math.min(2, MAX_LADO / Math.max(vp0.width, vp0.height));
            const vp = page.getViewport({ scale: escala, rotation: rotacion });
            const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
            await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
            cache = { n: item.pdf, rot: item.rot, canvas: cv };
          }
          const src = cache.canvas;
          if (item.parte === 'completa') canvas = src;
          else {
            const mitad = Math.floor(src.width / 2);
            canvas = document.createElement('canvas'); canvas.width = mitad; canvas.height = src.height;
            canvas.getContext('2d').drawImage(src, item.parte === 'izq' ? 0 : src.width - mitad, 0, mitad, src.height, 0, 0, mitad, src.height);
          }
        }
        const blob = await aBlob(canvas);
        // hasta 3 subidas a la vez mientras se prepara la siguiente página
        while (pendientes.size >= 3) await Promise.race([...pendientes]);
        const numero = item.numero, ancho = canvas.width, alto = canvas.height;
        const tarea = API.subirPaginaCatalogo(cat.id, numero, blob).then((r) => { subidas.push({ numero, url: r.url, ruta: r.ruta, ancho, alto }); hechas++; }).finally(() => pendientes.delete(tarea));
        pendientes.add(tarea);
        tarea.catch(() => {});
      }
      await Promise.all([...pendientes]);
      if (subidas.length !== plan.length) throw new Error('Faltaron páginas por subir');
      progreso(plan.length, 'Guardando…');
      subidas.sort((a, b) => a.numero - b.numero);
      await API.guardarPaginasCatalogo(cat.id, subidas);
      doc.destroy();
      m.body.innerHTML = `<div class="receipt"><div class="ok">${icon('check', 'lg')}</div><h2>¡Listo!</h2><p class="muted">Tu catálogo tiene ${plan.length} páginas. Está en borrador: publícalo para compartirlo.</p></div>`;
      m.foot.innerHTML = '<button type="button" class="btn secondary" data-ver>Ver el librito</button><button type="button" class="btn" data-pub>Publicar y compartir</button>';
      m.foot.querySelector('[data-ver]').addEventListener('click', () => { m.close(); APP.render(); APP.verLibrito({ ...cat, titulo, paginas: plan.length }, subidas.map((s) => ({ numero: s.numero, url_imagen: s.url, ancho: s.ancho, alto: s.alto })), enlace(cat.id)); });
      m.foot.querySelector('[data-pub]').addEventListener('click', async () => {
        try { await API.setCatalogoPublicado(cat.id, true); const lista = await API.catalogos(); if (!lista.some((c) => c.vigente)) await API.marcarVigente(cat.id); m.close(); APP.render(); const c2 = (await API.catalogos()).find((c) => c.id === cat.id); compartir(c2); } catch (e) { APP.handleErr(e); }
      });
      APP.render();
    } catch (e) {
      try { doc.destroy(); } catch (_) {}
      if (cat) { try { await API.borrarCatalogoIncompleto(cat.id, subidas.map((s) => s.ruta)); } catch (_) {} }
      if (e.message === 'CANCELADO') { toast('Subida cancelada. No se guardó nada.'); m.close(); return; }
      console.error(e);
      m.body.innerHTML = `<div class="stack center">${icon('alert', 'lg')}<h2>No se pudo subir</h2><p class="muted">${esc(APP.errMsg(e))}</p><p class="small faint">No se guardó nada a medias.</p></div>`;
      m.foot.innerHTML = '<button type="button" class="btn" data-x>Cerrar</button>';
      m.foot.querySelector('[data-x]').addEventListener('click', () => m.close());
    }
  }
})();
