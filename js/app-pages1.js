/* Pantallas 1/2: Inicio, Productos, Vender, Mis ventas. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal, confirmDialog, fmtTime, fmtDate, ymd } = U;
  const APP = window.APP;
  const P = APP.pages;
  const isAdmin = APP.isAdmin;

  /* ---------- utilidades de ventas compartidas con la pantalla 2 ---------- */
  APP.abonosDe = (abonos) => {
    const m = {};
    abonos.forEach((a) => { m[a.venta_id] = (m[a.venta_id] || 0) + Number(a.monto); });
    return m;
  };
  APP.saldo = (v, mapa) => Math.max(0, Number(v.total) - (mapa[v.id] || 0));
  APP.hoyStr = () => ymd(new Date());
  APP.diaDe = (iso) => ymd(new Date(iso));
  APP.wa = (tel, texto) => {
    let d = String(tel || '').replace(/\D/g, '');
    if (d.length === 8) d = '502' + d;
    return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
  };
  APP.venceHoy = (v) => v.fecha_limite && v.fecha_limite < APP.hoyStr();

  /* =====================================================================
     INICIO (administrador)
     ===================================================================== */
  P.inicio = async function (main) {
    const [ventas, abonos, cajas] = await Promise.all([API.ventas(), API.abonos(), API.cajas()]);
    const cajasSinPagar = cajas.filter((c) => !c.pagada);
    const vivas = ventas.filter((v) => !v.anulada);
    const hoy = APP.hoyStr(), mesIni = hoy.slice(0, 8) + '01';
    const deHoy = vivas.filter((v) => APP.diaDe(v.created_at) === hoy);
    const delMes = vivas.filter((v) => APP.diaDe(v.created_at) >= mesIni);
    const sum = (a) => a.reduce((s, v) => s + Number(v.total), 0);
    const ab = APP.abonosDe(abonos);
    const deudas = vivas.filter((v) => v.forma_pago === 'fiado' && APP.saldo(v, ab) > 0);
    const porCobrar = deudas.reduce((s, v) => s + APP.saldo(v, ab), 0);
    const vencidas = deudas.filter(APP.venceHoy).length;
    const activos = APP.productos.filter((p) => p.activo);
    const bajos = activos.filter((p) => APP.stockEstado(p) !== 'ok');
    const sinEtiq = activos.filter((p) => !p.etiqueta_impresa_at);
    const pend = APP.pendientes ? APP.pendientes() : [];
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

    main.innerHTML = `
      <div class="page-head"><div><h1>${saludo}</h1><p class="sub">Así va Vedith Variedades hoy.</p></div></div>
      <div class="stack">
        ${sinEtiq.length ? `<a class="banner" href="#/etiquetas" style="text-decoration:none;color:inherit">${icon('qr')}<span class="grow"><b>${sinEtiq.length} ${sinEtiq.length === 1 ? 'producto sin' : 'productos sin'} etiqueta QR impresa.</b> <span class="small muted">Toca para imprimirlas.</span></span>${icon('chevron', 'sm')}</a>` : ''}
        ${pend.length ? `<a class="banner" href="#/pendientes" style="text-decoration:none;color:inherit">${icon('alert')}<span class="grow"><b>${pend.length} ${pend.length === 1 ? 'producto pendiente' : 'productos pendientes'} de completar.</b> <span class="small muted">Les falta precio o foto.</span></span>${icon('chevron', 'sm')}</a>` : ''}
        ${cajasSinPagar.length ? `<a class="banner" href="#/cajas" style="text-decoration:none;color:inherit">${icon('box')}<span class="grow"><b>${cajasSinPagar.length} ${cajasSinPagar.length === 1 ? 'caja sin pagar' : 'cajas sin pagar'}</b> <span class="small muted">· ${money(cajasSinPagar.reduce((s, c) => s + c.monto_total, 0))} por pagar a Tupperware.</span></span>${icon('chevron', 'sm')}</a>` : ''}
        ${vencidas ? `<a class="banner bad" href="#/cobrar" style="text-decoration:none;color:inherit">${icon('alert')}<span class="grow"><b>${vencidas} ${vencidas === 1 ? 'deuda vencida' : 'deudas vencidas'}.</b> <span class="small muted">Toca para ver quién debe.</span></span>${icon('chevron', 'sm')}</a>` : ''}
        <div class="kpis">
          <div class="kpi pink"><span class="k-l">Vendido hoy</span><span class="k-v num">${money(sum(deHoy))}</span><span class="small muted">${deHoy.length} ${deHoy.length === 1 ? 'venta' : 'ventas'}</span></div>
          <div class="kpi green"><span class="k-l">Vendido este mes</span><span class="k-v num">${money(sum(delMes))}</span><span class="small muted">${delMes.length} ${delMes.length === 1 ? 'venta' : 'ventas'}</span></div>
          <a class="kpi orange" href="#/cobrar" style="text-decoration:none;color:inherit"><span class="k-l">Por cobrar</span><span class="k-v num">${money(porCobrar)}</span><span class="small muted">${deudas.length} ${deudas.length === 1 ? 'deuda' : 'deudas'}</span></a>
          <a class="kpi" href="#/productos?f=stock" style="text-decoration:none;color:inherit"><span class="k-l">Poco o sin stock</span><span class="k-v num">${bajos.length}</span><span class="small muted">de ${activos.length} productos</span></a>
        </div>
        <div class="actions">
          <a class="action" href="#/vender"><span class="ic">${icon('bag', 'lg')}</span>Vender</a>
          <button type="button" class="action" id="acNuevo"><span class="ic">${icon('plus', 'lg')}</span>Producto nuevo</button>
          <a class="action" href="#/cajas"><span class="ic">${icon('box', 'lg')}</span>Cajas</a>
          <a class="action" href="#/etiquetas"><span class="ic">${icon('printer', 'lg')}</span>Imprimir etiquetas</a>
        </div>
        <section class="stack-sm">
          <div class="row between"><h2>Últimas ventas</h2><a class="btn ghost sm" href="#/ventas">Ver todas</a></div>
          ${vivas.length ? `<div class="list">${vivas.slice(0, 8).map(ventaItem).join('')}</div>` : '<div class="card empty">Todavía no hay ventas. Toca <b>Vender</b> para registrar la primera.</div>'}
        </section>
        ${bajos.length ? `<section class="stack-sm"><h2>Para reponer</h2><div class="list">${bajos.slice(0, 6).map((p) => APP.productoItem(p)).join('')}</div></section>` : ''}
      </div>`;
    main.querySelector('#acNuevo').addEventListener('click', () => APP.openProductoForm());
    main.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => APP.openFicha(APP.prod(b.dataset.id))));
  };

  function ventaItem(v) {
    return `<div class="item">
      <span class="grow"><div class="t1">${v.cantidad} × ${esc(v.producto_nombre)}</div>
      <div class="t2">${esc(v.vendido_por)} · ${fmtDate(v.created_at)} ${fmtTime(v.created_at)}${v.cliente_nombre ? ' · ' + esc(v.cliente_nombre) : ''}</div></span>
      <span style="text-align:right"><div class="amt num">${money(v.total)}</div>${v.forma_pago === 'fiado' ? '<span class="pill warn">Fiado</span>' : v.metodo_cobro ? `<span class="pill">${esc(APP.METODOS[v.metodo_cobro] || '')}${v.cuenta_id && v.metodo_cobro !== 'efectivo' ? ' · ' + esc(APP.cuentaNombre(v.cuenta_id)) : ''}</span>` : ''}${v.precio_lista != null && Number(v.precio_unitario) < Number(v.precio_lista) ? ' <span class="pill pink">Descuento</span>' : ''}${v.anulada ? '<span class="pill bad">Anulada</span>' : ''}</span>
    </div>`;
  }
  APP.ventaItem = ventaItem;

  /* =====================================================================
     PRODUCTOS / CATÁLOGO
     ===================================================================== */
  P.productos = async function (main, params) {
    const ad = isAdmin();
    if (params.has('f')) APP.filtros.f = params.get('f') || '';
    const F = APP.filtros;
    if (!ad) F.f = '';
    const cats = APP.categorias;
    main.innerHTML = `
      <div class="page-head"><div><h1>${ad ? 'Productos' : 'Catálogo'}</h1><p class="sub" id="pCount"></p></div>
        ${ad ? `<button type="button" class="btn" id="pNuevo">${icon('plus')} Producto</button>` : ''}</div>
      <div class="toolbar">
        <div class="searchbox">${icon('search')}<input class="input" id="pQ" type="search" placeholder="Buscar por nombre o código…" autocomplete="off" value="${esc(F.q)}"></div>
        <div class="chips" id="pCats" role="group" aria-label="Categorías">
          <button type="button" class="chip" data-cat="" aria-pressed="${!F.cat}">Todo</button>
          ${cats.map((c) => `<button type="button" class="chip" data-cat="${esc(c.id)}" aria-pressed="${F.cat === c.id}">${esc(c.nombre)}</button>`).join('')}
        </div>
        ${ad ? `<div class="chips" id="pFil" role="group" aria-label="Filtros">
          <button type="button" class="chip" data-f="stock" aria-pressed="${F.f === 'stock'}">${icon('alert', 'sm')} Poco stock</button>
          <button type="button" class="chip" data-f="etiq" aria-pressed="${F.f === 'etiq'}">${icon('qr', 'sm')} Sin etiqueta</button>
          <button type="button" class="chip" data-f="oculto" aria-pressed="${F.f === 'oculto'}">Ocultos</button>
        </div>` : ''}
      </div>
      <div id="pGrid" class="grid-productos"></div>`;

    const paint = () => {
      let list = APP.productos.filter((p) => APP.matchProducto(p, F.q));
      if (F.cat) list = list.filter((p) => p.categoria_id === F.cat);
      if (F.f === 'stock') list = list.filter((p) => p.activo && APP.stockEstado(p) !== 'ok');
      else if (F.f === 'etiq') list = list.filter((p) => p.activo && !p.etiqueta_impresa_at);
      else if (F.f === 'oculto') list = list.filter((p) => !p.activo);
      else if (ad) list = list.filter((p) => p.activo || F.q);
      const grid = main.querySelector('#pGrid');
      if (!grid) return;
      main.querySelector('#pCount').textContent = `${list.length} ${list.length === 1 ? 'producto' : 'productos'}`;
      grid.innerHTML = list.length ? list.map((p) => `
        <button type="button" class="prod-card" data-id="${esc(p.id)}">
          <div class="foto">${p.fotos && p.fotos[0] ? U.imgTag(p.fotos[0], p.nombre) : U.placeholder('Sin foto')}
            <div class="tags">${APP.stockEstado(p) === 'agotado' ? '<span class="pill bad">Agotado</span>' : APP.stockEstado(p) === 'poco' ? `<span class="pill warn">Quedan ${p.cantidad}</span>` : ''}${ad && !p.etiqueta_impresa_at ? '<span class="pill pink">Sin etiqueta</span>' : ''}${ad && !p.activo ? '<span class="pill">Oculto</span>' : ''}</div>
          </div>
          <div class="prod-info"><div class="nm">${esc(p.nombre)}</div><div class="pr num">${money(p.precio)}</div><div class="meta">${esc(p.codigo)} · ${p.cantidad} disp.</div></div>
        </button>`).join('') : `<div class="empty" style="grid-column:1/-1"><img src="assets/logo-pequeno.png" alt="">
          <p>${APP.productos.length ? 'No encontré productos con esos filtros.' : ad ? 'Aún no hay productos. Agrega el primero.' : 'El catálogo está vacío por ahora.'}</p>
          ${ad && !APP.productos.length ? '<button type="button" class="btn" id="pVacioNuevo">Agregar producto</button>' : ''}</div>`;
      grid.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => APP.openFicha(APP.prod(b.dataset.id))));
      const vn = grid.querySelector('#pVacioNuevo'); if (vn) vn.addEventListener('click', () => APP.openProductoForm());
    };
    P.productos.paint = paint;
    paint();
    main.querySelector('#pQ').addEventListener('input', U.debounce((e) => { F.q = e.target.value; paint(); }, 120));
    main.querySelectorAll('#pCats [data-cat]').forEach((b) => b.addEventListener('click', () => {
      F.cat = b.dataset.cat; main.querySelectorAll('#pCats .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); paint();
    }));
    main.querySelectorAll('#pFil [data-f]').forEach((b) => b.addEventListener('click', () => {
      F.f = F.f === b.dataset.f ? '' : b.dataset.f;
      main.querySelectorAll('#pFil .chip').forEach((x) => x.setAttribute('aria-pressed', x.dataset.f === F.f)); paint();
    }));
    const nb = main.querySelector('#pNuevo'); if (nb) nb.addEventListener('click', () => APP.openProductoForm());
  };

  /* =====================================================================
     VENDER (administrador y visualizador)
     ===================================================================== */
  APP.addToCart = function (id, opts = {}) {
    const p = APP.prod(id); if (!p) return;
    let l = APP.cart.find((x) => x.id === id);
    if (l) { if (l.cant < p.cantidad) l.cant += 1; else toast('No hay más existencia de ese producto.', { error: true }); }
    else if (p.cantidad > 0) { l = { id, cant: 1, precio: null }; APP.cart.push(l); }
    else toast('Ese producto está agotado.', { error: true });
    if (l && opts.regateo && p.precio_regateo != null) l.precio = p.precio_regateo;
  };
  const form = () => (APP.ventaForm = APP.ventaForm || { forma: 'contado', cliente: '', tel: '', limite: '', quien: U.lsGet('vedith-vendedor', ''), metodo: 'efectivo', cuenta: '' });

  P.vender = async function (main) {
    const ad = isAdmin();
    const f = form();
    let clientes = [];
    if (ad) { try { clientes = await API.clientes(); } catch (_) {} }
    // quitar del carrito lo que ya no existe
    APP.cart = APP.cart.filter((l) => APP.prod(l.id));

    function paint() {
      const lines = APP.cart.map((l) => ({ ...l, p: APP.prod(l.id) }));
      const total = lines.reduce((s, l) => s + (l.precio != null ? l.precio : l.p.precio) * l.cant, 0);
      const bancos = APP.cuentas.filter((c) => c.tipo === 'banco' && c.activa !== false);
      main.innerHTML = `
        <div class="page-head"><div><h1>Vender</h1><p class="sub">Busca, agrega y registra.</p></div></div>
        <div class="stack">
          <div class="row">
            <div class="searchbox grow">${icon('search')}<input class="input" id="vQ" type="search" placeholder="Buscar producto para agregar…" autocomplete="off"></div>
            <button type="button" class="icon-btn" id="vScan" aria-label="Escanear QR" style="border:1.5px solid var(--line-strong);border-radius:14px;width:52px;height:52px">${icon('scan')}</button>
          </div>
          <div id="vRes" class="pick-list" hidden></div>

          <section class="stack-sm" aria-label="Productos en la venta">
            ${lines.length ? lines.map((l) => `
              <div class="cart-line" data-id="${esc(l.id)}">
                <div class="grow"><div class="t1">${esc(l.p.nombre)}</div><div class="small muted">${esc(l.p.codigo)} · quedan ${l.p.cantidad}</div></div>
                <button type="button" class="icon-btn" data-del aria-label="Quitar ${esc(l.p.nombre)}">${icon('x')}</button>
                <div class="stepper" role="group" aria-label="Cantidad">
                  <button type="button" data-minus aria-label="Menos">${icon('minus')}</button>
                  <input type="number" inputmode="numeric" min="1" max="${l.p.cantidad}" value="${l.cant}" aria-label="Cantidad">
                  <button type="button" data-plus aria-label="Más">${icon('plus')}</button>
                </div>
                ${ad ? `<label class="field" style="justify-self:end;max-width:140px"><span class="xs muted">Precio c/u</span><input class="input" data-precio type="number" inputmode="decimal" min="0" step="0.01" value="${l.precio != null ? l.precio : l.p.precio}" style="min-height:42px;text-align:right"></label>`
                     : `<div class="amt num" style="justify-self:end">${money((l.precio != null ? l.precio : l.p.precio) * l.cant)}</div>`}
                ${l.p.precio_regateo != null ? `<div style="grid-column:1/-1" class="row wrap">${
                  l.precio === l.p.precio_regateo
                    ? `<span class="pill ok">${icon('tag', 'sm')} Descuento aplicado: ${money(l.p.precio_regateo)} c/u</span><button type="button" class="btn ghost sm" data-reg-quitar>Quitar</button>`
                    : l.showReg
                      ? `<span class="small muted">Último precio:</span><button type="button" class="btn secondary sm" data-reg-usar>${money(l.p.precio_regateo)} · vender a este precio</button>`
                      : `<button type="button" class="btn ghost sm" data-reg-ver>${icon('tag', 'sm')} Descuento (Regateo)</button>`}</div>` : ''}
              </div>`).join('') : `<div class="card empty flat">${icon('bag', 'lg')}<p>Aún no has agregado nada. Usa el buscador de arriba.</p></div>`}
          </section>

          ${lines.length ? `
          <div class="total-bar"><span>Total</span><b class="num" id="vTotal">${money(total)}</b></div>
          <section class="card stack" aria-label="Datos de la venta">
            <div class="stack-sm"><span class="small" style="font-weight:800">Forma de pago</span>
              <div class="seg" role="group" aria-label="Forma de pago">
                <button type="button" data-fp="contado" aria-pressed="${f.forma === 'contado'}">Contado</button>
                <button type="button" data-fp="fiado" aria-pressed="${f.forma === 'fiado'}">Fiado</button>
              </div></div>
            ${f.forma === 'contado' ? `<div class="stack-sm"><span class="small" style="font-weight:800">¿Cómo pagó el cliente?</span>
              <div class="seg" role="group" aria-label="Cómo pagó">${Object.entries(APP.METODOS).map(([k, l]) => `<button type="button" data-mc="${k}" aria-pressed="${f.metodo === k}">${l}</button>`).join('')}</div>
              ${f.metodo === 'efectivo'
                ? '<p class="small muted">Queda como efectivo en mano. Luego puedes registrar el depósito al banco en “Dinero”.</p>'
                : bancos.length
                  ? `<label class="field">¿A qué cuenta entró el dinero? *<select class="input" id="vCuenta"><option value="">Elige la cuenta…</option>${bancos.map((c) => `<option value="${esc(c.id)}" ${c.id === f.cuenta ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>`
                  : '<div class="banner">' + icon('alert') + '<span class="small">Aún no hay cuentas de banco. La administración las agrega en “Dinero”.</span></div>'}
            </div>` : ''}
            ${f.forma === 'fiado' ? `<div class="stack" id="vFiado">
              <label class="field">Nombre del cliente *<input class="input" id="vCli" list="vCliList" value="${esc(f.cliente)}" placeholder="¿Quién se lleva el producto?" autocomplete="off"></label>
              <datalist id="vCliList">${clientes.map((c) => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
              <div class="grid-2">
                <label class="field">Teléfono <span class="hint">para recordarle el pago</span><input class="input" id="vTel" type="tel" inputmode="tel" value="${esc(f.tel)}" placeholder="5555-1234"></label>
                <label class="field">Fecha límite de pago<input class="input" id="vLim" type="date" value="${esc(f.limite)}" min="${APP.hoyStr()}"></label>
              </div></div>` : ''}
            ${f.forma === 'contado' ? `<label class="field">Cliente <span class="hint">opcional</span><input class="input" id="vCliOpt" value="${esc(f.cliente)}" placeholder="Nombre del cliente" autocomplete="off"></label>` : ''}
            <label class="field">${ad ? 'Vendido por' : '¿Quién vende? *'}<input class="input" id="vQuien" value="${esc(f.quien)}" placeholder="${ad ? 'Administración' : 'Tu nombre'}" maxlength="40" autocomplete="name">
              ${ad ? '' : '<span class="hint">Se guarda en cada venta y le llega a la administración.</span>'}</label>
          </section>
          <button type="button" class="btn block green" id="vOk" style="min-height:56px;font-size:1.1rem">${icon('check')} Registrar venta</button>` : ''}
        </div>`;
      bind();
    }

    function bind() {
      const q = main.querySelector('#vQ'), res = main.querySelector('#vRes');
      const pintarRes = () => {
        const txt = q.value.trim();
        if (!txt) { res.hidden = true; return; }
        const list = APP.productos.filter((p) => p.activo !== false && APP.matchProducto(p, txt)).slice(0, 8);
        res.hidden = false;
        res.innerHTML = list.length ? list.map((p) => APP.productoItem(p)).join('') : '<div class="empty">No encontré ese producto.</div>';
        res.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => { APP.addToCart(b.dataset.id); saveFormFields(); paint(); main.querySelector('#vQ').focus(); }));
      };
      q.addEventListener('input', pintarRes);
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = res.querySelector('[data-id]'); if (b) b.click(); } });
      main.querySelector('#vScan').addEventListener('click', () => APP.openScanner({ onPick: (p) => { APP.addToCart(p.id); saveFormFields(); paint(); toast('Agregado: ' + p.nombre); } }));

      main.querySelectorAll('.cart-line').forEach((row) => {
        const l = APP.cart.find((x) => x.id === row.dataset.id), p = APP.prod(l.id);
        const set = (n) => { l.cant = Math.min(p.cantidad, Math.max(1, n || 1)); saveFormFields(); paint(); };
        row.querySelector('[data-del]').addEventListener('click', () => { APP.cart = APP.cart.filter((x) => x !== l); saveFormFields(); paint(); });
        row.querySelector('[data-minus]').addEventListener('click', () => set(l.cant - 1));
        row.querySelector('[data-plus]').addEventListener('click', () => { if (l.cant >= p.cantidad) toast('No hay más existencia.', { error: true }); set(l.cant + 1); });
        row.querySelector('.stepper input').addEventListener('change', (e) => set(parseInt(e.target.value, 10)));
        const on = (sel, fn) => { const b = row.querySelector(sel); if (b) b.addEventListener('click', fn); };
        on('[data-reg-ver]', () => { l.showReg = true; saveFormFields(); paint(); });
        on('[data-reg-usar]', () => { l.precio = p.precio_regateo; saveFormFields(); paint(); });
        on('[data-reg-quitar]', () => { l.precio = null; l.showReg = false; saveFormFields(); paint(); });
        const pr = row.querySelector('[data-precio]');
        if (pr) pr.addEventListener('change', (e) => { const v = parseFloat(e.target.value); l.precio = isNaN(v) || v === p.precio ? null : Math.max(0, v); saveFormFields(); paint(); });
      });
      main.querySelectorAll('[data-mc]').forEach((b) => b.addEventListener('click', () => { saveFormFields(); f.metodo = b.dataset.mc; f.cuenta = ''; paint(); }));
      main.querySelectorAll('[data-fp]').forEach((b) => b.addEventListener('click', () => { saveFormFields(); f.forma = b.dataset.fp; paint(); }));
      const ok = main.querySelector('#vOk'); if (ok) ok.addEventListener('click', confirmar);
    }

    function saveFormFields() {
      const g = (s) => main.querySelector(s);
      if (g('#vCli')) f.cliente = g('#vCli').value; else if (g('#vCliOpt')) f.cliente = g('#vCliOpt').value;
      if (g('#vTel')) f.tel = g('#vTel').value;
      if (g('#vLim')) f.limite = g('#vLim').value;
      if (g('#vQuien')) f.quien = g('#vQuien').value;
      if (g('#vCuenta')) f.cuenta = g('#vCuenta').value;
    }

    async function confirmar() {
      saveFormFields();
      const quien = f.quien.trim();
      if (!ad && !quien) { main.querySelector('#vQuien').classList.add('bad'); main.querySelector('#vQuien').focus(); return toast('Escribe tu nombre para registrar quién vende.', { error: true }); }
      if (f.forma === 'fiado' && !f.cliente.trim()) { main.querySelector('#vCli').classList.add('bad'); main.querySelector('#vCli').focus(); return toast('Para vender fiado hace falta el nombre del cliente.', { error: true }); }
      if (f.forma === 'contado' && f.metodo !== 'efectivo' && !f.cuenta) { const c = main.querySelector('#vCuenta'); if (c) { c.classList.add('bad'); c.focus(); } return toast('Elige a qué cuenta entró el dinero.', { error: true }); }
      if (quien) U.lsSet('vedith-vendedor', quien);
      const btn = main.querySelector('#vOk'); btn.disabled = true;
      const hechas = [], fallas = [];
      for (const l of [...APP.cart]) {
        const p = APP.prod(l.id);
        try {
          const r = await API.vender({
            producto_id: l.id, cantidad: l.cant, vendido_por: quien, forma_pago: f.forma,
            cliente_nombre: f.cliente.trim(), cliente_telefono: f.tel, fecha_limite: f.forma === 'fiado' ? f.limite || null : null,
            precio: l.precio, metodo_cobro: f.forma === 'contado' ? f.metodo : null, cuenta_id: f.forma === 'contado' && f.metodo !== 'efectivo' ? f.cuenta : null
          });
          hechas.push(r); APP.cart = APP.cart.filter((x) => x !== l);
        } catch (e) { fallas.push({ nombre: p ? p.nombre : 'Producto', msg: APP.errMsg(e) }); if ((e.message || '').includes('NO_AUTORIZADO')) return APP.handleErr(e); }
      }
      try { await APP.refreshCore(); } catch (_) {}
      if (!fallas.length) { f.cliente = ''; f.tel = ''; f.limite = ''; f.forma = 'contado'; f.metodo = 'efectivo'; f.cuenta = ''; }
      if (hechas.length) recibo(hechas, fallas);
      else { toast(fallas[0] ? `${fallas[0].nombre}: ${fallas[0].msg}` : 'No se pudo registrar.', { error: true, ms: 5000 }); }
      paint();
    }

    function recibo(hechas, fallas) {
      const total = hechas.reduce((s, r) => s + Number(r.total), 0);
      const fiado = hechas[0].forma_pago === 'fiado';
      const texto = `Vedith Variedades\n` + hechas.map((r) => `${r.cantidad} × ${r.producto_nombre} — ${money(r.total)}`).join('\n') + `\nTotal: ${money(total)}${fiado ? '\n(Queda pendiente de pago)' : ''}\n¡Gracias por tu compra!`;
      const m = openModal({
        title: 'Venta registrada',
        body: `<div class="receipt"><div class="ok">${icon('check', 'lg')}</div>
          <h2>${money(total)}</h2>
          <p class="muted">${fiado ? 'Fiado a <b>' + esc(hechas[0].cliente_nombre) + '</b>' : 'Pagado al contado · ' + esc(APP.METODOS[hechas[0].metodo_cobro] || 'Efectivo')}${hechas[0].vendido_por ? ' · vende ' + esc(hechas[0].vendido_por) : ''}</p></div>
          <div class="list">${hechas.map((r) => `<div class="item"><span class="grow t1">${r.cantidad} × ${esc(r.producto_nombre)}</span><span class="amt num">${money(r.total)}</span></div>`).join('')}</div>
          ${fallas.length ? `<div class="banner bad">${icon('alert')}<span class="small"><b>No se pudo vender:</b> ${fallas.map((x) => esc(x.nombre + ' — ' + x.msg)).join('; ')}. Sigue en tu lista.</span></div>` : ''}
          ${isAdmin() ? '' : '<p class="small muted center">La administración ya recibió el aviso de esta venta.</p>'}`,
        footer: `<a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">${icon('chat')} Enviar por WhatsApp</a><button type="button" class="btn" data-ok>Listo</button>`
      });
      m.foot.querySelector('[data-ok]').addEventListener('click', () => m.close());
    }

    paint();
  };

  /* =====================================================================
     MIS VENTAS (visualizador)
     ===================================================================== */
  P['mis-ventas'] = async function (main) {
    const ventas = (await API.misVentas()).filter((v) => !v.anulada);
    const hoy = APP.hoyStr();
    const deHoy = ventas.filter((v) => APP.diaDe(v.created_at) === hoy);
    const porDia = {};
    ventas.forEach((v) => { (porDia[APP.diaDe(v.created_at)] = porDia[APP.diaDe(v.created_at)] || []).push(v); });
    main.innerHTML = `
      <div class="page-head"><div><h1>Mis ventas</h1><p class="sub">Lo que has registrado tú en este teléfono.</p></div></div>
      <div class="kpis" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
        <div class="kpi pink"><span class="k-l">Vendido hoy</span><span class="k-v num">${money(deHoy.reduce((s, v) => s + Number(v.total), 0))}</span></div>
        <div class="kpi green"><span class="k-l">Ventas hoy</span><span class="k-v num">${deHoy.length}</span></div>
      </div>
      ${ventas.length ? Object.keys(porDia).sort().reverse().map((d) => `
        <section class="stack-sm" style="margin-bottom:16px"><h3>${d === hoy ? 'Hoy' : fmtDate(d)}</h3>
          <div class="list">${porDia[d].map((v) => `<div class="item"><span class="grow"><div class="t1">${v.cantidad} × ${esc(v.producto_nombre)}</div><div class="t2">${fmtTime(v.created_at)}${v.cliente_nombre ? ' · ' + esc(v.cliente_nombre) : ''}</div></span>
            <span style="text-align:right"><div class="amt num">${money(v.total)}</div>${v.forma_pago === 'fiado' ? '<span class="pill warn">Fiado</span>' : ''}</span></div>`).join('')}</div></section>`).join('')
        : '<div class="card empty">Todavía no has registrado ventas.<a class="btn" href="#/vender">Vender ahora</a></div>'}
      <p class="small muted center">Si te equivocaste en una venta, avisa a la administración para que la corrija.</p>`;
  };
})();
