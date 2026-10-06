/* Imágenes para estados de WhatsApp: desde el menú se elige un producto y se genera una imagen
   vertical (1080 × 1920) con su foto, el nombre y el precio normal. Nada más: sin teléfono,
   sin costos, sin códigos. Se dibuja en un <canvas>, sin servidores. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal } = U;
  const APP = window.APP;
  const W = 1080, H = 1920;
  const F_TITULO = "'Fraunces', Georgia, serif";
  const F_TEXTO = "'Nunito Sans', system-ui, sans-serif";

  /* Muchas páginas no dejan usar sus fotos dentro de un canvas (CORS). Se intenta directo y,
     si falla, a través de un servicio público de imágenes (wsrv.nl). Si tampoco se puede,
     se avisa y se puede subir la foto desde el teléfono. */
  function cargarImagen(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const intentar = (src, siguiente) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.referrerPolicy = 'no-referrer';
        im.onload = () => resolve(im);
        im.onerror = () => (siguiente ? intentar(siguiente) : resolve(null));
        im.src = src;
      };
      if (/^(data|blob):/.test(url) || new URL(url, location.href).origin === location.origin) return intentar(url);
      intentar(url, 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=1400&output=jpg');
    });
  }

  function cover(ctx, img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lineas(ctx, texto, maxW, maxLineas) {
    const palabras = String(texto).split(/\s+/).filter(Boolean), out = [];
    let linea = '';
    for (const p of palabras) {
      const prueba = linea ? linea + ' ' + p : p;
      if (ctx.measureText(prueba).width <= maxW || !linea) linea = prueba; else { out.push(linea); linea = p; }
    }
    if (linea) out.push(linea);
    if (out.length > maxLineas) {
      out.length = maxLineas;
      let ult = out[maxLineas - 1];
      while (ctx.measureText(ult + '…').width > maxW && ult.length > 1) ult = ult.slice(0, -1);
      out[maxLineas - 1] = ult.trimEnd() + '…';
    }
    return out;
  }

  const C = { turquesa: '#0E7C7B', turquesaOscuro: '#0A5F5E', coral: '#F26B5B', coralOscuro: '#D9432F', tinta: '#16302F', gris: '#48605F', crema: '#F7FBFA', menta: '#DDF1EF' };
  function parrafo(ctx, texto, x, y, maxW, maxLineas, interlineado, alinear) {
    ctx.textAlign = alinear || 'center';
    const ls = lineas(ctx, texto, maxW, maxLineas);
    ls.forEach((l, i) => ctx.fillText(l, x, y + i * interlineado));
    return y + (ls.length - 1) * interlineado; // y de la última línea
  }
  function pildora(ctx, texto, x, y, alto, fuente, fondo, color, centrar, padX) {
    ctx.font = fuente;
    const ancho = ctx.measureText(texto).width + (padX || 70) * 2;
    const x0 = centrar ? W / 2 - ancho / 2 : x;
    ctx.fillStyle = fondo; rr(ctx, x0, y, ancho, alto, alto / 2); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, x0 + ancho / 2, y + alto / 2 + 4); ctx.textBaseline = 'alphabetic';
  }
  function sinFoto(ctx, x, y, w, h) {
    ctx.fillStyle = C.menta; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.turquesa; ctx.globalAlpha = .35; ctx.font = `700 64px ${F_TEXTO}`; ctx.textAlign = 'center';
    ctx.fillText('Sin foto', x + w / 2, y + h / 2); ctx.globalAlpha = 1;
  }

  // Cada estilo dibuja solo: foto, nombre, precio normal y (si hay) una frase. Nada más.
  const ESTILOS = {
    clasico(ctx, d) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.crema); g.addColorStop(1, C.menta);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(242,107,91,.14)'; ctx.beginPath(); ctx.arc(W - 80, 180, 320, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(14,124,123,.10)'; ctx.beginPath(); ctx.arc(60, 1560, 380, 0, 7); ctx.fill();
      ctx.save(); ctx.shadowColor = 'rgba(22,48,47,.28)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
      ctx.fillStyle = '#fff'; rr(ctx, 90, 230, 900, 900, 64); ctx.fill(); ctx.restore();
      ctx.save(); rr(ctx, 90, 230, 900, 900, 64); ctx.clip();
      if (d.foto) cover(ctx, d.foto, 90, 230, 900, 900); else sinFoto(ctx, 90, 230, 900, 900);
      ctx.restore();
      ctx.fillStyle = C.tinta; ctx.font = `600 88px ${F_TITULO}`;
      const yN = parrafo(ctx, d.nombre, W / 2, 1290, 900, 2, 102);
      pildora(ctx, d.precio, 0, yN + 60, 190, `800 130px ${F_TEXTO}`, C.coral, '#fff', true, 76);
      if (d.frase) { ctx.fillStyle = C.gris; ctx.font = `700 54px ${F_TEXTO}`; parrafo(ctx, d.frase, W / 2, yN + 340, 940, 2, 64); }
    },
    grande(ctx, d) {
      if (d.foto) cover(ctx, d.foto, 0, 0, W, H); else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.turquesa); g.addColorStop(1, C.turquesaOscuro); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      const g = ctx.createLinearGradient(0, 900, 0, H); g.addColorStop(0, 'rgba(8,28,27,0)'); g.addColorStop(.5, 'rgba(8,28,27,.78)'); g.addColorStop(1, 'rgba(8,28,27,.92)');
      ctx.fillStyle = g; ctx.fillRect(0, 900, W, H - 900);
      if (d.frase) pildora(ctx, d.frase, 70, 80, 120, `800 58px ${F_TEXTO}`, 'rgba(255,255,255,.94)', C.tinta, false, 44);
      ctx.fillStyle = '#fff'; ctx.font = `600 104px ${F_TITULO}`;
      const ls = lineas(ctx, d.nombre, 940, 3), alto = 122, base = 1500 - (ls.length - 1) * alto;
      ctx.textAlign = 'left'; ls.forEach((l, i) => ctx.fillText(l, 70, base + i * alto));
      pildora(ctx, d.precio, 70, base + (ls.length - 1) * alto + 60, 210, `800 150px ${F_TEXTO}`, C.coral, '#fff', false, 65);
    },
    oferta(ctx, d) {
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.coral); g.addColorStop(1, C.coralOscuro);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      [[120, 240, 200], [960, 420, 140], [90, 1560, 260], [1000, 1760, 200]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 176px ${F_TEXTO}`;
      ctx.fillText('OFERTA', W / 2, 250);
      if (d.frase) { ctx.font = `700 54px ${F_TEXTO}`; parrafo(ctx, d.frase, W / 2, 336, 940, 2, 62); }
      const cx = W / 2, cy = 860, r = 380;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r + 26, 0, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
      if (d.foto) cover(ctx, d.foto, cx - r, cy - r, r * 2, r * 2); else sinFoto(ctx, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = `600 84px ${F_TITULO}`;
      const y = parrafo(ctx, d.nombre, W / 2, 1400, 920, 2, 98);
      ctx.fillStyle = '#fff'; rr(ctx, 170, y + 56, 740, 230, 115); ctx.fill();
      ctx.fillStyle = C.turquesaOscuro; ctx.font = `800 156px ${F_TEXTO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.precio, W / 2, y + 56 + 122); ctx.textBaseline = 'alphabetic';
    }
  };
  const FRASES = ['Disponible', 'Quedan pocas piezas', 'Entrega inmediata', 'Nuevo', 'Pregúntame por él', 'Ideal para regalar'];

  APP.openEstado = async function (p) {
    const precio = 'Q' + Number(p.precio).toLocaleString('es-GT', { maximumFractionDigits: 2 });
    let estilo = U.lsGet('vedith-estilo-estado', 'clasico'); if (!ESTILOS[estilo]) estilo = 'clasico';
    let frase = '', foto = p.fotos && p.fotos[0] || '', img = null, subida = null, turno = 0;
    const m = openModal({
      title: p.nombre, wide: true,
      body: `
        <div class="estado-prev"><canvas id="esCanvas" width="${W}" height="${H}" aria-label="Vista previa de la imagen"></canvas></div>
        <div class="stack">
          <div class="stack-sm"><span class="small" style="font-weight:800">Estilo</span>
            <div class="seg" role="group" aria-label="Estilo">
              ${[['clasico', 'Clásico'], ['grande', 'Foto grande'], ['oferta', 'Oferta']].map(([k, l]) => `<button type="button" data-st="${k}" aria-pressed="${estilo === k}">${l}</button>`).join('')}
            </div></div>
          <div class="stack-sm"><label class="field">Frase <span class="hint">opcional · sale en la imagen</span>
              <input class="input" id="esFrase" maxlength="50" placeholder="Escribe una frase o toca una de abajo"></label>
            <div class="chips" style="flex-wrap:wrap;overflow:visible">${FRASES.map((f) => `<button type="button" class="chip" data-fr="${esc(f)}" aria-pressed="false">${esc(f)}</button>`).join('')}</div></div>
          <p class="banner bad small" id="esAviso" hidden></p>
          <div class="stack-sm" id="esFotos"></div>
        </div>`,
      footer: `<button type="button" class="btn secondary" id="esDescargar">${icon('download')} Descargar</button><button type="button" class="btn" id="esCompartir">${icon('chat')} Compartir</button>`
    });
    const g = (sel) => m.body.querySelector(sel);
    const canvas = g('#esCanvas'), ctx = canvas.getContext('2d');

    async function pintar() {
      const t = ++turno;
      try { await Promise.all([document.fonts.load('600 60px Fraunces'), document.fonts.load('800 60px "Nunito Sans"'), document.fonts.load('700 60px "Nunito Sans"')]); } catch (_) {}
      if (t !== turno) return;
      ctx.clearRect(0, 0, W, H);
      ESTILOS[estilo](ctx, { nombre: p.nombre, precio, frase: frase.trim(), foto: img });
    }
    m.body.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => {
      estilo = b.dataset.st; U.lsSet('vedith-estilo-estado', estilo);
      m.body.querySelectorAll('[data-st]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pintar();
    }));
    const inp = g('#esFrase');
    const marcarFrases = () => m.body.querySelectorAll('[data-fr]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.fr === frase)));
    inp.addEventListener('input', U.debounce((e) => { frase = e.target.value; marcarFrases(); pintar(); }, 100));
    m.body.querySelectorAll('[data-fr]').forEach((c) => c.addEventListener('click', () => {
      frase = frase === c.dataset.fr ? '' : c.dataset.fr; inp.value = frase; marcarFrases(); pintar();
    }));
    async function ponerFoto(src) {
      foto = src; img = await cargarImagen(src);
      const av = g('#esAviso');
      av.hidden = !(src && !img);
      av.textContent = 'No pude usar esa foto dentro de la imagen (la página de origen no lo permite). Sube la foto desde tu teléfono con el botón «Subir foto».';
      listaFotos(); pintar();
    }
    function listaFotos() {
      const fotos = p.fotos || [];
      g('#esFotos').innerHTML = `<div class="chips" style="flex-wrap:wrap;overflow:visible">
        ${fotos.length > 1 ? fotos.map((f, i) => `<button type="button" class="chip" data-f="${i}" aria-pressed="${foto === f}" style="padding:4px 6px" aria-label="Usar la foto ${i + 1}"><span style="width:44px;height:44px;border-radius:10px;overflow:hidden;display:block">${U.imgTag(f, '')}</span></button>`).join('') : ''}
        <label class="chip">${icon('camera', 'sm')} Subir foto<input type="file" accept="image/*" id="esArchivo" hidden></label></div>`;
      g('#esFotos').querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => ponerFoto(fotos[Number(b.dataset.f)])));
      g('#esArchivo').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        if (subida) URL.revokeObjectURL(subida);
        subida = URL.createObjectURL(f); ponerFoto(subida);
      });
    }

    const nombreArchivo = `estado-${p.codigo}.png`;
    const aBlob = () => new Promise((res) => canvas.toBlob(res, 'image/png'));
    m.foot.querySelector('#esDescargar').addEventListener('click', async () => {
      try { const b = await aBlob(); if (!b) throw new Error('canvas'); U.download(nombreArchivo, b); toast('Imagen descargada'); }
      catch (e) { toast('No se pudo crear la imagen con esa foto. Sube la foto desde tu teléfono.', { error: true, ms: 5000 }); }
    });
    m.foot.querySelector('#esCompartir').addEventListener('click', async () => {
      try {
        const b = await aBlob(); if (!b) throw new Error('canvas');
        const file = new File([b], nombreArchivo, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { U.download(nombreArchivo, b); toast('Tu navegador no comparte directo: la imagen se descargó. Súbela desde la galería.', { ms: 5000 }); }
      } catch (e) { if (e && e.name !== 'AbortError') toast('No se pudo compartir la imagen.', { error: true }); }
    });

    listaFotos();
    await ponerFoto(foto);
  };

  /* Pantalla del menú: elegir el producto */
  APP.pages.estados = async function (main) {
    main.innerHTML = `
      <div class="page-head"><div><h1>Imágenes para estados</h1><p class="sub">Elige un producto y se crea la imagen con su foto, nombre y precio.</p></div></div>
      <div class="searchbox" style="margin-bottom:14px">${icon('search')}<input class="input" id="esQ" type="search" placeholder="Buscar producto…" autocomplete="off"></div>
      <div id="esLista"></div>`;
    const lista = main.querySelector('#esLista');
    const pintar = () => {
      const q = main.querySelector('#esQ').value;
      const ps = APP.productos.filter((x) => x.activo !== false && APP.matchProducto(x, q)).slice(0, 40);
      lista.innerHTML = ps.length ? `<div class="list">${ps.map((x) => APP.productoItem(x)).join('')}</div>` : '<div class="card empty">No encontré ese producto.</div>';
      lista.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => APP.openEstado(APP.prod(b.dataset.id))));
    };
    main.querySelector('#esQ').addEventListener('input', U.debounce(pintar, 120));
    pintar();
  };
})();
