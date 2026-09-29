/* Pantallas 3: Cajas (pedidos a Tupperware) y Dinero (a dónde fue cada quetzal). Solo administrador. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal, confirmDialog, fmtDate } = U;
  const APP = window.APP;
  const P = APP.pages;
  const sum = (a, f) => a.reduce((s, x) => s + Number(f(x)), 0);
  const METODOS = APP.METODOS;

  const cajaPills = (c) =>
    `<span class="pill ${c.estado === 'recibida' ? 'ok' : 'warn'}">${c.estado === 'recibida' ? 'Recibida' : 'Por recibir'}</span>` +
    `<span class="pill ${c.pagada ? 'ok' : 'bad'}">${c.pagada ? 'Pagada' : 'Sin pagar'}</span>`;

  /* ---------- selector "cómo se pagó / a qué cuenta" reutilizable ---------- */
  // Devuelve { html, leer() }. Se monta con mount(root).
  APP.pickerCuenta = function (opts = {}) {
    const st = { metodo: opts.metodo || 'efectivo', cuenta: opts.cuenta || '' };
    const bancos = () => APP.cuentas.filter((c) => c.tipo === 'banco' && c.activa !== false);
    const html = () => `
      <div class="stack-sm" data-picker>
        <span class="small" style="font-weight:800">${esc(opts.label || '¿Cómo se pagó?')}</span>
        <div class="seg" role="group">${Object.entries(METODOS).map(([k, l]) => `<button type="button" data-mc="${k}" aria-pressed="${st.metodo === k}">${l}</button>`).join('')}</div>
        ${st.metodo === 'efectivo'
          ? `<p class="small muted">${esc(opts.efectivoTxt || 'Sale o entra del efectivo en mano.')}</p>`
          : bancos().length
            ? `<label class="field">Cuenta *<select class="input" data-cuenta><option value="">Elige la cuenta…</option>${bancos().map((c) => `<option value="${esc(c.id)}" ${c.id === st.cuenta ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>`
            : `<div class="banner">${icon('alert')}<span class="small">Aún no hay cuentas de banco. Agrégalas en <a href="#/dinero">Dinero</a>.</span></div>`}
      </div>`;
    return {
      mount(root) {
        const paint = () => {
          const box = root.querySelector('[data-picker-host]');
          box.innerHTML = html();
          box.querySelectorAll('[data-mc]').forEach((b) => b.addEventListener('click', () => { st.metodo = b.dataset.mc; st.cuenta = ''; paint(); }));
          const sel = box.querySelector('[data-cuenta]'); if (sel) sel.addEventListener('change', () => { st.cuenta = sel.value; });
        };
        paint();
      },
      host: '<div data-picker-host></div>',
      leer() {
        if (st.metodo !== 'efectivo' && !st.cuenta) return null;
        return { metodo: st.metodo, cuenta_id: st.metodo === 'efectivo' ? efectivoId() : st.cuenta };
      }
    };
  };
  const efectivoId = () => (APP.cuentas.find((c) => c.tipo === 'efectivo' && c.activa !== false) || {}).id || null;

  /* =====================================================================
     CAJAS
     ===================================================================== */
  P.cajas = async function (main) {
    const cajas = await API.cajas();
    const porPagar = cajas.filter((c) => !c.pagada);
    const porRecibir = cajas.filter((c) => c.estado === 'pedida');
    main.innerHTML = `
      <div class="page-head"><div><h1>Cajas</h1><p class="sub">Pedidos a Tupperware: qué llegó y si ya se pagó.</p></div><button type="button" class="btn" id="cNueva">${icon('plus')} Caja</button></div>
      <div class="kpis" style="margin-bottom:16px">
        <div class="kpi ${porPagar.length ? 'orange' : 'green'}"><span class="k-l">Por pagar a Tupperware</span><span class="k-v num">${money(sum(porPagar, (c) => c.monto_total))}</span><span class="small muted">${porPagar.length} ${porPagar.length === 1 ? 'caja' : 'cajas'}</span></div>
        <div class="kpi"><span class="k-l">Por recibir</span><span class="k-v num">${porRecibir.length}</span><span class="small muted">${sum(porRecibir, (c) => sum(c.items, (i) => i.cantidad))} piezas</span></div>
      </div>
      <div class="list">${cajas.length ? cajas.map((c) => `
        <button type="button" class="item" data-id="${esc(c.id)}">
          <span class="thumb" style="background:var(--pink-100);color:var(--pink-700)">${icon('box')}</span>
          <span class="grow"><div class="t1">${esc(c.nombre)}</div>
            <div class="t2">${c.numero_pedido ? 'Pedido ' + esc(c.numero_pedido) + ' · ' : ''}${fmtDate(c.fecha_pedido)} · ${sum(c.items, (i) => i.cantidad)} piezas</div>
            <div class="row wrap" style="gap:6px;margin-top:4px">${cajaPills(c)}</div></span>
          <span class="amt num">${money(c.monto_total)}</span></button>`).join('')
        : `<div class="card empty">${icon('box', 'lg')}<p>Aún no registras cajas. Cuando hagas un pedido a Tupperware, anótalo aquí con sus productos.</p><button type="button" class="btn" id="cVacia">Registrar la primera caja</button></div>`}</div>`;
    main.querySelector('#cNueva').addEventListener('click', () => openCajaForm());
    const v = main.querySelector('#cVacia'); if (v) v.addEventListener('click', () => openCajaForm());
    main.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => openCaja(cajas.find((c) => c.id === b.dataset.id))));
  };

  function openCaja(c) {
    const cuenta = c.cuenta_id ? APP.cuentaNombre(c.cuenta_id) : '';
    const m = openModal({
      title: c.nombre, wide: true,
      body: `
        <div class="row wrap">${cajaPills(c)}</div>
        <dl class="kv card flat">
          <dt>Pedido de Tupperware</dt><dd>${c.numero_pedido ? esc(c.numero_pedido) : '<span class="faint">sin anotar</span>'}</dd>
          <dt>Fecha del pedido</dt><dd>${fmtDate(c.fecha_pedido)}</dd>
          <dt>Llegó</dt><dd>${c.fecha_llegada ? fmtDate(c.fecha_llegada) : '<span class="faint">todavía no</span>'}</dd>
          <dt>Total a pagar</dt><dd class="num">${money(c.monto_total)}</dd>
          <dt>Pago</dt><dd>${c.pagada ? `Pagada el ${fmtDate(c.pagada_el)} · ${esc(METODOS[c.metodo_pago] || '')}${cuenta && c.metodo_pago !== 'efectivo' ? ' · ' + esc(cuenta) : ''}` : '<span class="pill bad">Sin pagar</span>'}</dd>
          ${c.nota_pago ? `<dt>Nota del pago</dt><dd>${esc(c.nota_pago)}</dd>` : ''}
        </dl>
        <div class="scroll-x"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Costo c/u</th><th class="r">Subtotal</th></tr></thead><tbody>
          ${c.items.map((i) => `<tr><td>${esc(i.producto_nombre)}</td><td class="r num">${i.cantidad}</td><td class="r num">${money(i.costo_unitario)}</td><td class="r num">${money(i.cantidad * i.costo_unitario)}</td></tr>`).join('')}
        </tbody></table></div>
        ${c.notas ? `<p class="small muted">${esc(c.notas)}</p>` : ''}
        <div class="stack-sm">
          ${c.estado === 'pedida' ? `<button type="button" class="btn green block" data-a="recibir">${icon('package')} Recibir caja (sumar ${sum(c.items, (i) => i.cantidad)} piezas al inventario)</button>`
            : `<div class="banner info">${icon('check')}<span class="small">Recibida: las piezas ya están en el inventario.</span><button type="button" class="btn ghost sm" data-a="revertir" style="margin-left:auto">Deshacer</button></div>`}
          ${c.pagada ? '<button type="button" class="btn secondary block" data-a="despagar">Marcar como sin pagar</button>'
            : `<button type="button" class="btn block" data-a="pagar">${icon('wallet')} Registrar pago de la caja</button>`}
        </div>`,
      footer: `<button type="button" class="btn secondary" style="flex:0 0 auto" data-a="borrar" aria-label="Eliminar caja">${icon('trash')}</button><button type="button" class="btn secondary" data-a="editar">${icon('edit')} Editar</button>`
    });
    const on = (a, fn) => m.el.querySelectorAll(`[data-a="${a}"]`).forEach((b) => b.addEventListener('click', fn));
    const hecho = (msg) => { m.close(); toast(msg); APP.render(); };
    on('editar', () => { m.close(); openCajaForm(c); });
    on('pagar', () => { m.close(); openPago(c); });
    on('despagar', async () => { try { await API.desmarcarPago(c.id); hecho('Caja marcada como sin pagar'); } catch (e) { APP.handleErr(e); } });
    on('recibir', async () => {
      if (!await confirmDialog({ title: 'Recibir caja', message: `Se sumarán ${sum(c.items, (i) => i.cantidad)} piezas al inventario. Solo se puede hacer una vez.`, okLabel: 'Recibir caja' })) return;
      try { await API.recibirCaja(c.id); await APP.refreshCore(); hecho('Caja recibida: inventario actualizado'); } catch (e) { APP.handleErr(e); }
    });
    on('revertir', async () => {
      if (!await confirmDialog({ title: 'Deshacer recepción', message: 'Se restarán del inventario las piezas de esta caja. Úsalo solo si la marcaste como recibida por error.', okLabel: 'Deshacer', danger: true })) return;
      try { await API.revertirRecepcion(c.id); await APP.refreshCore(); hecho('Recepción deshecha'); } catch (e) { APP.handleErr(e); }
    });
    on('borrar', async () => {
      if (!await confirmDialog({ title: 'Eliminar caja', message: c.estado === 'recibida' ? 'Esta caja ya se recibió. Eliminarla NO quita las piezas del inventario. ¿Eliminar de todos modos?' : '¿Eliminar esta caja?', okLabel: 'Eliminar', danger: true })) return;
      try { await API.deleteCaja(c.id); hecho('Caja eliminada'); } catch (e) { APP.handleErr(e); }
    });
  }

  function openPago(c) {
    const pick = APP.pickerCuenta({ label: '¿Cómo se pagó la caja?', efectivoTxt: 'Se pagó con efectivo en mano; baja el efectivo.' });
    const m = openModal({
      title: 'Pago de ' + c.nombre,
      body: `<p class="muted">Total: <b>${money(c.monto_total)}</b></p>
        <label class="field">Fecha del pago<input class="input" id="pgFecha" type="date" value="${APP.hoyStr()}"></label>
        ${pick.host}
        <label class="field">Nota <span class="hint">opcional · ej.: número de boleta</span><input class="input" id="pgNota" maxlength="80"></label>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn green" data-ok>Marcar como pagada</button>'
    });
    pick.mount(m.body);
    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const r = pick.leer(); if (!r) return toast('Elige la cuenta desde donde se pagó.', { error: true });
      try {
        await API.pagarCaja(c.id, { fecha: m.body.querySelector('#pgFecha').value || APP.hoyStr(), metodo: r.metodo, cuenta_id: r.cuenta_id, nota: m.body.querySelector('#pgNota').value.trim() });
        m.close(); toast('Caja marcada como pagada'); APP.render();
      } catch (e) { APP.handleErr(e); }
    });
  }

  /* ---------- formulario de caja: se registran los productos "por caja" ---------- */
  function openCajaForm(c) {
    const nueva = !c;
    const bloqueada = !nueva && c.estado === 'recibida'; // recibida: los productos ya no se cambian
    c = c || { nombre: '', numero_pedido: '', fecha_pedido: APP.hoyStr(), notas: '', monto_total: 0, items: [] };
    let items = c.items.map((i) => ({ ...i }));
    let montoManual = !nueva && Math.abs(Number(c.monto_total) - sum(items, (i) => i.cantidad * i.costo_unitario)) > 0.005;
    const m = openModal({
      title: nueva ? 'Caja nueva' : 'Editar caja', wide: true,
      body: `<div class="stack">
        <label class="field">Nombre de la caja *<input class="input" id="cjNombre" value="${esc(c.nombre)}" maxlength="80" placeholder="Ej.: Caja 14 · Campaña 9" autofocus></label>
        <div class="grid-2">
          <label class="field">Número de pedido de Tupperware<input class="input" id="cjPed" value="${esc(c.numero_pedido || '')}" maxlength="40"></label>
          <label class="field">Fecha del pedido<input class="input" id="cjFecha" type="date" value="${esc(c.fecha_pedido)}"></label>
        </div>
        <section class="stack-sm"><h3>Productos de la caja</h3>
          ${bloqueada ? `<div class="banner info">${icon('check')}<span class="small">Esta caja ya se recibió; los productos no se pueden cambiar. Si te equivocaste, usa “Deshacer recepción”.</span></div>` : `
          <div class="row"><div class="searchbox grow">${icon('search')}<input class="input" id="cjBuscar" type="search" placeholder="Buscar producto para agregar…" autocomplete="off"></div>
            <button type="button" class="btn secondary" id="cjNuevoProd">${icon('plus')} Producto nuevo</button></div>
          <div id="cjRes" class="pick-list" hidden></div>`}
          <div id="cjItems" class="stack-sm"></div>
        </section>
        <div class="grid-2">
          <label class="field">Total a pagar a Tupperware <span class="hint">Se calcula solo; cámbialo si la factura trae envío o descuentos.</span><input class="input" id="cjMonto" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(c.monto_total)}"></label>
          <label class="field">Notas <span class="hint">opcional</span><input class="input" id="cjNotas" maxlength="200" value="${esc(c.notas || '')}"></label>
        </div>
      </div>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok>Guardar caja</button>'
    });
    const g = (s) => m.body.querySelector(s);
    const pintarItems = () => {
      const box = g('#cjItems');
      box.innerHTML = items.length ? items.map((i, n) => `
        <div class="cart-line" data-n="${n}">
          <div class="grow"><div class="t1">${esc(i.producto_nombre)}</div></div>
          ${bloqueada ? '' : `<button type="button" class="icon-btn" data-del aria-label="Quitar">${icon('x')}</button>`}
          <div class="stepper"><button type="button" data-minus ${bloqueada ? 'disabled' : ''} aria-label="Menos">${icon('minus')}</button><input type="number" inputmode="numeric" min="1" value="${i.cantidad}" ${bloqueada ? 'disabled' : ''} aria-label="Cantidad"><button type="button" data-plus ${bloqueada ? 'disabled' : ''} aria-label="Más">${icon('plus')}</button></div>
          <label class="field" style="justify-self:end;max-width:140px"><span class="xs muted">Costo c/u</span><input class="input" data-costo type="number" inputmode="decimal" min="0" step="0.01" value="${esc(i.costo_unitario)}" ${bloqueada ? 'disabled' : ''} style="min-height:42px;text-align:right"></label>
        </div>`).join('') : '<div class="card empty flat">Agrega los productos que trae la caja.</div>';
      box.querySelectorAll('.cart-line').forEach((row) => {
        const i = items[Number(row.dataset.n)];
        const set = (q) => { i.cantidad = Math.max(1, q || 1); pintarItems(); recalc(); };
        const d = row.querySelector('[data-del]'); if (d) d.addEventListener('click', () => { items.splice(Number(row.dataset.n), 1); pintarItems(); recalc(); });
        row.querySelector('[data-minus]').addEventListener('click', () => set(i.cantidad - 1));
        row.querySelector('[data-plus]').addEventListener('click', () => set(i.cantidad + 1));
        row.querySelector('.stepper input').addEventListener('change', (e) => set(parseInt(e.target.value, 10)));
        row.querySelector('[data-costo]').addEventListener('change', (e) => { i.costo_unitario = Math.max(0, parseFloat(e.target.value) || 0); recalc(); });
      });
    };
    const recalc = () => { if (!montoManual) g('#cjMonto').value = sum(items, (i) => i.cantidad * i.costo_unitario).toFixed(2); };
    g('#cjMonto').addEventListener('input', () => { montoManual = true; });
    const agregar = (p) => {
      const ya = items.find((i) => i.producto_id === p.id);
      if (ya) ya.cantidad += 1; else items.push({ producto_id: p.id, producto_nombre: p.nombre, cantidad: 1, costo_unitario: Number(p.costo) || 0 });
      pintarItems(); recalc();
    };
    if (!bloqueada) {
      const q = g('#cjBuscar'), res = g('#cjRes');
      q.addEventListener('input', () => {
        const txt = q.value.trim(); if (!txt) { res.hidden = true; return; }
        const list = APP.productos.filter((p) => APP.matchProducto(p, txt)).slice(0, 8);
        res.hidden = false;
        res.innerHTML = list.length ? list.map((p) => APP.productoItem(p)).join('') : `<div class="empty">No existe todavía. Toca “Producto nuevo”.</div>`;
        res.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => { agregar(APP.prod(b.dataset.id)); q.value = ''; res.hidden = true; q.focus(); }));
      });
      g('#cjNuevoProd').addEventListener('click', () => {
        APP.openProductoForm(null, {
          prefill: { nombre: q.value.trim(), cantidad: 0 },
          onSaved: (id) => { const p = APP.prod(id); if (p) { agregar(p); toast(`“${p.nombre}” creado y agregado a la caja`); } }
        });
      });
    }
    pintarItems();
    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const nombre = g('#cjNombre').value.trim();
      if (!nombre) { g('#cjNombre').classList.add('bad'); g('#cjNombre').focus(); return toast('Ponle un nombre a la caja.', { error: true }); }
      if (!items.length) return toast('Agrega al menos un producto a la caja.', { error: true });
      try {
        await API.saveCaja({ id: c.id, nombre, numero_pedido: g('#cjPed').value, fecha_pedido: g('#cjFecha').value || APP.hoyStr(), fecha_llegada: c.fecha_llegada,
          monto_total: g('#cjMonto').value, notas: g('#cjNotas').value, items: bloqueada ? null : items });
        m.close(); toast('Caja guardada'); APP.render();
      } catch (e) { APP.handleErr(e); }
    });
  }

  /* =====================================================================
     DINERO: a qué cuenta fue cada venta, y los depósitos de efectivo al banco.
     No es control bancario: solo deja constancia de dónde quedó el dinero.
     ===================================================================== */
  P.dinero = async function (main) {
    const [ventas, abonos, cajas, movs] = await Promise.all([API.ventas(), API.abonos(), API.cajas(), API.movimientos()]);
    const vivas = new Set(ventas.filter((v) => !v.anulada).map((v) => v.id));
    const cuentas = APP.cuentas;
    const bal = {};
    cuentas.forEach((c) => { bal[c.id] = { entro: 0, salio: 0, recibido: 0, enviado: 0 }; });
    const add = (id, campo, monto) => { if (bal[id]) bal[id][campo] += Number(monto); };
    ventas.filter((v) => !v.anulada && v.forma_pago === 'contado').forEach((v) => add(v.cuenta_id, 'entro', v.total));
    abonos.filter((a) => vivas.has(a.venta_id)).forEach((a) => add(a.cuenta_id, 'entro', a.monto));
    cajas.filter((c) => c.pagada).forEach((c) => add(c.cuenta_id, 'salio', c.monto_total));
    movs.forEach((mv) => { add(mv.origen_id, 'enviado', mv.monto); add(mv.destino_id, 'recibido', mv.monto); });
    const total = (id) => bal[id].entro + bal[id].recibido - bal[id].salio - bal[id].enviado;
    const efectivo = cuentas.filter((c) => c.tipo === 'efectivo' && c.activa !== false);
    const enMano = sum(efectivo, (c) => total(c.id));
    const bancos = cuentas.filter((c) => c.tipo === 'banco');

    main.innerHTML = `
      <div class="page-head"><div><h1>Dinero y depósitos</h1><p class="sub">A qué cuenta fue cada venta y cuánto efectivo sigue sin depositar.</p></div></div>
      <div class="banner info" style="margin-bottom:14px">${icon('info')}<span class="small">Esto <b>no es control bancario</b>. Solo deja constancia de si el dinero se quedó en efectivo, se depositó o llegó por transferencia. No incluye los gastos.</span></div>
      <div class="kpis" style="margin-bottom:16px">
        <div class="kpi ${enMano > 0 ? 'orange' : 'green'}"><span class="k-l">Efectivo en mano (sin depositar)</span><span class="k-v num">${money(enMano)}</span></div>
        <div class="kpi green"><span class="k-l">En bancos</span><span class="k-v num">${money(sum(bancos, (c) => total(c.id)))}</span></div>
      </div>
      <div class="row wrap" style="margin-bottom:16px"><button type="button" class="btn" id="dDep" ${bancos.some((b) => b.activa !== false) ? '' : 'disabled'}>${icon('download')} Depositar efectivo al banco</button>
        ${bancos.length ? '' : '<span class="small muted">Primero agrega una cuenta de banco (abajo).</span>'}</div>
      <section class="stack-sm"><h2>Cuentas</h2><div class="list">
        ${cuentas.map((c) => `<div class="card flat stack-sm" ${c.activa === false ? 'style="opacity:.6"' : ''}>
          <div class="row between"><h3>${esc(c.nombre)} <span class="pill">${c.tipo === 'efectivo' ? 'efectivo' : 'banco'}</span></h3><b class="num" style="font-family:var(--font-display);font-size:1.3rem">${money(total(c.id))}</b></div>
          <dl class="kv"><dt>Entró por ventas y abonos</dt><dd class="num">${money(bal[c.id].entro)}</dd>
          <dt>Salió pagando cajas</dt><dd class="num">− ${money(bal[c.id].salio)}</dd>
          <dt>Depósitos recibidos</dt><dd class="num">${money(bal[c.id].recibido)}</dd>
          <dt>Depósitos enviados</dt><dd class="num">− ${money(bal[c.id].enviado)}</dd></dl>
          ${c.tipo === 'banco' ? `<button type="button" class="btn ghost sm" data-toggle="${esc(c.id)}" style="justify-self:start">${c.activa === false ? 'Volver a activar' : 'Ocultar cuenta'}</button>` : ''}</div>`).join('')}
      </div>
      <div class="row"><input class="input grow" id="dCuentaNueva" placeholder="Nueva cuenta de banco (ej.: BAM ahorro)" maxlength="40"><button type="button" class="btn secondary" id="dCuentaAdd">Agregar</button></div></section>
      <section class="stack-sm mt-lg" style="margin-top:24px"><h2>Depósitos de efectivo al banco</h2>
        <div class="list">${movs.length ? movs.map((mv) => `<div class="item"><span class="grow"><div class="t1">${esc(APP.cuentaNombre(mv.origen_id) || '—')} → ${esc(APP.cuentaNombre(mv.destino_id) || '—')}</div><div class="t2">${fmtDate(mv.fecha)}${mv.nota ? ' · ' + esc(mv.nota) : ''}</div></span><span class="amt num">${money(mv.monto)}</span><button type="button" class="icon-btn" data-delmov="${esc(mv.id)}" aria-label="Eliminar depósito">${icon('trash')}</button></div>`).join('') : '<div class="card empty flat">Aún no registras depósitos.</div>'}</div></section>`;

    main.querySelector('#dCuentaAdd').addEventListener('click', async () => {
      const n = main.querySelector('#dCuentaNueva').value.trim(); if (!n) return;
      try { await API.addCuenta(n); await APP.refreshCore(); toast('Cuenta agregada'); APP.render(); } catch (e) { APP.handleErr(e); }
    });
    main.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      const c = cuentas.find((x) => x.id === b.dataset.toggle);
      try { await API.setCuentaActiva(c.id, c.activa === false); await APP.refreshCore(); APP.render(); } catch (e) { APP.handleErr(e); }
    }));
    main.querySelectorAll('[data-delmov]').forEach((b) => b.addEventListener('click', async () => {
      if (!await confirmDialog({ title: 'Eliminar depósito', message: '¿Eliminar este depósito? El dinero vuelve a contarse como efectivo en mano.', okLabel: 'Eliminar', danger: true })) return;
      try { await API.deleteMovimiento(b.dataset.delmov); APP.render(); } catch (e) { APP.handleErr(e); }
    }));
    main.querySelector('#dDep').addEventListener('click', () => {
      const orig = efectivo[0], dests = bancos.filter((b) => b.activa !== false);
      const m = openModal({
        title: 'Depositar efectivo al banco',
        body: `<p class="muted">Efectivo en mano: <b>${money(enMano)}</b></p>
          <label class="field">Monto que depositaste *<input class="input" id="dpMonto" type="number" inputmode="decimal" min="0.01" step="0.01" value="${enMano > 0 ? enMano.toFixed(2) : ''}" autofocus></label>
          <label class="field">¿A qué cuenta?<select class="input" id="dpDest">${dests.map((b) => `<option value="${esc(b.id)}">${esc(b.nombre)}</option>`).join('')}</select></label>
          <label class="field">Fecha<input class="input" id="dpFecha" type="date" value="${APP.hoyStr()}"></label>
          <label class="field">Nota <span class="hint">opcional · ej.: boleta 88123</span><input class="input" id="dpNota" maxlength="80"></label>`,
        footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn green" data-ok>Registrar depósito</button>'
      });
      m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
      m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
        const monto = parseFloat(m.body.querySelector('#dpMonto').value);
        if (!(monto > 0)) return toast('Escribe el monto depositado.', { error: true });
        try { await API.addMovimiento({ fecha: m.body.querySelector('#dpFecha').value || APP.hoyStr(), origen_id: orig.id, destino_id: m.body.querySelector('#dpDest').value, monto, nota: m.body.querySelector('#dpNota').value.trim() }); m.close(); toast('Depósito registrado'); APP.render(); } catch (e) { APP.handleErr(e); }
      });
    });
  };
})();
