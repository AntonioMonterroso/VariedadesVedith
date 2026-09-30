/* Imágenes para estados de WhatsApp: toma un producto y arma una imagen vertical (1080 × 1920)
   con su foto, nombre y precio. Se descarga o se comparte directo desde el teléfono.
   Se dibuja en un <canvas>, sin servidores. Nunca muestra costos ni el código de Tupperware. */
(function () {
  'use strict';
  const { icon, esc, toast, openModal } = U;
  const APP = window.APP;
  const W = 1080, H = 1920;
  const F_TITULO = "'Fraunces', Georgia, serif";
  const F_TEXTO = "'Nunito Sans', system-ui, sans-serif";
  const C = { turquesa: '#0E7C7B', turquesaOscuro: '#0A5F5E', coral: '#F26B5B', coralOscuro: '#D9432F', tinta: '#16302F', gris: '#48605F', crema: '#F7FBFA', menta: '#DDF1EF' };

  /* ---------- carga de imágenes ----------
     Muchas páginas no dejan usar sus fotos dentro de un canvas (CORS). Se intenta directo y,
     si falla, a través de un servicio público de imágenes (wsrv.nl). Si tampoco, se avisa
     y se puede subir la foto desde el teléfono. */
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

  /* ---------- dibujo ---------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function cover(ctx, img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
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
  // Dibuja texto en varias líneas y devuelve la y donde termina
  function parrafo(ctx, texto, x, y, maxW, maxLineas, interlineado, alinear = 'center') {
    ctx.textAlign = alinear;
    const ls = lineas(ctx, texto, maxW, maxLineas);
    ls.forEach((l, i) => ctx.fillText(l, x, y + i * interlineado));
    return y + (ls.length - 1) * interlineado;
  }
  function pildora(ctx, texto, cx, y, alto, fuente, fondo, color, padX = 70, alinear = 'center', xIzq = 0) {
    ctx.font = fuente;
    const ancho = ctx.measureText(texto).width + padX * 2;
    const x = alinear === 'center' ? cx - ancho / 2 : xIzq;
    ctx.fillStyle = fondo; rr(ctx, x, y, ancho, alto, alto / 2); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, x + ancho / 2, y + alto / 2 + 4);
    ctx.textBaseline = 'alphabetic';
    return { x, ancho };
  }
  function sinFoto(ctx, x, y, w, h) {
    ctx.fillStyle = C.menta; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.turquesa; ctx.globalAlpha = .35; ctx.font = `700 64px ${F_TEXTO}`; ctx.textAlign = 'center';
    ctx.fillText('Sin foto', x + w / 2, y + h / 2); ctx.globalAlpha = 1;
  }
  function pie(ctx, d, color, y) {
    ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.font = `800 50px ${F_TEXTO}`;
    ctx.fillText(d.tel ? `Pídelo por WhatsApp · ${d.tel}` : 'Pídelo por WhatsApp', W / 2, y);
    ctx.globalAlpha = .85; ctx.font = `600 32px ${F_TEXTO}`;
    ctx.fillText(`${d.negocio} · Distribuidor independiente de Tupperware`, W / 2, y + 52); ctx.globalAlpha = 1;
  }

  const ESTILOS = {
    clasico(ctx, d) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.crema); g.addColorStop(1, C.menta);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(242,107,91,.14)'; ctx.beginPath(); ctx.arc(W - 80, 200, 300, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(14,124,123,.10)'; ctx.beginPath(); ctx.arc(60, 1500, 360, 0, 7); ctx.fill();
      if (d.logo) { const h = 250, w = h * d.logo.width / d.logo.height; ctx.drawImage(d.logo, (W - w) / 2, 60, w, h); }
      ctx.save(); ctx.shadowColor = 'rgba(22,48,47,.28)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
      ctx.fillStyle = '#fff'; rr(ctx, 90, 350, 900, 900, 64); ctx.fill(); ctx.restore();
      ctx.save(); rr(ctx, 90, 350, 900, 900, 64); ctx.clip();
      if (d.foto) cover(ctx, d.foto, 90, 350, 900, 900); else sinFoto(ctx, 90, 350, 900, 900);
      ctx.restore();
      ctx.fillStyle = C.tinta; ctx.font = `600 82px ${F_TITULO}`;
      const yNombre = parrafo(ctx, d.nombre, W / 2, 1358, 900, 2, 96);
      pildora(ctx, d.precio, W / 2, yNombre + 56, 176, `800 118px ${F_TEXTO}`, C.coral, '#fff');
      if (d.extra) { ctx.fillStyle = C.gris; ctx.font = `700 46px ${F_TEXTO}`; parrafo(ctx, d.extra, W / 2, yNombre + 300, 940, 2, 56); }
      ctx.fillStyle = C.turquesa; ctx.fillRect(0, 1760, W, 160);
      pie(ctx, d, '#fff', 1830);
    },
    grande(ctx, d) {
      if (d.foto) cover(ctx, d.foto, 0, 0, W, H); else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.turquesa); g.addColorStop(1, C.turquesaOscuro); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      const g = ctx.createLinearGradient(0, 780, 0, H); g.addColorStop(0, 'rgba(8,28,27,0)'); g.addColorStop(.55, 'rgba(8,28,27,.82)'); g.addColorStop(1, 'rgba(8,28,27,.94)');
      ctx.fillStyle = g; ctx.fillRect(0, 780, W, H - 780);
      if (d.logo) {
        ctx.fillStyle = 'rgba(255,255,255,.94)'; rr(ctx, 56, 56, 250, 280, 44); ctx.fill();
        const h = 220, w = h * d.logo.width / d.logo.height; ctx.drawImage(d.logo, 56 + (250 - w) / 2, 86, w, h);
      }
      ctx.fillStyle = '#fff'; ctx.font = `600 96px ${F_TITULO}`;
      const y = parrafo(ctx, d.nombre, 70, 1180, 940, 3, 110, 'left');
      pildora(ctx, d.precio, 0, y + 60, 200, `800 140px ${F_TEXTO}`, C.coral, '#fff', 64, 'left', 70);
      if (d.extra) { ctx.fillStyle = '#fff'; ctx.font = `700 50px ${F_TEXTO}`; parrafo(ctx, d.extra, 70, y + 330, 940, 2, 60, 'left'); }
      pie(ctx, d, '#fff', 1810);
    },
    oferta(ctx, d) {
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.coral); g.addColorStop(1, C.coralOscuro);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      [[120, 240, 200], [960, 420, 140], [90, 1500, 260], [1000, 1700, 200]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 176px ${F_TEXTO}`;
      ctx.fillText('OFERTA', W / 2, 250);
      ctx.font = `700 50px ${F_TEXTO}`; ctx.fillText(d.extra || 'Solo por tiempo limitado', W / 2, 336);
      const cx = W / 2, cy = 860, r = 380;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r + 26, 0, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
      if (d.foto) cover(ctx, d.foto, cx - r, cy - r, r * 2, r * 2); else sinFoto(ctx, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = `600 80px ${F_TITULO}`;
      const y = parrafo(ctx, d.nombre, W / 2, 1400, 920, 2, 94);
      ctx.fillStyle = '#fff'; rr(ctx, 170, y + 46, 740, 220, 110); ctx.fill();
      ctx.fillStyle = C.turquesaOscuro; ctx.font = `800 150px ${F_TEXTO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.precio, W / 2, y + 46 + 116); ctx.textBaseline = 'alphabetic';
      pie(ctx, d, '#fff', 1780);
    }
  };

  /* ---------- ventana ---------- */
  APP.openEstado = async function (p) {
    const estado = { estilo: 'clasico', precio: 'Q' + Number(p.precio).toLocaleString('es-GT', { maximumFractionDigits: 2 }), extra: '', tel: !!APP.config.whatsapp, foto: p.fotos && p.fotos[0] || '', subida: null };
    let logo = null, fotoImg = null, dibujando = 0, avisoFoto = '';
    const m = openModal({
      title: 'Imagen para estado', wide: true,
      body: `
        <div class="estado-prev"><canvas id="esCanvas" width="${W}" height="${H}" aria-label="Vista previa de la imagen"></canvas></div>
        <div class="stack">
          <div class="stack-sm"><span class="small" style="font-weight:800">Estilo</span>
            <div class="seg" role="group" aria-label="Estilo">
              <button type="button" data-st="clasico" aria-pressed="true">Clásico</button>
              <button type="button" data-st="grande" aria-pressed="false">Foto grande</button>
              <button type="button" data-st="oferta" aria-pressed="false">Oferta</button></div></div>
          <div class="grid-2">
            <label class="field">Precio que se muestra<input class="input" id="esPrecio" value="${esc(estado.precio)}" maxlength="18"></label>
            <label class="field">Frase extra <span class="hint">opcional</span><input class="input" id="esExtra" maxlength="60" placeholder="Ej.: Quedan pocas piezas"></label>
          </div>
          <div class="stack-sm" id="esFotos"></div>
          <p class="banner bad small" id="esAviso" hidden></p>
          ${APP.config.whatsapp ? `<label class="row"><input type="checkbox" id="esTel" checked style="width:22px;height:22px;accent-color:var(--pink-600)"> <span>Mostrar mi WhatsApp (${esc(APP.config.whatsapp)})</span></label>` : ''}
        </div>`,
      footer: `<button type="button" class="btn secondary" id="esDescargar">${icon('download')} Descargar</button><button type="button" class="btn" id="esCompartir">${icon('chat')} Compartir</button>`
    });
    const g = (s) => m.body.querySelector(s);
    const canvas = g('#esCanvas'), ctx = canvas.getContext('2d');

    async function dibujar() {
      const turno = ++dibujando;
      try { await Promise.all([document.fonts.load(`600 60px Fraunces`), document.fonts.load(`800 60px "Nunito Sans"`), document.fonts.load(`700 60px "Nunito Sans"`), document.fonts.load(`600 40px "Nunito Sans"`)]); } catch (_) {}
      if (turno !== dibujando) return;
      ctx.clearRect(0, 0, W, H);
      ESTILOS[estado.estilo](ctx, { nombre: p.nombre, precio: estado.precio || ' ', extra: estado.extra.trim(), tel: estado.tel ? APP.config.whatsapp : '', negocio: APP.config.nombre_negocio || 'Vedith Variedades', foto: fotoImg, logo });
    }
    async function cambiarFoto(src) {
      estado.foto = src; fotoImg = await cargarImagen(src);
      avisoFoto = src && !fotoImg ? 'No pude usar esa foto dentro de la imagen (la página no lo permite). Sube la foto desde tu teléfono con el botón de abajo.' : '';
      const av = g('#esAviso'); av.hidden = !avisoFoto; av.textContent = avisoFoto;
      pintarFotos(); dibujar();
    }
    function pintarFotos() {
      const box = g('#esFotos');
      const fotos = p.fotos || [];
      box.innerHTML = `<span class="small" style="font-weight:800">Foto</span>
        <div class="chips" style="flex-wrap:wrap;overflow:visible">
          ${fotos.map((f, i) => `<button type="button" class="chip" data-f="${i}" aria-pressed="${estado.foto === f}" style="padding:4px 6px"><span style="width:44px;height:44px;border-radius:10px;overflow:hidden;display:block">${U.imgTag(f, 'Foto ' + (i + 1))}</span></button>`).join('')}
          <label class="chip" style="cursor:pointer">${icon('camera', 'sm')} Subir del teléfono<input type="file" accept="image/*" id="esArchivo" hidden></label>
        </div>`;
      box.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => cambiarFoto(fotos[Number(b.dataset.f)])));
      box.querySelector('#esArchivo').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        if (estado.subida) URL.revokeObjectURL(estado.subida);
        estado.subida = URL.createObjectURL(f); cambiarFoto(estado.subida);
      });
      box.querySelectorAll('.chip[data-f]').forEach((b, i) => b.setAttribute('aria-pressed', String(estado.foto === fotos[i])));
    }

    m.body.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => {
      estado.estilo = b.dataset.st;
      m.body.querySelectorAll('[data-st]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      dibujar();
    }));
    g('#esPrecio').addEventListener('input', U.debounce((e) => { estado.precio = e.target.value.trim(); dibujar(); }, 120));
    g('#esExtra').addEventListener('input', U.debounce((e) => { estado.extra = e.target.value; dibujar(); }, 120));
    const tel = g('#esTel'); if (tel) tel.addEventListener('change', () => { estado.tel = tel.checked; dibujar(); });

    const archivo = () => `estado-${p.codigo}.png`;
    const aBlob = () => new Promise((res) => canvas.toBlob(res, 'image/png'));
    m.foot.querySelector('#esDescargar').addEventListener('click', async () => {
      try { const b = await aBlob(); if (!b) throw new Error('canvas'); U.download(archivo(), b); toast('Imagen descargada'); }
      catch (e) { toast('No se pudo crear la imagen con esa foto. Sube la foto desde tu teléfono.', { error: true, ms: 5000 }); }
    });
    const btnShare = m.foot.querySelector('#esCompartir');
    btnShare.addEventListener('click', async () => {
      try {
        const b = await aBlob(); if (!b) throw new Error('canvas');
        const file = new File([b], archivo(), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: `${p.nombre} · ${estado.precio}` });
        else { U.download(archivo(), b); toast('Tu navegador no comparte directo: la imagen se descargó. Súbela desde la galería.', { ms: 5000 }); }
      } catch (e) { if (e && e.name !== 'AbortError') toast('No se pudo compartir la imagen.', { error: true }); }
    });

    // logo de la marca (mismo sitio: sin problemas de permisos)
    logo = await cargarImagen('assets/logo-pequeno.png');
    pintarFotos();
    fotoImg = await cargarImagen(estado.foto);
    if (estado.foto && !fotoImg) { g('#esAviso').hidden = false; g('#esAviso').textContent = 'No pude usar la foto de este producto dentro de la imagen (la página de origen no lo permite). Sube una foto desde tu teléfono con el botón de abajo.'; }
    dibujar();
  };

  /* ---------- pantalla: elegir producto ---------- */
  APP.pages.estados = async function (main) {
    main.innerHTML = `
      <div class="page-head"><div><h1>Imágenes para estados</h1><p class="sub">Elige un producto y arma la imagen lista para WhatsApp.</p></div></div>
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
