/* Colores por producto, stock por color e INGRESO RÁPIDO.
   - Un producto puede tener varios colores; cada color lleva su propia existencia.
   - Cada producto puede apagar el aviso de "se acabó / queda poco" (y entonces se puede vender
     aunque ya no haya: la existencia nunca baja de 0).
   - Ingreso rápido: sumar piezas a varios productos y colores de una sola vez. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal } = U;
  const APP = window.APP;
  const P = APP.pages;

  /* ---------- colores comunes (se toca uno y se agrega) ---------- */
  APP.PRESETS = [['Rojo', '#D8473F'], ['Rosa', '#EC6478'], ['Naranja', '#F08A24'], ['Amarillo', '#F2C230'], ['Verde', '#2E9A5B'],
    ['Turquesa', '#1AA5A3'], ['Azul', '#2F6FD0'], ['Morado', '#8A55C4'], ['Blanco', '#FFFFFF'], ['Negro', '#222222'],
    ['Gris', '#8A9496'], ['Café', '#7A4E32'], ['Transparente', '#DDEBEE']];
  const validHex = (h) => /^#[0-9a-f]{6}$/i.test(h || '');
  const hexPorNombre = (n) => { const x = APP.PRESETS.find(([k]) => k.toLowerCase() === String(n || '').trim().toLowerCase()); return x ? x[1] : ''; };
  APP.hexColor = (nombre, hex) => (validHex(hex) ? hex : hexPorNombre(nombre));
  APP.dot = (nombre, hex) => { const h = APP.hexColor(nombre, hex); return `<span class="col-dot ${h ? '' : 'sin'}" ${h ? `style="background:${h}"` : ''} aria-hidden="true"></span>`; };
  APP.dots = (p, max = 6) => (p.usa_colores && p.colores && p.colores.length
    ? `<span class="col-dots" role="img" aria-label="Colores: ${esc(p.colores.map((c) => c.color).join(', '))}">${p.colores.slice(0, max).map((c) => APP.dot(c.color, c.hex)).join('')}${p.colores.length > max ? `<span class="xs muted">+${p.colores.length - max}</span>` : ''}</span>` : '');

  /* Con el aviso apagado nunca se bloquea una venta por falta de existencia */
  APP.sinStock = (p) => p.avisar_stock !== false && p.cantidad <= 0;
  APP.maxVenta = (p, color) => {
    if (p.avisar_stock === false) return Infinity;
    if (p.usa_colores) { const c = (p.colores || []).find((x) => x.color === color); return c ? Number(c.cantidad) || 0 : 0; }
    return p.cantidad;
  };
  APP.pillColor = (p, c) => (p.avisar_stock === false || c.cantidad == null ? '' : c.cantidad <= 0 ? '<span class="pill bad">Agotado</span>' : `<span class="pill ${c.cantidad <= (p.stock_minimo ?? 2) ? 'warn' : 'ok'}">${c.cantidad}</span>`);

  /* ---------- elegir un color (al vender o al pedir una caja) ---------- */
  APP.elegirColor = function (p, cb, opts = {}) {
    const cols = p.colores || [];
    if (!cols.length) return cb(null);
    if (cols.length === 1 && !opts.siempre) return cb(cols[0].color);
    const m = openModal({
      title: '¿De qué color?',
      body: `<p class="muted small">${esc(p.nombre)}</p><div class="list">${cols.map((c) => {
        const agotado = !opts.todos && p.avisar_stock !== false && c.cantidad != null && c.cantidad <= 0;
        return `<button type="button" class="item" data-c="${esc(c.color)}" ${agotado ? 'disabled style="opacity:.5"' : ''}>${APP.dot(c.color, c.hex)}<span class="grow t1">${esc(c.color)}</span>${APP.pillColor(p, c)}</button>`;
      }).join('')}</div>`
    });
    m.body.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { const c = b.dataset.c; m.close(); cb(c); }));
  };

  /* =====================================================================
     EDITOR DE COLORES (formulario de producto y producto rápido)
     host: elemento donde se dibuja · colores: [{color,hex,cantidad}] · opts.onChange(total)
     ===================================================================== */
  APP.editorColores = function (host, colores, opts = {}) {
    const st = (colores || []).map((c) => ({ id: c.id, color: c.color, hex: validHex(c.hex) ? c.hex : hexPorNombre(c.color), cantidad: Number(c.cantidad) || 0 }));
    const total = () => st.reduce((s, c) => s + (parseInt(c.cantidad, 10) || 0), 0);
    const aviso = () => { if (opts.onChange) opts.onChange(total()); const t = host.querySelector('[data-total]'); if (t) t.textContent = total(); };
    function pintar() {
      host.innerHTML = `
        <div class="stack-sm">
          <span class="small muted">Toca un color para agregarlo:</span>
          <div class="chips" style="flex-wrap:wrap;overflow:visible">${APP.PRESETS.map(([n, h]) => `<button type="button" class="chip col-chip" data-p="${esc(n)}" aria-pressed="${st.some((c) => c.color.toLowerCase() === n.toLowerCase())}"><span class="col-dot" style="background:${h}"></span>${esc(n)}</button>`).join('')}
            <button type="button" class="chip" data-otro>${icon('plus', 'sm')} Otro color</button></div>
          <div class="stack-sm" id="ceFilas">${st.map((c, i) => `
            <div class="col-row" data-i="${i}">
              <label class="col-pick" aria-label="Elegir el tono de ${esc(c.color || 'este color')}"><input type="color" value="${validHex(c.hex) ? c.hex : '#cccccc'}" data-hex><span class="col-dot" style="background:${validHex(c.hex) ? c.hex : '#cccccc'}"></span></label>
              <input class="input" data-nom value="${esc(c.color)}" maxlength="30" placeholder="Nombre del color" aria-label="Nombre del color">
              <div class="stepper" role="group" aria-label="Existencia"><button type="button" data-minus aria-label="Menos">${icon('minus')}</button><input type="number" inputmode="numeric" min="0" value="${esc(c.cantidad)}" data-cant aria-label="Piezas"><button type="button" data-plus aria-label="Más">${icon('plus')}</button></div>
              <button type="button" class="icon-btn" data-del aria-label="Quitar ${esc(c.color || 'color')}">${icon('x')}</button>
            </div>`).join('') || '<p class="small muted">Aún no hay colores. Toca uno de arriba.</p>'}</div>
          <div class="row between small"><span class="muted">Total de piezas</span><b class="num" data-total>${total()}</b></div>
        </div>`;
      host.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
        const n = b.dataset.p, ya = st.findIndex((c) => c.color.toLowerCase() === n.toLowerCase());
        if (ya >= 0) { const inp = host.querySelectorAll('.col-row')[ya].querySelector('[data-cant]'); inp.focus(); inp.select(); return; }
        st.push({ color: n, hex: hexPorNombre(n), cantidad: 0 }); pintar(); aviso();
        const filas = host.querySelectorAll('.col-row'); const inp = filas[filas.length - 1].querySelector('[data-cant]'); inp.focus(); inp.select();
      }));
      host.querySelector('[data-otro]').addEventListener('click', () => { st.push({ color: '', hex: '', cantidad: 0 }); pintar(); host.querySelectorAll('.col-row')[st.length - 1].querySelector('[data-nom]').focus(); });
      host.querySelectorAll('.col-row').forEach((row) => {
        const c = st[Number(row.dataset.i)], cant = row.querySelector('[data-cant]');
        row.querySelector('[data-nom]').addEventListener('input', (e) => { c.color = e.target.value; if (!validHex(c.hex) || hexPorNombre(c.color)) { const h = hexPorNombre(c.color); if (h) { c.hex = h; row.querySelector('.col-dot').style.background = h; row.querySelector('[data-hex]').value = h; } } });
        row.querySelector('[data-hex]').addEventListener('input', (e) => { c.hex = e.target.value; row.querySelector('.col-dot').style.background = c.hex; });
        const poner = (n) => { c.cantidad = Math.max(0, n || 0); cant.value = c.cantidad; aviso(); };
        cant.addEventListener('input', () => { c.cantidad = Math.max(0, parseInt(cant.value, 10) || 0); aviso(); });
        row.querySelector('[data-minus]').addEventListener('click', () => poner((parseInt(cant.value, 10) || 0) - 1));
        row.querySelector('[data-plus]').addEventListener('click', () => poner((parseInt(cant.value, 10) || 0) + 1));
        row.querySelector('[data-del]').addEventListener('click', () => { st.splice(Number(row.dataset.i), 1); pintar(); aviso(); });
      });
    }
    pintar();
    return {
      total,
      // devuelve los colores listos para guardar, o { error } si algo está mal
      get() {
        const limpios = st.map((c) => ({ id: c.id, color: c.color.trim(), hex: validHex(c.hex) ? c.hex : '', cantidad: parseInt(c.cantidad, 10) || 0 })).filter((c) => c.color);
        const vistos = new Set();
        for (const c of limpios) { const k = c.color.toLowerCase(); if (vistos.has(k)) return { error: `El color «${c.color}» está repetido.` }; vistos.add(k); }
        if (st.some((c) => !c.color.trim())) return { error: 'Hay un color sin nombre. Escríbelo o quítalo.' };
        return { colores: limpios };
      }
    };
  };

  /* =====================================================================
     PRODUCTO RÁPIDO: nombre, precio y existencia (o colores) y listo
     ===================================================================== */
  APP.productoRapido = function (opts = {}) {
    let ed = null;
    const m = openModal({
      title: 'Producto rápido', wide: true,
      body: `<div class="stack">
        <label class="field">Nombre *<input class="input" id="prNombre" value="${esc(opts.nombre || '')}" maxlength="120" placeholder="Ej.: Botella EcoTwist 750 ml" autofocus></label>
        <div class="grid-2"><label class="field">Precio de venta *<input class="input" id="prPrecio" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></label>
          <label class="field">Costo <span class="hint">opcional</span><input class="input" id="prCosto" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></label></div>
        <label class="row"><input type="checkbox" id="prCol" style="width:22px;height:22px;accent-color:var(--pink-600)"> <span><b>Viene en varios colores</b></span></label>
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
      if (usa) { const r = ed.get(); if (r.error) return toast(r.error, { error: true }); colores = r.colores; if (!colores.length) return toast('Agrega al menos un color.', { error: true }); }
      const btn = m.foot.querySelector('[data-ok]'); btn.disabled = true;
      try {
        const id = await API.saveProducto({ nombre, precio, costo: g('#prCosto').value || 0, cantidad: usa ? 0 : g('#prCant').value, stock_minimo: 2, activo: true, fotos: [], usa_colores: usa, colores, avisar_stock: false, campana: U.lsGet('vedith-campana', '') });
        await APP.refreshCore(); m.close(); toast(`«${nombre}» creado`);
        if (opts.onCreated) opts.onCreated(id); else APP.render();
      } catch (e) { btn.disabled = false; APP.handleErr(e); }
    });
  };

  /* =====================================================================
     INGRESO RÁPIDO (página)
     ===================================================================== */
  const lote = []; // [{ pid, qty: { '<color>' | '': n }, extra: [{color, hex}] }]
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
        <div class="page-head"><div><h1>Ingreso rápido</h1><p class="sub">Suma piezas a varios productos y colores de una sola vez.</p></div>
          <button type="button" class="btn secondary" id="irNuevo">${icon('plus')} Producto rápido</button></div>
        ${faltaSql ? `<div class="banner">${icon('alert')}<span class="small">Para usar colores falta correr <b>migracion_colores.sql</b> en Supabase. Mientras tanto el ingreso funciona sin colores.</span></div>` : ''}
        <div class="row" style="margin:12px 0">
          <div class="searchbox grow">${icon('search')}<input class="input" id="irQ" type="search" placeholder="Busca un producto para sumarle piezas…" autocomplete="off"></div>
          <button type="button" class="icon-btn" id="irScan" aria-label="Escanear QR" style="border:1.5px solid var(--line-strong);border-radius:14px;width:52px;height:52px">${icon('scan')}</button>
        </div>
        <div id="irRes" class="pick-list" hidden></div>
        <div class="stack" id="irLote">${lote.length ? lote.map(tarjeta).join('') : `<div class="card empty">${icon('package', 'lg')}<p>Busca o escanea un producto. Le pones cuántas piezas llegaron (por color si tiene) y al final lo guardas todo junto.</p></div>`}</div>
        <div class="lote-bar"><span class="small muted" aria-live="polite"><b class="num" id="irTot">${totalLote()}</b> piezas por sumar</span><button type="button" class="btn green" id="irGuardar" ${totalLote() ? '' : 'disabled'}>${icon('check')} Sumar al inventario</button></div>`;
      enlazar();
    }
    function tarjeta(e) {
      const p = APP.prod(e.pid); if (!p) return '';
      const foto = p.fotos && p.fotos[0];
      const filas = p.usa_colores
        ? [...p.colores.map((c) => ({ color: c.color, hex: c.hex, actual: c.cantidad })), ...e.extra.filter((x) => !p.colores.some((c) => c.color === x.color)).map((x) => ({ color: x.color, hex: x.hex, actual: 0, nuevo: true }))]
        : [{ color: '', actual: p.cantidad }];
      return `<section class="card lote-card" data-pid="${esc(p.id)}">
        <div class="row"><span class="thumb" style="width:48px;height:48px;border-radius:12px;overflow:hidden;background:var(--surface-2);display:grid;place-items:center;flex:none">${foto ? U.imgTag(foto, '') : icon('image')}</span>
          <div class="grow" style="min-width:0"><div class="t1 ellipsis" style="font-weight:800">${esc(p.nombre)}</div><div class="xs muted">${esc(p.codigo)} · hoy hay ${p.cantidad}</div></div>
          <button type="button" class="icon-btn" data-quitar aria-label="Quitar del ingreso">${icon('x')}</button></div>
        <div class="stack-sm">${filas.map((f) => {
          const n = e.qty[f.color] || 0;
          return `<div class="lote-fila" data-c="${esc(f.color)}">${p.usa_colores ? `${APP.dot(f.color, f.hex)}<span class="grow t1">${esc(f.color)}${f.nuevo ? ' <span class="pill pink">nuevo</span>' : ''}<span class="xs muted"> · hay ${f.actual}</span></span>` : '<span class="grow t1">Piezas que llegaron</span>'}
            <div class="stepper" role="group" aria-label="Piezas"><button type="button" data-minus aria-label="Menos">${icon('minus')}</button><input type="number" inputmode="numeric" min="0" value="${n || ''}" placeholder="0" data-cant aria-label="Piezas"><button type="button" data-plus aria-label="Más">${icon('plus')}</button></div>
            <button type="button" class="chip" data-mas5 aria-label="Sumar 5">+5</button></div>`;
        }).join('')}
          ${p.usa_colores ? `<button type="button" class="btn ghost sm" data-nuevocolor style="justify-self:start">${icon('plus', 'sm')} Color nuevo</button>` : ''}</div></section>`;
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
        if (nc) nc.addEventListener('click', () => colorNuevo(p, e));
      });
      main.querySelector('#irGuardar').addEventListener('click', guardar);
    }
    function colorNuevo(p, e) {
      const m = openModal({ title: 'Color nuevo', body: `<p class="muted small">${esc(p.nombre)}</p>
        <div class="chips" style="flex-wrap:wrap;overflow:visible">${APP.PRESETS.filter(([n]) => !p.colores.some((c) => c.color.toLowerCase() === n.toLowerCase()) && !e.extra.some((x) => x.color.toLowerCase() === n.toLowerCase())).map(([n, h]) => `<button type="button" class="chip" data-p="${esc(n)}" data-h="${h}"><span class="col-dot" style="background:${h}"></span>${esc(n)}</button>`).join('')}</div>
        <label class="field">O escribe otro nombre<input class="input" id="cnNom" maxlength="30" placeholder="Ej.: Lila"></label>`,
        footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok>Agregar</button>' });
      const poner = (color, hex) => { if (!color) return; e.extra.push({ color, hex: hex || hexPorNombre(color) }); e.qty[color] = e.qty[color] || 0; m.close(); pintar(); };
      m.body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => poner(b.dataset.p, b.dataset.h)));
      m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
      m.foot.querySelector('[data-ok]').addEventListener('click', () => { const n = m.body.querySelector('#cnNom').value.trim(); if (!n) return toast('Escribe el nombre del color.', { error: true }); poner(n); });
    }
    async function guardar() {
      const items = [];
      lote.forEach((e) => { const p = APP.prod(e.pid); if (!p) return; Object.entries(e.qty).forEach(([color, n]) => { if (n > 0) { const ex = e.extra.find((x) => x.color === color); items.push({ producto_id: e.pid, color: p.usa_colores ? color : null, hex: ex ? ex.hex : null, cantidad: n }); } }); });
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
