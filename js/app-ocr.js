/* Lectura de texto (OCR) para el importador de productos.
   Usa Tesseract.js, guardado en vendor/ocr/ (funciona sin internet de terceros).
   Se lee solo el recuadro que la administradora marca sobre un producto; así acierta mucho más
   que leer la página entera. Es una ayuda, no una lectura perfecta: siempre se revisa. */
(function () {
  'use strict';
  const APP = window.APP;
  let trabajador = null, iniciando = null;

  async function motor() {
    if (trabajador) return trabajador;
    if (!iniciando) iniciando = (async () => {
      await U.loadScript('vendor/ocr/tesseract.min.js');
      const base = new URL('vendor/ocr/', location.href).href;
      trabajador = await Tesseract.createWorker('spa', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: false, workerBlobURL: false });
      return trabajador;
    })().catch((e) => { iniciando = null; throw e; });
    return iniciando;
  }

  /* Recorta, agranda 3 veces y deja en blanco y negro. Si el fondo es oscuro, invierte
     (el catálogo usa mucho texto blanco sobre azul). Devuelve un canvas listo para leer. */
  function preparar(img, r, modo) {
    const escala = 3;
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(r.w * escala)); cv.height = Math.max(1, Math.round(r.h * escala));
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height);
    if (modo === 'color') return cv;
    const d = c.getImageData(0, 0, cv.width, cv.height), p = d.data, g = new Uint8Array(cv.width * cv.height);
    let suma = 0;
    for (let i = 0, j = 0; i < p.length; i += 4, j++) { g[j] = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0; suma += g[j]; }
    const oscuro = suma / g.length < 128;
    const hist = new Array(256).fill(0); g.forEach((v) => hist[v]++);
    let tot = g.length, sT = 0; for (let i = 0; i < 256; i++) sT += i * hist[i];
    let wB = 0, sB = 0, mx = 0, th = 128;                       // umbral de Otsu
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sT - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > mx) { mx = v; th = i; } }
    for (let i = 0, j = 0; i < p.length; i += 4, j++) { let v = g[j] > th ? 255 : 0; if (oscuro) v = 255 - v; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    c.putImageData(d, 0, 0);
    return cv;
  }

  /* ---------- interpretar el texto ---------- */
  const DIG = { O: '0', Q: '0', D: '0', I: '1', L: '1', l: '1', S: '5', B: '8', Z: '2' };
  function arreglarCodigo(t) {
    const s = String(t).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // Códigos de este catálogo: 1 a 3 letras, guion opcional, 3 números y a veces una letra (D-702C, SWT010, K-324)
    const m = s.match(/^([A-Z]{1,3})-?([0-9OQDILSBZ]{3})([A-Z]?)$/);
    if (!m) return null;
    const nums = m[2].split('').map((ch) => (/\d/.test(ch) ? ch : (DIG[ch] || ch))).join('');
    if (!/^\d{3}$/.test(nums)) return null;
    const letras = m[1];
    return (letras.length === 1 ? letras + '-' : letras) + nums + m[3];
  }
  function numero(txt) {
    const m = String(txt).replace(/\s/g, '').match(/(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?/);
    if (!m) return null;
    const entero = parseInt(m[1].replace(/,/g, ''), 10);
    let cent = m[2] === undefined ? null : parseInt(m[2].padEnd(2, '0'), 10);
    return { entero, cent };
  }

  /* texto: lectura normal. palabras: lectura de solo números con la posición y el alto de cada una. */
  function interpretar(texto, palabras) {
    const lineas = String(texto).split('\n').map((l) => l.replace(/[|_]+/g, ' ').trim()).filter(Boolean);
    let codigo = '', idx = -1;
    for (let i = 0; i < lineas.length; i++) {
      for (const tk of lineas[i].split(/\s+/)) { const c = arreglarCodigo(tk); if (c) { codigo = c; idx = i; break; } }
      if (codigo) break;
    }
    // nombre: la primera línea con letras después del código (sin "Cap.", "De:", "A:", ni precios)
    const inutil = /^(cap|de\b|a:|do:|más del|des?cuento|\$)/i;
    let nombre = '', cap = '';
    for (let i = idx + 1; i < lineas.length; i++) {
      const l = lineas[i];
      if (/^cap/i.test(l)) { cap = cap || l.replace(/^cap\.?\s*(de uso)?\s*/i, '').trim(); continue; }
      if (inutil.test(l) || (l.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]/g) || []).length < 4) continue;
      if (!nombre) nombre = l.replace(/[®*™]+/g, '').replace(/\s+/g, ' ').trim();
      else if (/^[*]/.test(lineas[i])) cap = cap ? cap + ' · ' + l.replace(/^\*/, '') : l.replace(/^\*/, '');
    }
    if (!nombre && lineas.length) nombre = lineas.find((l) => (l.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]/g) || []).length >= 5 && !inutil.test(l)) || '';

    // precios: el de oferta es el número más grande; el normal es otro número mayor y más pequeño en pantalla
    const tokens = (palabras || []).map((w) => ({ n: numero(w.text), h: w.bbox.y1 - w.bbox.y0, x: w.bbox.x0, y: w.bbox.y0, t: w.text })).filter((t) => t.n && t.n.entero >= 5);
    tokens.sort((a, b) => b.h - a.h);
    let oferta = null, normal = null;
    if (tokens[0]) {
      oferta = tokens[0];
      normal = tokens.find((t) => t !== oferta && t.n.cent !== null && t.n.entero > oferta.n.entero && t.h < oferta.h); // con centavos: así no se confunde con los números del código
    }
    // En este catálogo casi todos los precios terminan en .90; los centavos van en letra chiquita y se leen mal.
    const centavos = (n) => (n && [90, 99, 0, 50].includes(n.cent) ? n.cent : 90);
    return {
      codigo, nombre, descripcion: cap ? `Capacidad: ${cap}` : '',
      precio_catalogo: oferta ? oferta.n.entero + centavos(oferta.n) / 100 : null,
      precio_normal: normal ? normal.n.entero + centavos(normal.n) / 100 : null,
      crudo: lineas.join(' | ')
    };
  }

  /* img: elemento <img> ya cargado; r: recuadro en píxeles de la imagen original */
  APP.ocrLeer = async function (img, r) {
    const w = await motor();
    // 1) texto normal (blanco y negro; si no encuentra código, se intenta con color)
    let texto = '';
    for (const modo of ['bn', 'color']) {
      const { data } = await w.recognize(preparar(img, r, modo));
      if (!texto || (!arreglarCodigoEnTexto(texto) && arreglarCodigoEnTexto(data.text))) texto = data.text;
      if (arreglarCodigoEnTexto(texto)) break;
    }
    // 2) solo números, para encontrar el precio más grande
    await w.setParameters({ tessedit_char_whitelist: '0123456789.,$', tessedit_pageseg_mode: '11' });
    let palabras = [];
    try {
      const { data } = await w.recognize(preparar(img, r, 'bn'));
      palabras = data.words || [];
    } finally { await w.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '3' }); }
    return interpretar(texto, palabras);
  };
  function arreglarCodigoEnTexto(t) { return String(t).split(/\s+/).some((tk) => arreglarCodigo(tk)); }
  APP.ocrCerrar = async function () { if (trabajador) { try { await trabajador.terminate(); } catch (_) {} } trabajador = null; iniciando = null; };
})();
