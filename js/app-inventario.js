/* Mi inventario: cada producto con su foto, cuántos hay y cuántos de cada estilo.
   También: subir fotos al almacenamiento (comprimidas solas) y el medidor de espacio. */
(function () {
  'use strict';
  const { icon, esc, money, toast } = U;
  const APP = window.APP;
  const P = APP.pages;
  const isAdmin = APP.isAdmin;

  /* ---------- fotos: comprimir y subir ---------- */
  const MB = 1048576;
  const fmtBytes = (b) => (b >= 1024 * MB ? (b / (1024 * MB)).toFixed(2) + ' GB' : b >= MB ? (b / MB).toFixed(b >= 100 * MB ? 0 : 1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  APP.fmtBytes = fmtBytes;

  // Reduce la foto a ~1000 px de lado mayor y JPEG: queda en 80 a 200 KB
  APP.comprimirImagen = async function (file, max = 1000, calidad = 0.8) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) {
      bmp = await new Promise((res, rej) => { const im = new Image(), u = URL.createObjectURL(file); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => rej(new Error('IMAGEN_INVALIDA')); im.src = u; });
    }
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, max / Math.max(w0, h0));
    const cv = document.createElement('canvas'); cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    const aBlob = (q) => new Promise((res) => cv.toBlob(res, 'image/jpeg', q));
    let blob = await aBlob(calidad);
    if (blob && blob.size > 350 * 1024) blob = await aBlob(0.65);
    if (!blob) throw new Error('IMAGEN_INVALIDA');
    return blob;
  };

  APP.uso = null;
  APP.cargarUso = async function () {
    try { APP.uso = await API.usoAlmacenamiento(); } catch (e) { APP.uso = (e.message || '').includes('FALTA_SQL') ? { faltaSql: true } : null; }
    return APP.uso;
  };
  const totalBytes = () => (Number(APP.config.espacio_total_mb) || 1024) * MB;

  APP.subirFotoArchivo = async function (file) {
    if (!file || !/^image\//.test(file.type)) throw new Error('NO_ES_IMAGEN');
    const blob = await APP.comprimirImagen(file);
    const u = await APP.cargarUso();
    if (u && u.faltaSql) throw new Error('FALTA_SQL_FOTOS');
    if (u && u.total != null && u.total + blob.size > totalBytes() * 0.98) throw new Error('SIN_ESPACIO');
    const url = await API.subirFoto(blob);
    if (APP.uso && APP.uso.total != null) APP.uso.total += blob.size;
    return { url, bytes: blob.size, quedan: APP.uso && APP.uso.total != null ? Math.max(0, totalBytes() - APP.uso.total) : null };
  };
  APP.errFoto = (e) => {
    const m = (e && e.message) || '';
    if (m === 'SIN_ESPACIO') return 'Ya no hay espacio para más fotos. Libera espacio en Ajustes o borra catálogos viejos.';
    if (m === 'FALTA_SQL_FOTOS') return 'Para subir fotos falta correr migracion_fotos_storage.sql en Supabase.';
    if (m === 'NO_ES_IMAGEN' || m === 'IMAGEN_INVALIDA') return 'Ese archivo no es una foto que pueda leer.';
    return APP.errMsg ? APP.errMsg(e) : 'No se pudo subir la foto.';
  };

  // Agrega junto a un campo de link el botón «Subir foto» (cámara o galería)
  APP.agregarSubir = function (input) {
    if (!isAdmin()) return;
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.hidden = true;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn secondary sm'; b.style.marginTop = '6px';
    b.innerHTML = `${icon('camera', 'sm')} Subir foto`;
    b.addEventListener('click', () => fi.click());
    fi.addEventListener('change', async () => {
      const f = fi.files && fi.files[0]; fi.value = ''; if (!f) return;
      b.disabled = true; b.textContent = 'Subiendo…';
      try {
        const r = await APP.subirFotoArchivo(f);
        input.value = r.url; input.dispatchEvent(new Event('input', { bubbles: true }));
        toast(`Foto subida (${fmtBytes(r.bytes)})${r.quedan != null ? ' · quedan ' + fmtBytes(r.quedan) + ' libres' : ''}`);
      } catch (e) { toast(APP.errFoto(e), { error: true, ms: 6000 }); }
      b.disabled = false; b.innerHTML = `${icon('camera', 'sm')} Subir foto`;
    });
    input.insertAdjacentElement('afterend', b); b.insertAdjacentElement('afterend', fi);
  };

  // Barra de espacio usado
  APP.medidorEspacio = async function (box) {
    box.innerHTML = '<p class="small muted">Midiendo el espacio…</p>';
    const u = await APP.cargarUso();
    if (!u) { box.innerHTML = '<p class="small muted">No se pudo medir el espacio ahora.</p>'; return; }
    if (u.faltaSql) { box.innerHTML = `<div class="banner">${icon('alert')}<span class="small">Para subir fotos y medir el espacio falta correr <b>migracion_fotos_storage.sql</b> en Supabase.</span></div>`; return; }
    const tot = totalBytes(), pct = Math.min(100, (u.total / tot) * 100), cls = pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok';
    box.innerHTML = `<div class="meter"><div class="meter-bar"><i class="${cls}" style="width:${Math.max(2, pct).toFixed(1)}%"></i></div>
      <div class="row between wrap"><b class="num">${fmtBytes(u.total)} usados</b><span class="small muted">de ${fmtBytes(tot)} · quedan ${fmtBytes(Math.max(0, tot - u.total))}</span></div>
      <p class="xs muted">Fotos ${fmtBytes(u.fotos)} · Catálogos ${fmtBytes(u.catalogos)}. Cada foto se comprime sola (unos 100 KB).</p>
      ${pct >= 80 ? `<div class="banner bad">${icon('alert')}<span class="small"><b>Queda poco espacio.</b> Archiva y borra catálogos de tandas pasadas, o toca «Liberar fotos sin usar».</span></div>` : ''}
      <button type="button" class="btn secondary sm" data-limpiar style="justify-self:start">${icon('trash', 'sm')} Liberar fotos sin usar</button></div>`;
    box.querySelector('[data-limpiar]').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try { const n = await API.limpiarFotos(); toast(n ? `Se liberaron ${n} fotos que ningún producto usaba.` : 'No había fotos sin usar.'); APP.medidorEspacio(box); } catch (e) { APP.handleErr(e); ev.target.disabled = false; }
    });
  };

  /* ---------- Mi inventario ---------- */
  const INV = { q: '', f: '', camp: '', abiertos: new Set(), vista: U.lsGet('vedith-vista', 'grid') };

  // Estilos de un producto: por diseño (con su foto) o por color
  function estilos(p) {
    const cs = p.colores || [];
    if (!p.usa_colores || !cs.length) return [];
    if (cs.some((c) => c.diseno)) {
      const m = new Map();
      cs.forEach((c) => {
        const k = c.diseno || '';
        if (!m.has(k)) m.set(k, { nombre: k || 'Sin diseño', foto: '', n: 0, items: [] });
        const e = m.get(k); e.n += Number(c.cantidad) || 0; e.items.push(c); if (!e.foto && c.foto) e.foto = c.foto;
      });
      return [...m.values()];
    }
    return cs.map((c) => ({ nombre: c.color, foto: c.foto || '', n: Number(c.cantidad) || 0, items: [c], solo: c }));
  }
  APP.estilosDe = estilos;

  /* ---------- ritmo de ventas: qué se vende rápido y cuánto conviene pedir ---------- */
  APP.ritmo = null;
  APP.cargarRitmo = async function (forzar) {
    if (!isAdmin()) return null;
    if (APP.ritmo && !forzar && Date.now() - APP.ritmo.at < 300000) return APP.ritmo;
    try {
      const ventas = await API.ventas(), desde = Date.now() - 30 * 86400000, m = {};
      ventas.forEach((v) => { if (v.anulada || !v.producto_id) return; const r = m[v.producto_id] = m[v.producto_id] || { v30: 0, total: 0 }; r.total += v.cantidad; if (new Date(v.created_at) >= desde) r.v30 += v.cantidad; });
      APP.ritmo = { at: Date.now(), m };
    } catch (_) { APP.ritmo = null; }
    return APP.ritmo;
  };
  // rápido: 6 o más en 30 días · normal: de 1 a 5 · sin ventas: ninguna en 30 días
  APP.ritmoDe = (p) => {
    const r = (APP.ritmo && APP.ritmo.m[p.id]) || { v30: 0, total: 0 };
    const nivel = r.v30 >= 6 ? 'rapido' : r.v30 >= 1 ? 'normal' : 'sin';
    const objetivo = nivel === 'rapido' ? r.v30 : nivel === 'normal' ? Math.max(2, r.v30) : 1;
    return { v30: r.v30, nivel, sugerido: Math.max(1, objetivo - Math.max(0, p.cantidad)) };
  };
  APP.ritmoPill = (p) => {
    if (!APP.ritmo) return '';
    const r = APP.ritmoDe(p);
    if (r.nivel === 'rapido') return `<span class="pill ok" title="${r.v30} vendidas en 30 días">Se vende rápido</span>`;
    if (r.nivel === 'normal') return `<span class="pill" title="${r.v30} vendidas en 30 días">Se vende normal</span>`;
    return p.cantidad > 0 ? '<span class="pill warn" title="Ninguna venta en 30 días">Sin ventas en 30 días</span>' : '';
  };
  const fotoDe = (p) => (p.fotos && p.fotos[0]) || '';

  function tarjeta(p) {
    const ad = isAdmin(), es = estilos(p), abierto = INV.abiertos.has(p.id);
    const est = APP.stockEstado(p);
    const tiles = es.map((e) => `<span class="est-tile ${e.n <= 0 ? 'cero' : ''}">
        ${e.foto ? `<span class="et-img" data-foto="${esc(e.foto)}">${U.imgTag(e.foto, '')}</span>` : e.solo ? `<span class="et-img et-dot">${APP.vdot(e.solo)}</span>` : `<span class="et-img et-ph">${icon('tag', 'sm')}</span>`}
        <span class="et-t"><span class="et-n">${esc(e.nombre)}</span><span class="et-q num">${e.n}</span></span></span>`).join('');
    const filas = !abierto ? '' : `<div class="inv-edit">${p.usa_colores && (p.colores || []).length
      ? p.colores.map((c) => `<div class="lote-fila" data-cid="${esc(c.id)}">${APP.vdot(c)}<span class="grow t1">${esc(c.color)}</span>${stepper(c.cantidad)}</div>`).join('')
      : `<div class="lote-fila" data-cid=""><span class="grow t1">Total en existencia</span>${stepper(p.cantidad)}</div>`}
      <div class="row wrap"><button type="button" class="btn ghost sm" data-ficha>${icon('eye', 'sm')} Ver ficha</button><button type="button" class="btn ghost sm" data-editar>${icon('edit', 'sm')} Editar producto</button></div></div>`;
    return `<section class="card inv-card ${est === 'agotado' ? 'is-agot' : ''}" data-pid="${esc(p.id)}">
      <button type="button" class="inv-head" data-ficha aria-label="Abrir ${esc(p.nombre)}">
        <span class="inv-foto">${fotoDe(p) ? U.imgTag(fotoDe(p), p.nombre) : U.placeholder('Sin foto')}</span>
        <span class="grow" style="min-width:0"><span class="inv-nm">${esc(p.nombre)}</span><span class="inv-sub">${money(p.precio)}${p.campana ? ' · ' + esc(p.campana) : ''}${ad && !p.activo ? ' · oculto' : ''}</span>${ad ? `<span class="inv-ritmo">${APP.ritmoPill(p)}</span>` : ''}</span>
        <span class="inv-tot ${est}"><b class="num">${p.cantidad}</b><small>${est === 'agotado' ? 'agotado' : 'tengo'}</small></span>
      </button>
      ${es.length ? `<div class="est-strip">${tiles}</div>` : ''}
      ${ad ? `<button type="button" class="btn ghost sm inv-toggle" data-toggle aria-expanded="${abierto}">${abierto ? 'Cerrar' : 'Corregir cantidades'}</button>` : ''}
      ${filas}
    </section>`;
  }
  // Cuadrícula: foto cuadrada, número de piezas encima, nombre y precio
  function tile(p) {
    const est = APP.stockEstado(p), es = estilos(p);
    return `<button type="button" class="itile ${est}" data-pid="${esc(p.id)}" aria-label="${esc(p.nombre)}, tengo ${p.cantidad}">
      <span class="it-foto">${fotoDe(p) ? U.imgTag(fotoDe(p), '') : U.placeholder('Sin foto')}<b class="it-n num">${p.cantidad}</b></span>
      <span class="it-nm">${esc(p.nombre)}</span><span class="it-sub">${money(p.precio)}${es.length > 1 ? ` · ${es.length} estilos` : ''}</span></button>`;
  }
  const stepper = (n) => `<div class="stepper" role="group" aria-label="Piezas"><button type="button" data-minus aria-label="Menos">${icon('minus')}</button><input type="number" inputmode="numeric" min="0" value="${Number(n) || 0}" data-cant aria-label="Piezas"><button type="button" data-plus aria-label="Más">${icon('plus')}</button></div>`;

  // Guía de primeros pasos: se va tachando sola y desaparece cuando todo está hecho
  function pasosHtml() {
    if (U.lsGet('vedith-pasos-ok', false)) return '';
    const pasos = [
      { ok: APP.productos.length > 0, t: 'Agrega tu primer producto', h: '#/inventario', btn: 'nuevo' },
      { ok: APP.productos.some((p) => p.fotos && p.fotos.length), t: 'Ponle foto a un producto', h: '#/pendientes' },
      { ok: APP.productos.some((p) => p.etiqueta_impresa_at), t: 'Imprime su etiqueta QR', h: '#/etiquetas' },
      { ok: !!U.lsGet('vedith-vendio', false), t: 'Haz tu primera venta', h: '#/vender' }
    ];
    const hechos = pasos.filter((x) => x.ok).length;
    if (hechos === pasos.length) { U.lsSet('vedith-pasos-ok', true); return ''; }
    const sig = pasos.findIndex((x) => !x.ok);
    return `<section class="card pasos"><div class="row between"><h2>Primeros pasos · ${hechos} de ${pasos.length}</h2><button type="button" class="btn ghost sm" id="pasosOcultar">Ocultar</button></div>
      <div class="pasos-bar"><i style="width:${(hechos / pasos.length) * 100}%"></i></div>
      <div class="list">${pasos.map((x, i) => `<${x.btn ? 'button type="button" id="pasoNuevo"' : 'a href="' + x.h + '"'} class="item ${x.ok ? 'hecho' : i === sig ? 'sig' : ''}"><span class="paso-n">${x.ok ? icon('check', 'sm') : i + 1}</span><span class="grow t1">${x.t}</span>${x.ok ? '' : icon('chevron', 'sm')}</${x.btn ? 'button' : 'a'}>`).join('')}</div></section>`;
  }

  P.inventario = async function (main) {
    const ad = isAdmin();
    main.innerHTML = `
      <div class="page-head"><div><h1>Mi inventario</h1><p class="sub" id="invSub"></p></div>
        ${ad ? `<div class="row inv-btns"><button type="button" class="btn secondary" id="invNuevo">${icon('plus')} Nuevo</button><a class="btn" href="#/ingreso">${icon('package')} Recibí mercadería</a></div>` : ''}</div>
      ${ad ? pasosHtml() : ''}<div id="invKpi"></div><div id="invAviso"></div>
      <div class="toolbar">
        <div class="searchbox">${icon('search')}<input class="input" id="invQ" type="search" placeholder="Buscar por nombre o código…" autocomplete="off" value="${esc(INV.q)}"></div>
        <div class="chips" id="invF" role="group" aria-label="Filtro">
          <button type="button" class="chip" data-f="" aria-pressed="${!INV.f}">Todo</button>
          <button type="button" class="chip" data-f="poco" aria-pressed="${INV.f === 'poco'}">Se está acabando</button>
          <button type="button" class="chip" data-f="agot" aria-pressed="${INV.f === 'agot'}">Agotados</button>
        </div>
        ${ad ? '<div class="chips" id="invC" role="group" aria-label="Tanda"></div>' : ''}
        <div class="seg vista-seg" id="invV" role="group" aria-label="Forma de ver"><button type="button" data-v="grid" aria-pressed="${INV.vista === 'grid'}">${icon('grid', 'sm')} Cuadrícula</button><button type="button" data-v="list" aria-pressed="${INV.vista === 'list'}">${icon('list', 'sm')} Detalle</button></div>
      </div>
      <div id="invGrid" class="inv-grid"></div>`;

    const base = () => APP.productos.filter((p) => ad || p.activo);
    const kpis = () => {
      const l = base().filter((p) => p.activo || ad), piezas = l.reduce((s, p) => s + p.cantidad, 0);
      main.querySelector('#invSub').textContent = `${piezas} ${piezas === 1 ? 'pieza' : 'piezas'} en ${l.length} ${l.length === 1 ? 'producto' : 'productos'}`;
      if (!ad) return;
      const vivos = l.filter((p) => p.activo), conCosto = vivos.filter((p) => p.costo != null && p.costo > 0);
      const aCosto = conCosto.reduce((s, p) => s + p.cantidad * p.costo, 0), aVenta = vivos.reduce((s, p) => s + p.cantidad * p.precio, 0);
      const aVentaCosto = conCosto.reduce((s, p) => s + p.cantidad * p.precio, 0);
      const abierto = main.querySelector('#invKpi details') ? main.querySelector('#invKpi details').open : innerWidth >= 640;
      main.querySelector('#invKpi').innerHTML = `<details class="kpi-det" ${abierto ? 'open' : ''}><summary>Cuánto vale mi inventario</summary><div class="kpis">
        <div class="kpi"><span class="k-l">Piezas que tengo</span><span class="k-v num">${piezas}</span><span class="small muted">${vivos.length} productos a la venta</span></div>
        <div class="kpi green"><span class="k-l">Vale si lo vendo todo</span><span class="k-v num">${money(aVenta)}</span><span class="small muted">a precio de venta</span></div>
        <div class="kpi orange"><span class="k-l">Me costó</span><span class="k-v num">${money(aCosto)}</span><span class="small muted">${conCosto.length < vivos.length ? `${vivos.length - conCosto.length} sin costo anotado` : 'todo con costo'}</span></div>
        <div class="kpi pink"><span class="k-l">Ganancia posible</span><span class="k-v num">${money(aVentaCosto - aCosto)}</span><span class="small muted">solo con costo anotado</span></div></div></details>`;
    };
    const pintarTandas = () => {
      const box = main.querySelector('#invC'); if (!box) return;
      const cs = {}; APP.productos.forEach((p) => { if (p.campana) cs[p.campana] = (cs[p.campana] || 0) + 1; });
      box.innerHTML = Object.keys(cs).length ? `<button type="button" class="chip" data-camp="" aria-pressed="${!INV.camp}">Todas las tandas</button>${Object.entries(cs).map(([c, k]) => `<button type="button" class="chip" data-camp="${esc(c)}" aria-pressed="${INV.camp === c}">${esc(c)} · ${k}</button>`).join('')}` : '';
      box.querySelectorAll('[data-camp]').forEach((b) => b.addEventListener('click', () => { INV.camp = b.dataset.camp; pintarTandas(); paint(); }));
    };
    const paint = () => {
      let l = base().filter((p) => APP.matchProducto(p, INV.q));
      if (INV.camp) l = l.filter((p) => p.campana === INV.camp);
      if (INV.f === 'poco') l = l.filter((p) => APP.stockEstado(p) === 'poco');
      else if (INV.f === 'agot') l = l.filter((p) => p.cantidad <= 0);
      else if (!INV.q) l = l.filter((p) => p.activo || (ad && p.cantidad > 0));
      const grid = main.querySelector('#invGrid'); if (!grid) return;
      kpis();
      grid.className = INV.vista === 'grid' ? 'inv-grid3' : 'inv-grid';
      grid.innerHTML = l.length && INV.vista === 'grid' ? l.map(tile).join('') : l.length ? l.map(tarjeta).join('') : `<div class="card empty" style="grid-column:1/-1"><img src="assets/logo-pequeno.png" alt=""><p>${APP.productos.length ? 'No encontré productos con eso.' : ad ? 'Aún no hay productos. Toca «Recibí mercadería» para empezar.' : 'Todavía no hay productos.'}</p></div>`;
      grid.querySelectorAll('.inv-card').forEach(enlazar);
      grid.querySelectorAll('.itile').forEach((b) => b.addEventListener('click', () => detalle(APP.prod(b.dataset.pid))));
      APP.bindVarFotos(grid);
      grid.querySelectorAll('.et-img[data-foto]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); APP.lightbox([el.dataset.foto], 0); }));
    };
    // En la cuadrícula, al tocar un producto se abre su detalle con los estilos y sus cantidades
    function detalle(p) {
      if (ad) INV.abiertos.add(p.id);
      const m = U.openModal({ title: p.nombre, wide: true, body: tarjeta(p), onClose: () => { INV.abiertos.delete(p.id); paint(); } });
      const card = m.body.querySelector('.inv-card'); enlazar(card); APP.bindVarFotos(card);
      const t = card.querySelector('[data-toggle]'); if (t) t.remove();
      card.querySelectorAll('[data-ficha]').forEach((b) => b.addEventListener('click', () => { m.close(); APP.openFicha(p); }));
    }
    function enlazar(card) {
      const p = APP.prod(card.dataset.pid);
      card.querySelectorAll('[data-ficha]').forEach((b) => b.addEventListener('click', () => APP.openFicha(p)));
      const ed = card.querySelector('[data-editar]'); if (ed) ed.addEventListener('click', () => APP.openProductoForm(p));
      const tg = card.querySelector('[data-toggle]');
      if (tg) tg.addEventListener('click', () => { INV.abiertos.has(p.id) ? INV.abiertos.delete(p.id) : INV.abiertos.add(p.id); card.outerHTML = tarjeta(p); const nueva = main.querySelector(`.inv-card[data-pid="${CSS.escape(p.id)}"]`); enlazar(nueva); APP.bindVarFotos(nueva); });
      card.querySelectorAll('.lote-fila').forEach((fila) => {
        const cant = fila.querySelector('[data-cant]'), cid = fila.dataset.cid;
        let t;
        const guardar = async (n) => {
          n = Math.max(0, parseInt(n, 10) || 0); cant.value = n;
          clearTimeout(t);
          t = setTimeout(async () => {
            try {
              await API.ajustarExistencia(p.id, cid || null, n);
              if (cid) { const c = p.colores.find((x) => x.id === cid); if (c) c.cantidad = n; p.cantidad = p.colores.reduce((s, x) => s + (Number(x.cantidad) || 0), 0); } else p.cantidad = n;
              const nueva = document.createElement('div'); nueva.innerHTML = tarjeta(p);
              card.querySelector('.inv-head').replaceWith(nueva.querySelector('.inv-head'));
              const strip = card.querySelector('.est-strip'), ns = nueva.querySelector('.est-strip'); if (strip && ns) strip.replaceWith(ns);
              card.className = nueva.firstElementChild.className; card.querySelector('.inv-head').addEventListener('click', () => APP.openFicha(p));
              APP.bindVarFotos(card); kpis(); toast('Guardado', { ms: 1200 });
            } catch (e) { APP.handleErr(e); }
          }, 600);
        };
        cant.addEventListener('input', () => guardar(cant.value));
        fila.querySelector('[data-minus]').addEventListener('click', () => guardar((parseInt(cant.value, 10) || 0) - 1));
        fila.querySelector('[data-plus]').addEventListener('click', () => guardar((parseInt(cant.value, 10) || 0) + 1));
      });
    }
    P.inventario.paint = paint;
    if (ad) APP.cargarRitmo().then(() => { if (APP.current === 'inventario' && P.inventario.paint && !document.querySelector('.inv-edit')) paint(); });
    main.querySelectorAll('#invV [data-v]').forEach((b) => b.addEventListener('click', () => { INV.vista = b.dataset.v; U.lsSet('vedith-vista', INV.vista); main.querySelectorAll('#invV button').forEach((x) => x.setAttribute('aria-pressed', x === b)); paint(); }));
    const nv = main.querySelector('#invNuevo'); if (nv) nv.addEventListener('click', () => APP.productoRapido());
    const pn = main.querySelector('#pasoNuevo'); if (pn) pn.addEventListener('click', () => APP.productoRapido());
    const po = main.querySelector('#pasosOcultar'); if (po) po.addEventListener('click', () => { U.lsSet('vedith-pasos-ok', true); main.querySelector('.pasos').remove(); });
    pintarTandas(); paint();
    main.querySelector('#invQ').addEventListener('input', U.debounce((e) => { INV.q = e.target.value; paint(); }, 120));
    main.querySelectorAll('#invF [data-f]').forEach((b) => b.addEventListener('click', () => { INV.f = b.dataset.f; main.querySelectorAll('#invF .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); paint(); }));
    if (ad) APP.cargarUso().then((u) => {
      const a = main.querySelector('#invAviso'); if (!a || !u || u.total == null) return;
      if (u.total / totalBytes() >= 0.8) a.innerHTML = `<a class="banner bad" href="#/ajustes" style="text-decoration:none;color:inherit">${icon('alert')}<span class="grow"><b>Queda poco espacio para fotos.</b> <span class="small muted">Usado ${fmtBytes(u.total)} de ${fmtBytes(totalBytes())}.</span></span>${icon('chevron', 'sm')}</a>`;
    });
  };
})();
