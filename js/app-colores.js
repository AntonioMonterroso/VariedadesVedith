/* Variantes por producto (colores y/o diseños), stock por variante e INGRESO RÁPIDO.
   - Una variante puede ser un color ("Rosa"), un diseño ("Capibara") o los dos ("Capibara · Rosa").
     Cada una lleva su propia existencia.
   - Los colores y diseños "predeterminados" se pueden ampliar (Ajustes y al agregar uno nuevo).
   - Cada producto puede apagar el aviso de "se acabó / queda poco" (y entonces se puede vender
     aunque ya no haya: la existencia nunca baja de 0).
   - Ingreso rápido: sumar piezas a varios productos y variantes de una sola vez. */
(function () {
  'use strict';
  const { icon, esc, toast, openModal } = U;
  const APP = window.APP;
  const P = APP.pages;

  /* ---------- predeterminados (base + los que agrega la administradora) ---------- */
  const BASE_COL = [['Rojo', '#D8473F'], ['Rosa', '#EC6478'], ['Naranja', '#F08A24'], ['Amarillo', '#F2C230'], ['Verde', '#2E9A5B'],
    ['Turquesa', '#1AA5A3'], ['Azul', '#2F6FD0'], ['Morado', '#8A55C4'], ['Blanco', '#FFFFFF'], ['Negro', '#222222'],
    ['Gris', '#8A9496'], ['Café', '#7A4E32'], ['Transparente', '#DDEBEE']];
  const BASE_DIS = ['Capibara', 'Princesas', 'Carros', 'Unicornios', 'Dinosaurios', 'Superhéroes', 'Sirenas', 'Flores', 'Estrellas', 'Animales'];
  const validHex = (h) => /^#[0-9a-f]{6}$/i.test(h || '');
  const igual = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const leer = (clave) => { try { const a = JSON.parse((APP.config || {})[clave] || '[]'); return Array.isArray(a) ? a.filter((x) => x && x.n) : []; } catch (_) { return []; } };
  APP.extrasColor = () => leer('colores_extra').filter((x) => !BASE_COL.some(([b]) => igual(b, x.n)));
  APP.extrasDiseno = () => leer('disenos_extra').filter((x) => !BASE_DIS.some((b) => igual(b, x.n)));
  APP.presetsColor = () => [...BASE_COL, ...APP.extrasColor().map((x) => [x.n, validHex(x.h) ? x.h : ''])];
  APP.presetsDiseno = () => [...BASE_DIS, ...APP.extrasDiseno().map((x) => x.n)];
  async function guardarLista(clave, lista) { const v = JSON.stringify(lista); await API.setConfig({ [clave]: v }); APP.config[clave] = v; }
  APP.guardarPreset = async function (tipo, nombre, hex) {
    nombre = String(nombre || '').trim(); if (!nombre) return false;
    if (tipo === 'diseno') { if (APP.presetsDiseno().some((n) => igual(n, nombre))) return false; await guardarLista('disenos_extra', [...leer('disenos_extra'), { n: nombre }]); }
    else { if (APP.presetsColor().some(([n]) => igual(n, nombre))) return false; await guardarLista('colores_extra', [...leer('colores_extra'), { n: nombre, h: validHex(hex) ? hex : '' }]); }
    return true;
  };
  APP.quitarPreset = async function (tipo, nombre) {
    const clave = tipo === 'diseno' ? 'disenos_extra' : 'colores_extra';
    await guardarLista(clave, leer(clave).filter((x) => !igual(x.n, nombre)));
  };

  const hexPorNombre = (n) => { const x = APP.presetsColor().find(([k]) => igual(k, n || '')); return x ? x[1] : ''; };
  APP.hexColor = (nombre, hex) => (validHex(hex) ? hex : hexPorNombre(nombre));
  // Punto de color; si son varios colores ("Rosa + Azul") se dibuja partido en sectores
  APP.dot = (nombre, hex, hexes) => {
    let hs = String(hexes || '').split(',').filter(validHex);
    if (hs.length < 2 && String(nombre || '').includes(' + ')) hs = String(nombre).split(' + ').map((n) => hexPorNombre(n)).filter(Boolean);
    if (hs.length > 1) { const k = 100 / hs.length; return `<span class="col-dot" style="background:conic-gradient(${hs.map((h, i) => `${h} ${i * k}% ${(i + 1) * k}%`).join(',')})" aria-hidden="true"></span>`; }
    const h = APP.hexColor(nombre, hex); return `<span class="col-dot ${h ? '' : 'sin'}" ${h ? `style="background:${h}"` : ''} aria-hidden="true"></span>`;
  };
  const tagDis = `<span class="dis-tag" aria-hidden="true">${icon('tag', 'sm')}</span>`;
  // Marca visual de una variante: etiqueta si tiene diseño, punto si tiene color
  APP.vdot = (c) => {
    const t = c.tono || (!c.diseno ? c.color : '');
    const th = c.foto ? `<span class="var-th" data-foto="${esc(c.foto)}">${U.imgTag(c.foto, '')}</span>` : '';   // foto del diseño
    return `${th}${c.diseno ? tagDis : ''}${t ? APP.dot(t, c.hex, c.hexes) : ''}`;
  };
  // Al tocar la foto de un diseño se ve en grande
  APP.bindVarFotos = (root) => root.querySelectorAll('.var-th[data-foto]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); APP.lightbox([el.dataset.foto], 0); }));
  APP.etiquetaVar = (p) => {
    const cs = p.colores || [], d = cs.some((c) => c.diseno), t = cs.some((c) => c.tono || !c.diseno);
    return d && t ? 'opcion' : d ? 'diseno' : 'color';
  };
  const TXT = { color: ['Colores', '¿De qué color?', 'color'], diseno: ['Diseños', '¿Qué diseño?', 'diseño'], opcion: ['Opciones', '¿Cuál opción?', 'opción'] };
  APP.textoVar = (p) => TXT[APP.etiquetaVar(p)];
  APP.dots = (p, max = 6) => {
    if (!(p.usa_colores && p.colores && p.colores.length)) return '';
    const tonos = [], vistos = new Set();
    p.colores.forEach((c) => { const t = c.tono || (!c.diseno ? c.color : ''); if (t && !vistos.has(t.toLowerCase())) { vistos.add(t.toLowerCase()); tonos.push({ n: t, h: c.hex, hs: c.hexes }); } });
    const dis = new Set(p.colores.map((c) => c.diseno).filter(Boolean));
    return `<span class="col-dots" role="img" aria-label="${esc(p.colores.map((c) => c.color).join(', '))}">${tonos.slice(0, max).map((t) => APP.dot(t.n, t.h, t.hs)).join('')}${tonos.length > max ? `<span class="xs muted">+${tonos.length - max}</span>` : ''}${dis.size ? `<span class="xs muted">${tonos.length ? ' · ' : ''}${dis.size} ${dis.size === 1 ? 'diseño' : 'diseños'}</span>` : ''}</span>`;
  };

  /* Con el aviso apagado nunca se bloquea una venta por falta de existencia */
  APP.sinStock = (p) => p.avisar_stock !== false && p.cantidad <= 0;
  APP.maxVenta = (p, color) => {
    if (p.avisar_stock === false) return Infinity;
    if (p.usa_colores) { const c = (p.colores || []).find((x) => x.color === color); return c ? Number(c.cantidad) || 0 : 0; }
    return p.cantidad;
  };
  APP.pillColor = (p, c) => (p.avisar_stock === false || c.cantidad == null ? '' : c.cantidad <= 0 ? '<span class="pill bad">Agotado</span>' : `<span class="pill ${c.cantidad <= (p.stock_minimo ?? 2) ? 'warn' : 'ok'}">${c.cantidad}</span>`);

  /* ---------- elegir una variante (al vender o al pedir una caja) ---------- */
  APP.elegirColor = function (p, cb, opts = {}) {
    const cols = p.colores || [];
    if (!cols.length) return cb(null);
    if (cols.length === 1 && !opts.siempre) return cb(cols[0].color);
    const m = openModal({
      title: APP.textoVar(p)[1],
      body: `<p class="muted small">${esc(p.nombre)}</p><div class="list">${cols.map((c) => {
        const agotado = !opts.todos && p.avisar_stock !== false && c.cantidad != null && c.cantidad <= 0;
        return `<button type="button" class="item" data-c="${esc(c.color)}" ${agotado ? 'disabled style="opacity:.5"' : ''}>${APP.vdot(c)}<span class="grow t1">${esc(c.color)}</span>${APP.pillColor(p, c)}</button>`;
      }).join('')}</div>`
    });
    m.body.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { const c = b.dataset.c; m.close(); cb(c); }));
  };

  // Elegir dos o más colores para una sola opción (ej.: "Rosa + Azul"). cb(nombre, hexPrimero, hexesComa)
  function combinar(cb) {
    const sel = [];
    const m = openModal({ title: 'Combinar colores', body: `<p class="muted small">Toca dos o más colores que lleva la misma pieza.</p>
      <div class="chips" style="flex-wrap:wrap;overflow:visible">${APP.presetsColor().map(([n, h]) => `<button type="button" class="chip col-chip" data-n="${esc(n)}" data-h="${esc(h)}" aria-pressed="false">${APP.dot(n, h)}${esc(n)}</button>`).join('')}</div>
      <div class="row small" id="cbVista" aria-live="polite"></div>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok disabled>Usar esta combinación</button>' });
    const ok = m.foot.querySelector('[data-ok]');
    const pintar = () => { m.body.querySelector('#cbVista').innerHTML = sel.length ? `${APP.dot(sel.map((x) => x.n).join(' + '), '', sel.map((x) => x.h).join(','))}<b>${esc(sel.map((x) => x.n).join(' + '))}</b>` : ''; ok.disabled = sel.length < 2; };
    m.body.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => {
      const i = sel.findIndex((x) => x.n === b.dataset.n); if (i >= 0) sel.splice(i, 1); else sel.push({ n: b.dataset.n, h: b.dataset.h });
      b.setAttribute('aria-pressed', String(i < 0)); pintar();
    }));
    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    ok.addEventListener('click', () => { m.close(); cb(sel.map((x) => x.n).join(' + '), sel[0].h, sel.map((x) => x.h).filter(validHex).join(',')); });
  }

  /* =====================================================================
     EDITOR DE VARIANTES: diseños y/o colores, con existencia de cada combinación
     host: elemento · rows: [{color, diseno, tono, hex, cantidad}] · opts.onChange(total)
     ===================================================================== */
  // Elegir los colores de UN grupo (los sueltos o los de un diseño). Cambia g.tonos directamente.
  function selectorColores(titulo, d, g, qty, onClose) {
    const llave = (t) => `${d || ''}|${t || ''}`;
    let m;
    const pintarSel = () => {
      const nom = [...APP.presetsColor().map(([n, h]) => [n, h, '']), ...g.tonos.filter((t) => !APP.presetsColor().some(([p]) => igual(p, t.n))).map((t) => [t.n, t.h, t.hs || ''])];
      m.body.innerHTML = `<p class="muted small">Toca los colores que tiene. Solo se guardan los que elijas aquí.</p>
        <div class="chips" style="flex-wrap:wrap;overflow:visible">${nom.map(([n, h, hs]) => `<button type="button" class="chip col-chip" data-t="${esc(n)}" data-h="${esc(h)}" data-hs="${esc(hs)}" aria-pressed="${g.tonos.some((x) => igual(x.n, n))}">${APP.dot(n, h, hs)}${esc(n)}</button>`).join('')}</div>
        <button type="button" class="btn ghost sm" data-combinar style="justify-self:start">${icon('plus', 'sm')} Combinar dos o más colores</button>
        <div class="row"><label class="col-pick" aria-label="Tono del color nuevo"><input type="color" value="#cccccc" data-hc><span class="col-dot" style="background:#cccccc"></span></label><input class="input grow" data-nt maxlength="30" placeholder="Otro color" aria-label="Otro color"><button type="button" class="btn secondary sm" data-addt>Agregar</button></div>
        <label class="row small"><input type="checkbox" data-guardar checked style="width:20px;height:20px;accent-color:var(--pink-600)"> <span>Guardar lo nuevo en mis predeterminados</span></label>`;
      m.body.querySelectorAll('[data-t]').forEach((bt) => bt.addEventListener('click', () => {
        const i = g.tonos.findIndex((x) => igual(x.n, bt.dataset.t));
        if (i >= 0) { if ((qty[llave(g.tonos[i].n)] || 0) > 0) return toast('Ese color tiene piezas. Ponle 0 antes de quitarlo.', { error: true }); g.tonos.splice(i, 1); }
        else g.tonos.push({ n: bt.dataset.t, h: bt.dataset.h, hs: bt.dataset.hs || '' });
        pintarSel();
      }));
      m.body.querySelector('[data-combinar]').addEventListener('click', () => combinar((n, h, hs) => { if (!g.tonos.some((x) => igual(x.n, n))) g.tonos.push({ n, h, hs }); pintarSel(); }));
      const hc = m.body.querySelector('[data-hc]');
      hc.addEventListener('input', () => { hc.dataset.tocado = '1'; hc.nextElementSibling.style.background = hc.value; });
      const agregar = async () => {
        const inp = m.body.querySelector('[data-nt]'), nombre = inp.value.trim(); if (!nombre) return inp.focus();
        const hex = hc.dataset.tocado ? hc.value : '';
        if (!g.tonos.some((x) => igual(x.n, nombre))) g.tonos.push({ n: nombre, h: hexPorNombre(nombre) || hex, hs: '' });
        if (m.body.querySelector('[data-guardar]').checked) { try { if (await APP.guardarPreset('color', nombre, hex)) toast(`«${nombre}» guardado en tus predeterminados`); } catch (e) { console.error(e); } }
        pintarSel();
      };
      m.body.querySelector('[data-addt]').addEventListener('click', agregar);
      m.body.querySelector('[data-nt]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } });
    };
    m = openModal({ title: titulo, body: '', footer: '<button type="button" class="btn" data-ok>Listo</button>', onClose });
    m.foot.querySelector('[data-ok]').addEventListener('click', () => m.close());
    pintarSel();
  }

  /* =====================================================================
     EDITOR DE VARIANTES: cada diseño (y los colores sueltos) tiene SUS PROPIOS colores
     host: elemento · rows: [{color, diseno, tono, hex, hexes, cantidad}] · opts.onChange(total)
     ===================================================================== */
  APP.editorColores = function (host, rows, opts = {}) {
    const llave = (d, t) => `${d || ''}|${t || ''}`;
    const dis = [], grupos = {}, qty = {}, fotos = {};     // fotos: diseño → link de su foto
    let sinDis = false;
    const grupo = (d) => (grupos[d] = grupos[d] || { tonos: [] });
    (rows || []).forEach((r) => {
      const d = r.diseno || '', t = r.tono || (!r.diseno ? r.color : '');
      if (d && !dis.some((x) => igual(x, d))) dis.push(d);
      if (d && r.foto) fotos[d] = r.foto;
      if (!d) sinDis = true;
      const g = grupo(d);
      if (t && !g.tonos.some((x) => igual(x.n, t))) g.tonos.push({ n: t, h: validHex(r.hex) ? r.hex : hexPorNombre(t), hs: r.hexes || '' });
      qty[llave(d, t)] = Number(r.cantidad) || 0;
    });
    grupo('');
    if (!dis.length) sinDis = true;                       // sin diseños, los colores van "sueltos"
    const lista = () => (dis.length ? [...(sinDis ? [''] : []), ...dis] : ['']);
    const filasDe = (d) => { const g = grupo(d); if (g.tonos.length) return g.tonos.map((t) => ({ d, t: t.n, h: t.h, hs: t.hs || '' })); return d ? [{ d, t: '', h: '', hs: '' }] : []; };
    const combos = () => lista().flatMap(filasDe);
    const total = () => combos().reduce((s, c) => s + (qty[llave(c.d, c.t)] || 0), 0);
    const aviso = () => { if (opts.onChange) opts.onChange(total()); const t = host.querySelector('[data-total]'); if (t) t.textContent = total(); };

    function pintar() {
      const nomDis = [...APP.presetsDiseno(), ...dis.filter((d) => !APP.presetsDiseno().some((p) => igual(p, d)))];
      const bloques = lista().map((d) => {
        const g = grupo(d), filas = filasDe(d);
        const titulo = d ? `${tagDis}<b>${esc(d)}</b>` : `<b>${dis.length ? 'Colores sueltos (sin diseño)' : 'Colores'}</b>`;
        return `<div class="ve-grupo" data-g="${esc(d)}">
          <div class="ve-cab">${titulo}<span class="grow"></span>
            ${dis.length > 1 && g.tonos.length ? '<button type="button" class="btn ghost sm" data-copiar>Copiar colores a los demás</button>' : ''}
            <button type="button" class="btn secondary sm" data-addcol>${icon('plus', 'sm')} Colores</button></div>
          ${d ? (opts.sinFotos ? '<p class="xs muted">Para poner foto a los diseños falta correr <b>migracion_fotos_disenos.sql</b> en Supabase.</p>'
            : `<div class="foto-link" style="grid-template-columns:48px 1fr"><div class="prev" data-prev style="width:48px;height:48px">${fotos[d] ? U.imgTag(fotos[d], '') : icon('image')}</div><div><input class="input" data-furl type="url" inputmode="url" placeholder="Foto de este diseño: pega el link (opcional)" aria-label="Foto del diseño ${esc(d)}" value="${esc(fotos[d] || '')}"><div class="msg" data-fmsg hidden></div></div></div>`) : ''}
          ${filas.length ? filas.map((f) => {
            const k = llave(f.d, f.t);
            return `<div class="lote-fila" data-k="${esc(k)}">${f.t ? APP.dot(f.t, f.h, f.hs) : tagDis}<span class="grow t1">${esc(f.t || f.d)}${!f.t && f.d ? ' <span class="xs muted">(solo el diseño)</span>' : ''}</span>
              <div class="stepper" role="group" aria-label="Existencia"><button type="button" data-minus aria-label="Menos">${icon('minus')}</button><input type="number" inputmode="numeric" min="0" value="${qty[k] || 0}" data-cant aria-label="Piezas"><button type="button" data-plus aria-label="Más">${icon('plus')}</button></div>
              ${f.t ? `<button type="button" class="icon-btn" data-quitar aria-label="Quitar ${esc(f.t)}" ${(qty[k] || 0) > 0 ? 'disabled' : ''}>${icon('x')}</button>` : ''}</div>`;
          }).join('') : '<p class="small muted">Sin colores todavía. Toca «Colores» para elegir cuáles tiene.</p>'}</div>`;
      }).join('');
      host.innerHTML = `<div class="stack">
        ${opts.piezasPrevias > 0 ? `<div class="banner">${icon('info')}<span class="small">Antes tenía ${opts.piezasPrevias} piezas sin repartir. Escríbelas en la opción que corresponda.</span></div>` : ''}
        ${opts.sinDisenos ? `<div class="banner">${icon('alert')}<span class="small">Para guardar <b>diseños</b> falta correr <b>migracion_disenos.sql</b> en Supabase. Mientras tanto solo se pueden guardar colores.</span></div>` : `<div class="stack-sm"><span class="small" style="font-weight:800">Diseños <span class="muted" style="font-weight:600">· si no tiene, déjalo vacío</span></span>
          <div class="chips" style="flex-wrap:wrap;overflow:visible">${dis.length ? `<button type="button" class="chip" data-sd aria-pressed="${sinDis}">Colores sueltos (sin diseño)</button>` : ''}${nomDis.map((n) => `<button type="button" class="chip" data-d="${esc(n)}" aria-pressed="${dis.some((x) => igual(x, n))}"><span class="dis-tag">${icon('tag', 'sm')}</span>${esc(n)}</button>`).join('')}</div>
          <div class="row"><input class="input grow" data-nd maxlength="30" placeholder="Otro diseño" aria-label="Otro diseño"><button type="button" class="btn secondary sm" data-addd>Agregar</button></div>
          <label class="row small"><input type="checkbox" data-guardar checked style="width:20px;height:20px;accent-color:var(--pink-600)"> <span>Guardar los diseños nuevos en mis predeterminados</span></label></div>`}
        <div class="stack-sm">${bloques}</div>
        <div class="row between small"><span class="muted">Total de piezas</span><b class="num" data-total>${total()}</b></div></div>`;

      const alAgregarDiseno = (antes) => { if (!antes && dis.length) sinDis = grupo('').tonos.length > 0; };   // los colores que ya había quedan como sueltos
      host.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
        const antes = dis.length, i = dis.findIndex((x) => igual(x, b.dataset.d));
        if (i >= 0) { const hay = filasDe(dis[i]).some((f) => (qty[llave(f.d, f.t)] || 0) > 0); if (hay) return toast('Ese diseño tiene piezas. Ponle 0 antes de quitarlo.', { error: true }); delete grupos[dis[i]]; delete fotos[dis[i]]; dis.splice(i, 1); if (!dis.length) sinDis = true; }
        else { dis.push(b.dataset.d); alAgregarDiseno(antes); }
        pintar(); aviso();
      }));
      const sd = host.querySelector('[data-sd]');
      if (sd) sd.addEventListener('click', () => { if (sinDis && filasDe('').some((f) => (qty[llave('', f.t)] || 0) > 0)) return toast('Los colores sueltos tienen piezas. Ponles 0 antes de quitarlos.', { error: true }); sinDis = !sinDis; pintar(); aviso(); });
      const nuevoDis = async () => {
        const inp = host.querySelector('[data-nd]'), nombre = inp.value.trim(); if (!nombre) return inp.focus();
        if (!dis.some((x) => igual(x, nombre))) { const antes = dis.length; dis.push(nombre); alAgregarDiseno(antes); }
        if (host.querySelector('[data-guardar]').checked) { try { if (await APP.guardarPreset('diseno', nombre)) toast(`«${nombre}» guardado en tus predeterminados`); } catch (e) { console.error(e); } }
        pintar(); aviso();
      };
      const ad = host.querySelector('[data-addd]'); if (ad) ad.addEventListener('click', nuevoDis);
      const nd = host.querySelector('[data-nd]'); if (nd) nd.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nuevoDis(); } });

      host.querySelectorAll('.ve-grupo').forEach((bl) => {
        const d = bl.dataset.g, g = grupo(d);
        bl.querySelector('[data-addcol]').addEventListener('click', () => selectorColores(d ? `Colores de «${d}»` : 'Colores sueltos', d, g, qty, () => { pintar(); aviso(); }));
        const fu = bl.querySelector('[data-furl]');
        if (fu) {
          const prev = bl.querySelector('[data-prev]'), msg = bl.querySelector('[data-fmsg]');
          fu.addEventListener('input', U.debounce(() => {
            const raw = fu.value.trim(); msg.hidden = true; fu.classList.remove('bad');
            if (!raw) { fotos[d] = ''; prev.innerHTML = icon('image'); return; }
            const url = U.imageUrl(raw);
            if (!U.validUrl(url)) { fotos[d] = ''; msg.textContent = 'Debe empezar con https://'; msg.hidden = false; fu.classList.add('bad'); return; }
            fotos[d] = url;
            const im = new Image(); im.referrerPolicy = 'no-referrer';
            im.onload = () => { prev.innerHTML = ''; prev.appendChild(im); im.style.cssText = 'width:100%;height:100%;object-fit:cover'; };
            im.onerror = () => { msg.textContent = 'No se pudo cargar esa foto. Usa el link directo de la imagen.'; msg.hidden = false; prev.innerHTML = icon('alert'); };
            im.src = url;
          }, 350));
        }
        const cp = bl.querySelector('[data-copiar]');
        if (cp) cp.addEventListener('click', () => {
          dis.filter((x) => x !== d).forEach((o) => { const og = grupo(o); g.tonos.forEach((t) => { if (!og.tonos.some((x) => igual(x.n, t.n))) og.tonos.push({ ...t }); }); });
          toast('Colores copiados a los demás diseños'); pintar(); aviso();
        });
        bl.querySelectorAll('.lote-fila').forEach((fila) => {
          const k = fila.dataset.k, cant = fila.querySelector('[data-cant]');
          const poner = (n) => { qty[k] = Math.max(0, n || 0); cant.value = qty[k]; const q = fila.querySelector('[data-quitar]'); if (q) q.disabled = qty[k] > 0; aviso(); };
          cant.addEventListener('input', () => poner(parseInt(cant.value, 10) || 0));
          fila.querySelector('[data-minus]').addEventListener('click', () => poner((parseInt(cant.value, 10) || 0) - 1));
          fila.querySelector('[data-plus]').addEventListener('click', () => poner((parseInt(cant.value, 10) || 0) + 1));
          const q = fila.querySelector('[data-quitar]');
          if (q) q.addEventListener('click', () => { const t = k.split('|')[1]; g.tonos = g.tonos.filter((x) => x.n !== t); pintar(); aviso(); });
        });
      });
    }
    pintar();
    return {
      total,
      get() {
        return { colores: combos().map((c) => ({ color: [c.d, c.t].filter(Boolean).join(' · '), diseno: c.d || null, tono: c.t || null, hex: c.t && validHex(c.h) ? c.h : '', hexes: c.t && String(c.hs || '').split(',').filter(validHex).length > 1 ? c.hs : '', foto: c.d ? (fotos[c.d] || '') : '', cantidad: qty[llave(c.d, c.t)] || 0 })) };
      }
    };
  };

  /* =====================================================================
     PRODUCTO RÁPIDO: nombre, precio y existencia (o variantes) y listo
     ===================================================================== */
  APP.productoRapido = function (opts = {}) {
    let ed = null;
    const m = openModal({
      title: 'Producto rápido', wide: true,
      body: `<div class="stack">
        <label class="field">Nombre *<input class="input" id="prNombre" value="${esc(opts.nombre || '')}" maxlength="120" placeholder="Ej.: Botella EcoTwist 750 ml" autofocus></label>
        <div class="grid-2"><label class="field">Precio de venta *<input class="input" id="prPrecio" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></label>
          <label class="field">Costo <span class="hint">opcional</span><input class="input" id="prCosto" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></label></div>
        <label class="row"><input type="checkbox" id="prCol" style="width:22px;height:22px;accent-color:var(--pink-600)"> <span><b>Viene en varios colores o diseños</b></span></label>
        <div id="prSin"><label class="field">¿Cuántas piezas hay?<input class="input" id="prCant" type="number" inputmode="numeric" min="0" value="1"></label></div>
        <div id="prConColor" hidden></div></div>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok>Crear producto</button>'
    });
    const g = (s) => m.body.querySelector(s);
    g('#prCol').addEventListener('change', (e) => {
      g('#prSin').hidden = e.target.checked; g('#prConColor').hidden = !e.target.checked;
      if (e.target.checked && !ed) ed = APP.editorColores(g('#prConColor'), []);
    });
    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const nombre = g('#prNombre').value.trim(), precio = g('#prPrecio').value;
      if (!nombre) { g('#prNombre').focus(); return toast('Falta el nombre.', { error: true }); }
      if (precio === '' || Number(precio) < 0) { g('#prPrecio').focus(); return toast('Falta el precio de venta.', { error: true }); }
      const usa = g('#prCol').checked; let colores = [];
      if (usa) { colores = ed.get().colores; if (!colores.length) return toast('Elige al menos un diseño o un color.', { error: true }); }
      const btn = m.foot.querySelector('[data-ok]'); btn.disabled = true;
      try {
        const id = await API.saveProducto({ nombre, precio, costo: g('#prCosto').value || 0, cantidad: usa ? 0 : g('#prCant').value, stock_minimo: 2, activo: true, fotos: [], usa_colores: usa, colores, avisar_stock: false, campana: U.lsGet('vedith-campana', '') });
        await APP.refreshCore(); m.close(); toast(`«${nombre}» creado`);
        if (opts.onCreated) opts.onCreated(id); else APP.render();
      } catch (e) { btn.disabled = false; APP.handleErr(e); }
    });
  };

  /* =====================================================================
     AJUSTES: colores y diseños predeterminados
     ===================================================================== */
  APP.panelPresets = function (host) {
    const pintar = () => {
      const ec = APP.extrasColor(), ed = APP.extrasDiseno();
      host.innerHTML = `<h2>Colores y diseños predeterminados</h2>
        <p class="small muted">Son los que aparecen para tocar al armar un producto. Agrega los tuyos aquí (los que ya vienen no se borran).</p>
        <div class="stack-sm"><b class="small">Colores</b>
          <div class="chips" style="flex-wrap:wrap;overflow:visible">${BASE_COL.map(([n, h]) => `<span class="chip" style="cursor:default"><span class="col-dot" style="background:${h}"></span>${esc(n)}</span>`).join('')}
            ${ec.map((x) => `<span class="chip" style="cursor:default">${APP.dot(x.n, x.h)}${esc(x.n)}<button type="button" class="icon-btn" style="width:28px;height:28px" data-qc="${esc(x.n)}" aria-label="Quitar ${esc(x.n)}">${icon('x', 'sm')}</button></span>`).join('')}</div>
          <div class="row"><label class="col-pick" aria-label="Tono"><input type="color" value="#cccccc" data-pc><span class="col-dot" style="background:#cccccc"></span></label><input class="input grow" data-pcn maxlength="30" placeholder="Color nuevo (ej.: Lila)"><button type="button" class="btn secondary sm" data-pca>Agregar</button></div></div>
        <div class="stack-sm"><b class="small">Diseños</b>
          <div class="chips" style="flex-wrap:wrap;overflow:visible">${BASE_DIS.map((n) => `<span class="chip" style="cursor:default">${tagDis}${esc(n)}</span>`).join('')}
            ${ed.map((x) => `<span class="chip" style="cursor:default">${tagDis}${esc(x.n)}<button type="button" class="icon-btn" style="width:28px;height:28px" data-qd="${esc(x.n)}" aria-label="Quitar ${esc(x.n)}">${icon('x', 'sm')}</button></span>`).join('')}</div>
          <div class="row"><input class="input grow" data-pdn maxlength="30" placeholder="Diseño nuevo (ej.: Gatitos)"><button type="button" class="btn secondary sm" data-pda>Agregar</button></div></div>`;
      host.querySelector('[data-pc]').addEventListener('input', (e) => { e.target.dataset.tocado = '1'; e.target.nextElementSibling.style.background = e.target.value; });
      const agregar = async (tipo, sel, hex) => {
        const inp = host.querySelector(sel), n = inp.value.trim(); if (!n) return inp.focus();
        try { const ok = await APP.guardarPreset(tipo, n, hex); toast(ok ? `«${n}» agregado` : 'Ese ya existe.', ok ? {} : { error: true }); pintar(); } catch (e) { APP.handleErr(e); }
      };
      host.querySelector('[data-pca]').addEventListener('click', () => agregar('color', '[data-pcn]', host.querySelector('[data-pc]').dataset.tocado ? host.querySelector('[data-pc]').value : ''));
      host.querySelector('[data-pda]').addEventListener('click', () => agregar('diseno', '[data-pdn]'));
      host.querySelectorAll('[data-qc]').forEach((b) => b.addEventListener('click', async () => { try { await APP.quitarPreset('color', b.dataset.qc); pintar(); } catch (e) { APP.handleErr(e); } }));
      host.querySelectorAll('[data-qd]').forEach((b) => b.addEventListener('click', async () => { try { await APP.quitarPreset('diseno', b.dataset.qd); pintar(); } catch (e) { APP.handleErr(e); } }));
    };
    pintar();
  };

  /* =====================================================================
     INGRESO RÁPIDO (página)
     ===================================================================== */
  const lote = []; // [{ pid, qty: { '<variante>' | '': n }, extra: [{color, diseno, tono, hex}] }]
  const entrada = (pid) => lote.find((x) => x.pid === pid);
  function agregarALote(pid, color) {
    const p = APP.prod(pid); if (!p) return;
    let e = entrada(pid); if (!e) { e = { pid, qty: {}, extra: [] }; lote.unshift(e); }
    if (p.usa_colores) { if (color) e.qty[color] = (e.qty[color] || 0) + 1; }
    else e.qty[''] = (e.qty[''] || 0) + 1;
  }
  const totalLote = () => lote.reduce((s, e) => s + Object.values(e.qty).reduce((a, n) => a + (n || 0), 0), 0);

  P.ingreso = async function (main) {
    if (APP.loteInicial) { APP.loteInicial.forEach((id) => { if (!entrada(id)) lote.unshift({ pid: id, qty: {}, extra: [] }); }); APP.loteInicial = null; }
    const faltaSql = API.mode === 'supabase' && API._colores === false;

    function pintar() {
      main.innerHTML = `
        <div class="page-head"><div><h1>Ingreso rápido</h1><p class="sub">Suma piezas a varios productos de una sola vez.</p></div>
          <button type="button" class="btn secondary" id="irNuevo">${icon('plus')} Producto rápido</button></div>
        ${faltaSql ? `<div class="banner">${icon('alert')}<span class="small">Para usar colores y diseños falta correr <b>migracion_colores.sql</b> en Supabase. Mientras tanto el ingreso funciona sin ellos.</span></div>` : ''}
        <div class="row" style="margin:12px 0">
          <div class="searchbox grow">${icon('search')}<input class="input" id="irQ" type="search" placeholder="Busca un producto para sumarle piezas…" autocomplete="off"></div>
          <button type="button" class="icon-btn" id="irScan" aria-label="Escanear QR" style="border:1.5px solid var(--line-strong);border-radius:14px;width:52px;height:52px">${icon('scan')}</button>
        </div>
        <div id="irRes" class="pick-list" hidden></div>
        <div class="stack" id="irLote">${lote.length ? lote.map(tarjeta).join('') : `<div class="card empty">${icon('package', 'lg')}<p>Busca o escanea un producto. Le pones cuántas piezas llegaron (por color o diseño si tiene) y al final lo guardas todo junto.</p></div>`}</div>
        <div class="lote-bar"><span class="small muted" aria-live="polite"><b class="num" id="irTot">${totalLote()}</b> piezas por sumar</span><button type="button" class="btn green" id="irGuardar" ${totalLote() ? '' : 'disabled'}>${icon('check')} Sumar al inventario</button></div>`;
      enlazar();
    }
    function tarjeta(e) {
      const p = APP.prod(e.pid); if (!p) return '';
      const foto = p.fotos && p.fotos[0];
      const filas = p.usa_colores
        ? [...p.colores.map((c) => ({ ...c, actual: c.cantidad })), ...e.extra.filter((x) => !p.colores.some((c) => c.color === x.color)).map((x) => ({ ...x, actual: 0, nuevo: true }))]
        : [{ color: '', actual: p.cantidad }];
      return `<section class="card lote-card" data-pid="${esc(p.id)}">
        <div class="row"><span class="thumb" style="width:48px;height:48px;border-radius:12px;overflow:hidden;background:var(--surface-2);display:grid;place-items:center;flex:none">${foto ? U.imgTag(foto, '') : icon('image')}</span>
          <div class="grow" style="min-width:0"><div class="t1 ellipsis" style="font-weight:800">${esc(p.nombre)}</div><div class="xs muted">${esc(p.codigo)} · hoy hay ${p.cantidad}</div></div>
          <button type="button" class="icon-btn" data-quitar aria-label="Quitar del ingreso">${icon('x')}</button></div>
        <div class="stack-sm">${filas.map((f) => {
          const n = e.qty[f.color] || 0;
          return `<div class="lote-fila" data-c="${esc(f.color)}">${p.usa_colores ? `${APP.vdot(f)}<span class="grow t1">${esc(f.color)}${f.nuevo ? ' <span class="pill pink">nuevo</span>' : ''}<span class="xs muted"> · hay ${f.actual}</span></span>` : '<span class="grow t1">Piezas que llegaron</span>'}
            <div class="stepper" role="group" aria-label="Piezas"><button type="button" data-minus aria-label="Menos">${icon('minus')}</button><input type="number" inputmode="numeric" min="0" value="${n || ''}" placeholder="0" data-cant aria-label="Piezas"><button type="button" data-plus aria-label="Más">${icon('plus')}</button></div>
            <button type="button" class="chip" data-mas5 aria-label="Sumar 5">+5</button></div>`;
        }).join('')}
          ${p.usa_colores ? `<button type="button" class="btn ghost sm" data-nuevocolor style="justify-self:start">${icon('plus', 'sm')} Opción nueva</button>` : ''}</div></section>`;
    }
    function enlazar() {
      const q = main.querySelector('#irQ'), res = main.querySelector('#irRes');
      const mostrar = () => {
        const txt = q.value.trim(); if (!txt) { res.hidden = true; return; }
        const lista = APP.productos.filter((p) => APP.matchProducto(p, txt)).slice(0, 8);
        res.hidden = false;
        res.innerHTML = lista.length ? lista.map((p) => APP.productoItem(p)).join('') : `<div class="empty"><p>No encontré «${esc(txt)}».</p><button type="button" class="btn sm" data-crear>Crear «${esc(txt)}» ahora</button></div>`;
        res.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => { agregarALote(b.dataset.id); pintar(); main.querySelector('#irQ').focus(); }));
        const cr = res.querySelector('[data-crear]'); if (cr) cr.addEventListener('click', () => APP.productoRapido({ nombre: txt, onCreated: (id) => { if (!entrada(id)) lote.unshift({ pid: id, qty: {}, extra: [] }); pintar(); } }));
      };
      q.addEventListener('input', mostrar);
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = res.querySelector('[data-id]'); if (b) b.click(); } });
      main.querySelector('#irScan').addEventListener('click', () => APP.openScanner({ onPick: (p) => { agregarALote(p.id); pintar(); toast('Agregado: ' + p.nombre); } }));
      main.querySelector('#irNuevo').addEventListener('click', () => APP.productoRapido({ onCreated: (id) => { if (!entrada(id)) lote.unshift({ pid: id, qty: {}, extra: [] }); pintar(); } }));

      main.querySelectorAll('.lote-card').forEach((card) => {
        const e = entrada(card.dataset.pid), p = APP.prod(card.dataset.pid);
        card.querySelector('[data-quitar]').addEventListener('click', () => { lote.splice(lote.indexOf(e), 1); pintar(); });
        card.querySelectorAll('.lote-fila').forEach((fila) => {
          const color = fila.dataset.c, cant = fila.querySelector('[data-cant]');
          const poner = (n) => { n = Math.max(0, n || 0); e.qty[color] = n; cant.value = n || ''; main.querySelector('#irTot').textContent = totalLote(); main.querySelector('#irGuardar').disabled = !totalLote(); };
          cant.addEventListener('input', () => poner(parseInt(cant.value, 10) || 0));
          fila.querySelector('[data-minus]').addEventListener('click', () => poner((parseInt(cant.value, 10) || 0) - 1));
          fila.querySelector('[data-plus]').addEventListener('click', () => poner((parseInt(cant.value, 10) || 0) + 1));
          fila.querySelector('[data-mas5]').addEventListener('click', () => poner((parseInt(cant.value, 10) || 0) + 5));
        });
        const nc = card.querySelector('[data-nuevocolor]');
        if (nc) nc.addEventListener('click', () => opcionNueva(p, e));
      });
      main.querySelector('#irGuardar').addEventListener('click', guardar);
    }
    // Opción nueva: un diseño, un color, o los dos juntos
    function opcionNueva(p, e) {
      let dSel = '', tSel = [], hSel = [];
      const disUsados = [...new Set(p.colores.map((c) => c.diseno).filter(Boolean))];
      const m = openModal({ title: 'Opción nueva', body: `<p class="muted small">${esc(p.nombre)} · elige un diseño, un color o los dos</p>
        ${API._variantes === false ? '' : '<div class="stack-sm"><b class="small">Diseño</b>'}<div class="chips" style="flex-wrap:wrap;overflow:visible" ${API._variantes === false ? 'hidden' : ''}>${[...new Set([...disUsados, ...APP.presetsDiseno()])].map((n) => `<button type="button" class="chip" data-d="${esc(n)}" aria-pressed="false">${esc(n)}</button>`).join('')}</div>
          <input class="input" id="onD" maxlength="30" placeholder="O escribe otro diseño" ${API._variantes === false ? 'hidden' : ''}>${API._variantes === false ? '' : '</div>'}
        <div class="stack-sm"><b class="small">Color <span class="muted" style="font-weight:600">· toca varios si lleva más de uno</span></b><div class="chips" style="flex-wrap:wrap;overflow:visible">${APP.presetsColor().map(([n, h]) => `<button type="button" class="chip col-chip" data-t="${esc(n)}" data-h="${esc(h)}" aria-pressed="false">${APP.dot(n, h)}${esc(n)}</button>`).join('')}</div>
          <input class="input" id="onT" maxlength="30" placeholder="O escribe otro color"></div>`,
        footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok>Agregar</button>' });
      const marcar = (sel, v) => m.body.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(Array.isArray(v) ? v.includes(b.dataset.t) : b.dataset.d === v)));
      m.body.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { dSel = dSel === b.dataset.d ? '' : b.dataset.d; m.body.querySelector('#onD').value = ''; marcar('[data-d]', dSel); }));
      m.body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { const i = tSel.indexOf(b.dataset.t); if (i >= 0) { tSel.splice(i, 1); hSel.splice(i, 1); } else { tSel.push(b.dataset.t); hSel.push(b.dataset.h); } m.body.querySelector('#onT').value = ''; marcar('[data-t]', tSel); }));
      m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
      m.foot.querySelector('[data-ok]').addEventListener('click', () => {
        const d = (m.body.querySelector('#onD').value.trim() || dSel), escrito = m.body.querySelector('#onT').value.trim(), t = escrito || tSel.join(' + ');
        if (!d && !t) return toast('Elige un diseño o un color.', { error: true });
        const color = [d, t].filter(Boolean).join(' · ');
        if (p.colores.some((c) => igual(c.color, color)) || e.extra.some((x) => igual(x.color, color))) { m.close(); return toast('Esa opción ya está en la lista.', { error: true }); }
        const hsv = escrito ? '' : hSel.filter(validHex).join(',');
        e.extra.push({ color, diseno: d || null, tono: t || null, hex: t ? ((escrito ? hexPorNombre(t) : hSel[0]) || '') : '', hexes: hsv.split(',').length > 1 ? hsv : '' }); e.qty[color] = 0; m.close(); pintar();
      });
    }
    async function guardar() {
      const items = [];
      lote.forEach((e) => { const p = APP.prod(e.pid); if (!p) return; Object.entries(e.qty).forEach(([color, n]) => { if (n > 0) { const ex = e.extra.find((x) => x.color === color); items.push({ producto_id: e.pid, color: p.usa_colores ? color : null, hex: ex ? ex.hex : null, hexes: ex ? ex.hexes : null, diseno: ex ? ex.diseno : null, tono: ex ? ex.tono : null, cantidad: n }); } }); });
      if (!items.length) return;
      const btn = main.querySelector('#irGuardar'); btn.disabled = true;
      try {
        const n = await API.ingresoRapido(items);
        const resumen = lote.map((e) => APP.prod(e.pid)).filter(Boolean).map((p) => p.nombre);
        lote.length = 0; await APP.refreshCore();
        toast(`Listo: se sumaron ${n} piezas a ${resumen.length} ${resumen.length === 1 ? 'producto' : 'productos'}.`, { ms: 4500 });
        pintar();
      } catch (e) { btn.disabled = false; APP.handleErr(e); }
    }
    pintar();
  };
})();
