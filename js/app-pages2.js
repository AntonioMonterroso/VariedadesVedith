/* Pantallas 2/2 (solo administrador): Ventas, Por cobrar, Reportes, Gastos,
   Etiquetas QR, Notificaciones y Ajustes. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal, confirmDialog, fmtDate, fmtTime, ymd } = U;
  const APP = window.APP;
  const P = APP.pages;
  const C = window.VEDITH_CONFIG;

  const PERIODOS = [['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['todo', 'Todo']];
  const desde = (per) => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (per === 'todo') return new Date(0);
    if (per === 'semana') d.setDate(d.getDate() - 6);
    if (per === 'mes') d.setDate(1);
    return d;
  };
  const enPeriodo = (iso, per) => new Date(iso) >= desde(per);
  const chipsPeriodo = (act) => `<div class="chips" id="perChips" role="group" aria-label="Periodo">${PERIODOS.map(([k, l]) => `<button type="button" class="chip" data-per="${k}" aria-pressed="${act === k}">${l}</button>`).join('')}</div>`;
  const sum = (a, f) => a.reduce((s, x) => s + Number(f(x)), 0);

  /* =====================================================================
     VENTAS
     ===================================================================== */
  const vf = { per: 'hoy', quien: '', pago: '' };
  P.ventas = async function (main) {
    const ventas = await API.ventas();
    const paint = () => {
      const base = ventas.filter((v) => enPeriodo(v.created_at, vf.per));
      const personas = [...new Set(base.map((v) => v.vendido_por))].sort();
      let list = base.filter((v) => (!vf.quien || v.vendido_por === vf.quien) && (!vf.pago || v.forma_pago === vf.pago));
      const vivas = list.filter((v) => !v.anulada);
      const porPersona = {};
      vivas.forEach((v) => { const k = v.vendido_por; porPersona[k] = porPersona[k] || { n: 0, total: 0, rol: v.rol }; porPersona[k].n += 1; porPersona[k].total += Number(v.total); });
      main.innerHTML = `
        <div class="page-head"><div><h1>Ventas</h1><p class="sub">Todo lo que se vende, y quién lo vende.</p></div></div>
        ${chipsPeriodo(vf.per)}
        <div class="row wrap" style="margin-bottom:14px">
          <select class="input" id="vfQuien" style="max-width:220px" aria-label="Filtrar por persona"><option value="">Todas las personas</option>${personas.map((p) => `<option ${p === vf.quien ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
          <select class="input" id="vfPago" style="max-width:180px" aria-label="Filtrar por pago"><option value="">Contado y fiado</option><option value="contado" ${vf.pago === 'contado' ? 'selected' : ''}>Solo contado</option><option value="fiado" ${vf.pago === 'fiado' ? 'selected' : ''}>Solo fiado</option></select>
        </div>
        <div class="kpis" style="margin-bottom:16px">
          <div class="kpi pink"><span class="k-l">Vendido</span><span class="k-v num">${money(sum(vivas, (v) => v.total))}</span></div>
          <div class="kpi"><span class="k-l">Ventas</span><span class="k-v num">${vivas.length}</span></div>
          <div class="kpi green"><span class="k-l">Ganancia bruta</span><span class="k-v num">${money(sum(vivas, (v) => v.total - v.costo_unitario * v.cantidad))}</span></div>
          <div class="kpi orange"><span class="k-l">A fiado</span><span class="k-v num">${money(sum(vivas.filter((v) => v.forma_pago === 'fiado'), (v) => v.total))}</span></div>
        </div>
        ${Object.keys(porPersona).length ? `<section class="card flat" style="margin-bottom:16px"><h3 style="margin-bottom:8px">Por persona</h3>
          <div class="scroll-x"><table class="tbl"><thead><tr><th>Quién</th><th class="r">Ventas</th><th class="r">Total</th></tr></thead><tbody>
          ${Object.entries(porPersona).sort((a, b) => b[1].total - a[1].total).map(([k, x]) => `<tr><td>${esc(k)} ${x.rol === 'visualizador' ? '<span class="pill">visualizador</span>' : ''}</td><td class="r num">${x.n}</td><td class="r num"><b>${money(x.total)}</b></td></tr>`).join('')}
          </tbody></table></div></section>` : ''}
        <div class="list">${list.length ? list.map((v) => `
          <div class="item" ${v.anulada ? 'style="opacity:.6"' : ''}>
            <span class="grow"><div class="t1">${v.cantidad} × ${esc(v.producto_nombre)}</div>
              <div class="t2">${esc(v.vendido_por)} · ${fmtDate(v.created_at)} ${fmtTime(v.created_at)}${v.cliente_nombre ? ' · ' + esc(v.cliente_nombre) : ''}</div></span>
            <span style="text-align:right"><div class="amt num">${money(v.total)}</div>
              ${v.forma_pago === 'fiado' ? '<span class="pill warn">Fiado</span>' : v.metodo_cobro ? `<span class="pill">${esc(APP.METODOS[v.metodo_cobro] || '')}${v.cuenta_id && v.metodo_cobro !== 'efectivo' ? ' · ' + esc(APP.cuentaNombre(v.cuenta_id)) : ''}</span>` : ''}${v.precio_lista != null && Number(v.precio_unitario) < Number(v.precio_lista) ? ' <span class="pill pink">Descuento</span>' : ''}${v.anulada ? '<span class="pill bad">Anulada</span>' : ''}</span>
            ${v.anulada ? '' : `<button type="button" class="icon-btn" data-anular="${esc(v.id)}" aria-label="Anular venta" data-tip="Anular">${icon('trash')}</button>`}
          </div>`).join('') : '<div class="card empty">No hay ventas en este periodo.</div>'}</div>`;
      bind();
    };
    const bind = () => {
      main.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => { vf.per = b.dataset.per; vf.quien = ''; paint(); }));
      main.querySelector('#vfQuien').addEventListener('change', (e) => { vf.quien = e.target.value; paint(); });
      main.querySelector('#vfPago').addEventListener('change', (e) => { vf.pago = e.target.value; paint(); });
      main.querySelectorAll('[data-anular]').forEach((b) => b.addEventListener('click', async () => {
        const v = ventas.find((x) => x.id === b.dataset.anular);
        if (!await confirmDialog({ title: 'Anular venta', message: `¿Anular ${v.cantidad} × ${v.producto_nombre} (${money(v.total)})? El producto vuelve al inventario.`, okLabel: 'Anular venta', danger: true })) return;
        try { await API.anularVenta(v.id); v.anulada = true; await APP.refreshCore(); toast('Venta anulada y stock devuelto'); paint(); } catch (e) { APP.handleErr(e); }
      }));
    };
    paint();
  };

  /* =====================================================================
     POR COBRAR (fiado)
     ===================================================================== */
  P.cobrar = async function (main) {
    const [ventas, abonos] = await Promise.all([API.ventas(), API.abonos()]);
    const ab = APP.abonosDe(abonos);
    const deudas = ventas.filter((v) => !v.anulada && v.forma_pago === 'fiado' && APP.saldo(v, ab) > 0.004);
    const porCli = {};
    deudas.forEach((v) => { const k = (v.cliente_nombre || 'Sin nombre'); (porCli[k] = porCli[k] || []).push(v); });
    const clientes = await API.clientes().catch(() => []);
    const tel = (n) => (clientes.find((c) => c.nombre.toLowerCase() === n.toLowerCase()) || {}).telefono || '';
    const total = sum(deudas, (v) => APP.saldo(v, ab));
    main.innerHTML = `
      <div class="page-head"><div><h1>Por cobrar</h1><p class="sub">Clientes con ventas a fiado pendientes.</p></div></div>
      <div class="kpis" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
        <div class="kpi orange"><span class="k-l">Total por cobrar</span><span class="k-v num">${money(total)}</span></div>
        <div class="kpi"><span class="k-l">Clientes que deben</span><span class="k-v num">${Object.keys(porCli).length}</span></div>
      </div>
      ${Object.keys(porCli).length ? `<div class="stack">${Object.entries(porCli).sort((a, b) => sum(b[1], (v) => APP.saldo(v, ab)) - sum(a[1], (v) => APP.saldo(v, ab))).map(([nombre, vs]) => {
        const debe = sum(vs, (v) => APP.saldo(v, ab));
        const vencida = vs.some(APP.venceHoy);
        const t = tel(nombre);
        const txt = `Hola ${nombre}, te escribe Vedith Variedades. Te recuerdo que tienes un saldo pendiente de ${money(debe)}. ¡Gracias!`;
        return `<section class="card stack-sm">
          <div class="row between wrap"><div><h3>${esc(nombre)}</h3>${t ? `<div class="small muted">${esc(t)}</div>` : ''}</div>
            <div style="text-align:right"><div class="amt num" style="font-family:var(--font-display);font-size:1.4rem;font-weight:600">${money(debe)}</div>${vencida ? '<span class="pill bad">Vencida</span>' : ''}</div></div>
          <div class="list">${vs.map((v) => `<div class="item" style="padding:8px 12px"><span class="grow"><div class="t1 small">${v.cantidad} × ${esc(v.producto_nombre)}</div><div class="t2">${fmtDate(v.created_at)}${v.fecha_limite ? ' · paga antes del ' + fmtDate(v.fecha_limite) : ''}</div></span><span class="amt num small">${money(APP.saldo(v, ab))}</span></div>`).join('')}</div>
          <div class="row wrap"><button type="button" class="btn green sm" data-abono="${esc(nombre)}">${icon('wallet', 'sm')} Registrar abono</button>
          ${t ? `<a class="btn secondary sm" target="_blank" rel="noopener" href="${APP.wa(t, txt)}">${icon('chat', 'sm')} Recordar por WhatsApp</a>` : ''}</div>
        </section>`;
      }).join('')}</div>` : '<div class="card empty">Nadie te debe nada. ¡Todo cobrado!</div>'}`;
    main.querySelectorAll('[data-abono]').forEach((b) => b.addEventListener('click', () => {
      const nombre = b.dataset.abono, vs = porCli[nombre].slice().sort((a, c) => new Date(a.created_at) - new Date(c.created_at));
      const debe = sum(vs, (v) => APP.saldo(v, ab));
      const pick = APP.pickerCuenta({ label: '¿Cómo pagó?', efectivoTxt: 'Suma al efectivo en mano.' });
      const m = openModal({
        title: 'Abono de ' + nombre,
        body: `<p class="muted">Debe <b>${money(debe)}</b>. El abono se aplica primero a la deuda más vieja.</p>
          <label class="field">Monto que paga<input class="input" id="abMonto" type="number" inputmode="decimal" min="0.01" step="0.01" max="${debe}" value="${debe}" autofocus></label>
          ${pick.host}
          <label class="field">Nota <span class="hint">opcional</span><input class="input" id="abNota" maxlength="80" placeholder="Ej.: pagó el saldo de septiembre"></label>`,
        footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn green" data-ok>Guardar abono</button>'
      });
      pick.mount(m.body);
      m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
      m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
        const dest = pick.leer(); if (!dest) return toast('Elige a qué cuenta entró el dinero.', { error: true });
        let resto = Math.round(parseFloat(m.body.querySelector('#abMonto').value) * 100) / 100;
        const nota = m.body.querySelector('#abNota').value;
        if (!(resto > 0) || resto > debe + 0.001) return toast('El monto no es válido.', { error: true });
        try {
          for (const v of vs) {
            if (resto <= 0.004) break;
            const parte = Math.min(resto, APP.saldo(v, ab));
            if (parte <= 0.004) continue;
            await API.registrarAbono(v.id, Math.round(parte * 100) / 100, nota, dest.metodo, dest.cuenta_id);
            resto = Math.round((resto - parte) * 100) / 100;
          }
          m.close(); toast('Abono registrado'); APP.render();
        } catch (e) { APP.handleErr(e); }
      });
    }));
  };

  /* =====================================================================
     REPORTES + respaldo Excel
     ===================================================================== */
  const rf = { per: 'mes' };
  P.reportes = async function (main) {
    const [ventas, abonos, gastos] = await Promise.all([API.ventas(), API.abonos(), API.gastos()]);
    const paint = () => {
      const vs = ventas.filter((v) => !v.anulada && enPeriodo(v.created_at, rf.per));
      const gs = gastos.filter((g) => new Date(g.fecha + 'T12:00:00') >= desde(rf.per));
      const vendido = sum(vs, (v) => v.total), costo = sum(vs, (v) => v.costo_unitario * v.cantidad), gasto = sum(gs, (g) => g.monto);
      const ab = APP.abonosDe(abonos);
      const cobradoFiado = sum(vs.filter((v) => v.forma_pago === 'fiado'), (v) => Math.min(v.total, ab[v.id] || 0));
      const cobrado = sum(vs.filter((v) => v.forma_pago === 'contado'), (v) => v.total) + cobradoFiado;
      const top = {};
      vs.forEach((v) => { top[v.producto_nombre] = top[v.producto_nombre] || { n: 0, t: 0 }; top[v.producto_nombre].n += v.cantidad; top[v.producto_nombre].t += Number(v.total); });
      const topL = Object.entries(top).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
      main.innerHTML = `
        <div class="page-head"><div><h1>Reportes</h1><p class="sub">Cómo va el negocio.</p></div><button type="button" class="btn secondary" id="rExcel">${icon('download')} Respaldo Excel</button></div>
        ${chipsPeriodo(rf.per)}
        <div class="kpis" style="margin-bottom:16px">
          <div class="kpi pink"><span class="k-l">Vendido</span><span class="k-v num">${money(vendido)}</span></div>
          <div class="kpi green"><span class="k-l">Cobrado</span><span class="k-v num">${money(cobrado)}</span></div>
          <div class="kpi orange"><span class="k-l">Por cobrar</span><span class="k-v num">${money(vendido - cobrado)}</span></div>
          <div class="kpi"><span class="k-l">Ganancia neta</span><span class="k-v num">${money(vendido - costo - gasto)}</span><span class="small muted">vendido − costo − gastos</span></div>
        </div>
        <section class="card flat" style="margin-bottom:16px"><h3 style="margin-bottom:8px">Resumen</h3>
          <dl class="kv"><dt>Vendido</dt><dd class="num">${money(vendido)}</dd><dt>Costo de lo vendido</dt><dd class="num">− ${money(costo)}</dd><dt>Ganancia bruta</dt><dd class="num">${money(vendido - costo)}</dd><dt>Gastos</dt><dd class="num">− ${money(gasto)}</dd><dt><b>Ganancia neta</b></dt><dd class="num"><b>${money(vendido - costo - gasto)}</b></dd></dl></section>
        <section class="card flat"><h3 style="margin-bottom:8px">Lo que más se vende</h3>
          ${topL.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Piezas</th><th class="r">Total</th></tr></thead><tbody>${topL.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="r num">${x.n}</td><td class="r num">${money(x.t)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin ventas en este periodo.</p>'}</section>`;
      main.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => { rf.per = b.dataset.per; paint(); }));
      main.querySelector('#rExcel').addEventListener('click', APP.exportarExcel);
    };
    paint();
  };

  APP.exportarExcel = async function () {
    if (!window.XLSX) return toast('No se pudo cargar el generador de Excel. Revisa tu internet.', { error: true });
    try {
      const [prods, ventas, abonos, gastos, clientes, cajas, movs] = await Promise.all([API.productos(), API.ventas(), API.abonos(), API.gastos(), API.clientes(), API.cajas(), API.movimientos()]);
      const wb = XLSX.utils.book_new();
      const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ vacío: '' }]), name);
      add('Productos', prods.map((p) => ({ Código: p.codigo, 'Código Tupperware': p.codigo_tupperware, Nombre: p.nombre, Categoría: p.categoria, Precio: p.precio, Costo: p.costo, Cantidad: p.cantidad, 'Aviso en': p.stock_minimo, Visible: p.activo ? 'Sí' : 'No', 'Etiqueta impresa': p.etiqueta_impresa_at ? fmtDate(p.etiqueta_impresa_at) : 'No', Fotos: p.fotos.join(' | '), Descripción: p.descripcion })));
      add('Ventas', ventas.map((v) => ({ Fecha: new Date(v.created_at).toLocaleString('es-GT'), Producto: v.producto_nombre, Código: v.producto_codigo, Cantidad: v.cantidad, 'Precio c/u': v.precio_unitario, Total: v.total, Costo: v.costo_unitario * v.cantidad, Pago: v.forma_pago, 'Cómo pagó': APP.METODOS[v.metodo_cobro] || '', Cuenta: APP.cuentaNombre(v.cuenta_id), 'Precio de lista': v.precio_lista, Cliente: v.cliente_nombre, 'Vendido por': v.vendido_por, Anulada: v.anulada ? 'Sí' : '' })));
      add('Abonos', abonos.map((a) => ({ Fecha: new Date(a.created_at).toLocaleString('es-GT'), Monto: a.monto, Nota: a.nota, Venta: a.venta_id })));
      add('Cajas', cajas.flatMap((c) => (c.items.length ? c.items : [{}]).map((i) => ({ Caja: c.nombre, Pedido: c.numero_pedido, 'Fecha pedido': c.fecha_pedido, Estado: c.estado, Total: c.monto_total, Pagada: c.pagada ? 'Sí' : 'No', 'Pagada el': c.pagada_el, 'Cómo se pagó': APP.METODOS[c.metodo_pago] || '', Cuenta: APP.cuentaNombre(c.cuenta_id), Producto: i.producto_nombre, Cantidad: i.cantidad, 'Costo c/u': i.costo_unitario }))));
      add('Depósitos', movs.map((mv) => ({ Fecha: mv.fecha, De: APP.cuentaNombre(mv.origen_id), A: APP.cuentaNombre(mv.destino_id), Monto: mv.monto, Nota: mv.nota })));
      add('Gastos', gastos.map((g) => ({ Fecha: g.fecha, Concepto: g.concepto, Monto: g.monto, Nota: g.nota })));
      add('Clientes', clientes.map((c) => ({ Nombre: c.nombre, Teléfono: c.telefono })));
      XLSX.writeFile(wb, `respaldo_vedith_${ymd(new Date())}.xlsx`);
      toast('Respaldo descargado');
    } catch (e) { APP.handleErr(e); }
  };

  /* =====================================================================
     GASTOS
     ===================================================================== */
  P.gastos = async function (main) {
    const gastos = await API.gastos();
    const mes = APP.hoyStr().slice(0, 7);
    main.innerHTML = `
      <div class="page-head"><div><h1>Gastos</h1><p class="sub">Este mes: <b>${money(sum(gastos.filter((g) => g.fecha.startsWith(mes)), (g) => g.monto))}</b></p></div><button type="button" class="btn" id="gNuevo">${icon('plus')} Gasto</button></div>
      <div class="list">${gastos.length ? gastos.map((g) => `<button type="button" class="item" data-id="${esc(g.id)}"><span class="grow"><div class="t1">${esc(g.concepto)}</div><div class="t2">${fmtDate(g.fecha)}${g.nota ? ' · ' + esc(g.nota) : ''}</div></span><span class="amt num">${money(g.monto)}</span></button>`).join('') : '<div class="card empty">Aún no registras gastos (envíos, bolsas, gasolina…).</div>'}</div>`;
    const abrir = (g) => {
      g = g || { concepto: '', monto: '', fecha: APP.hoyStr(), nota: '' };
      const m = openModal({
        title: g.id ? 'Editar gasto' : 'Gasto nuevo',
        body: `<label class="field">¿En qué se gastó? *<input class="input" id="gC" value="${esc(g.concepto)}" maxlength="80" placeholder="Ej.: Envío del pedido" autofocus></label>
          <div class="grid-2"><label class="field">Monto *<input class="input" id="gM" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(g.monto)}"></label>
          <label class="field">Fecha<input class="input" id="gF" type="date" value="${esc(g.fecha)}"></label></div>
          <label class="field">Nota <span class="hint">opcional</span><input class="input" id="gN" maxlength="120" value="${esc(g.nota || '')}"></label>`,
        footer: `${g.id ? `<button type="button" class="btn secondary" style="flex:0 0 auto" data-del aria-label="Eliminar">${icon('trash')}</button>` : ''}<button type="button" class="btn" data-ok>Guardar</button>`
      });
      const del = m.foot.querySelector('[data-del]');
      if (del) del.addEventListener('click', async () => { if (await confirmDialog({ title: 'Eliminar gasto', message: '¿Eliminar este gasto?', okLabel: 'Eliminar', danger: true })) { try { await API.deleteGasto(g.id); m.close(); APP.render(); } catch (e) { APP.handleErr(e); } } });
      m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
        const concepto = m.body.querySelector('#gC').value.trim(), monto = m.body.querySelector('#gM').value;
        if (!concepto || monto === '' || Number(monto) < 0) return toast('Falta el concepto o el monto.', { error: true });
        try { await API.saveGasto({ id: g.id, concepto, monto, fecha: m.body.querySelector('#gF').value || APP.hoyStr(), nota: m.body.querySelector('#gN').value.trim() }); m.close(); toast('Gasto guardado'); APP.render(); } catch (e) { APP.handleErr(e); }
      });
    };
    main.querySelector('#gNuevo').addEventListener('click', () => abrir());
    main.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => abrir(gastos.find((g) => g.id === b.dataset.id))));
  };

  /* =====================================================================
     ETIQUETAS QR  (solo admin; nunca se bloquea reimprimir)
     ===================================================================== */
  const ef = { filtro: 'pendientes', cat: '', formato: 'f-24', precio: true, sel: new Set() };
  P.etiquetas = async function (main) {
    if (APP.preselect) { ef.sel = new Set(APP.preselect); ef.filtro = 'todas'; APP.preselect = null; }
    const visibles = () => APP.productos.filter((p) => p.activo
      && (ef.filtro === 'todas' || (ef.filtro === 'pendientes' ? !p.etiqueta_impresa_at : !!p.etiqueta_impresa_at))
      && (!ef.cat || p.categoria_id === ef.cat));
    const pendientes = APP.productos.filter((p) => p.activo && !p.etiqueta_impresa_at).length;

    const paint = () => {
      const list = visibles();
      const elegidos = APP.productos.filter((p) => ef.sel.has(p.id));
      main.innerHTML = `
        <div class="page-head"><div><h1>Etiquetas QR</h1><p class="sub">${pendientes ? `<b>${pendientes}</b> sin imprimir` : 'Todas las etiquetas están impresas'} · puedes reimprimir cuando quieras.</p></div></div>
        ${APP.baseUrlEsLocal() ? `<div class="banner" style="margin-bottom:14px">${icon('alert')}<span class="small">Los QR apuntan a <b>${esc(APP.baseUrl())}</b>, una dirección de prueba. Cuando publiques la app, escribe su dirección real en <a href="#/ajustes">Ajustes</a> antes de imprimir las definitivas.</span></div>` : ''}
        <div class="chips" role="group" aria-label="Qué mostrar">
          ${[['pendientes', 'Sin imprimir'], ['impresas', 'Ya impresas'], ['todas', 'Todas']].map(([k, l]) => `<button type="button" class="chip" data-fil="${k}" aria-pressed="${ef.filtro === k}">${l}</button>`).join('')}
          <select class="input" id="efCat" style="width:auto;min-height:40px;border-radius:999px" aria-label="Categoría"><option value="">Todas las categorías</option>${APP.categorias.map((c) => `<option value="${esc(c.id)}" ${c.id === ef.cat ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>
        </div>
        <div class="row between wrap" style="margin:6px 0 10px"><label class="row"><input type="checkbox" id="efAll" style="width:22px;height:22px;accent-color:var(--pink-600)" ${list.length && list.every((p) => ef.sel.has(p.id)) ? 'checked' : ''}> <b>Seleccionar todo (${list.length})</b></label><span class="small muted">${elegidos.length} elegidos</span></div>
        <div class="list" style="max-height:44dvh;overflow:auto;margin-bottom:16px">
          ${list.length ? list.map((p) => `<label class="sel-item ${ef.sel.has(p.id) ? 'selected' : ''}"><input type="checkbox" data-id="${esc(p.id)}" ${ef.sel.has(p.id) ? 'checked' : ''}>
            <span class="grow"><div class="t1">${esc(p.nombre)}</div><div class="t2">${esc(p.codigo)} · ${money(p.precio)}</div></span>
            ${p.etiqueta_impresa_at ? `<span class="pill ok">Impresa ${fmtDate(p.etiqueta_impresa_at)}</span>` : '<span class="pill pink">Sin imprimir</span>'}</label>`).join('') : '<div class="card empty flat">No hay productos con este filtro.</div>'}
        </div>
        <section class="card stack">
          <div class="row wrap"><span class="small" style="font-weight:800">Tamaño de hoja</span>
            <div class="seg" role="group" aria-label="Formato"><button type="button" data-fmt="f-24" aria-pressed="${ef.formato === 'f-24'}">3 × 8 (24)</button><button type="button" data-fmt="f-40" aria-pressed="${ef.formato === 'f-40'}">4 × 10 (40)</button></div></div>
          <label class="row"><input type="checkbox" id="efPrecio" ${ef.precio ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--pink-600)"> <span>Mostrar el precio en la etiqueta</span></label>
          <div class="row wrap">
            <button type="button" class="btn" id="efPrint" ${elegidos.length ? '' : 'disabled'}>${icon('printer')} Imprimir ${elegidos.length || ''} ${elegidos.length === 1 ? 'etiqueta' : 'etiquetas'}</button>
            <button type="button" class="btn secondary" id="efMarcar" ${elegidos.length ? '' : 'disabled'}>Marcar como impresas</button>
            <button type="button" class="btn ghost" id="efDesmarcar" ${elegidos.length ? '' : 'disabled'}>Marcar como sin imprimir</button>
          </div>
          ${elegidos.length ? '<div><div class="small muted" style="margin-bottom:6px">Vista previa (primeras etiquetas):</div><div class="label-preview"><div class="label-sheet ' + ef.formato + '" id="efPrev"></div></div></div>' : ''}
        </section>`;
      bind(elegidos);
      if (elegidos.length) armarEtiquetas(main.querySelector('#efPrev'), elegidos.slice(0, ef.formato === 'f-24' ? 6 : 8));
    };

    const bind = (elegidos) => {
      main.querySelectorAll('[data-fil]').forEach((b) => b.addEventListener('click', () => { ef.filtro = b.dataset.fil; paint(); }));
      main.querySelector('#efCat').addEventListener('change', (e) => { ef.cat = e.target.value; paint(); });
      main.querySelector('#efAll').addEventListener('change', (e) => { visibles().forEach((p) => (e.target.checked ? ef.sel.add(p.id) : ef.sel.delete(p.id))); paint(); });
      main.querySelectorAll('.sel-item input').forEach((c) => c.addEventListener('change', () => { c.checked ? ef.sel.add(c.dataset.id) : ef.sel.delete(c.dataset.id); paint(); }));
      main.querySelectorAll('[data-fmt]').forEach((b) => b.addEventListener('click', () => { ef.formato = b.dataset.fmt; paint(); }));
      main.querySelector('#efPrecio').addEventListener('change', (e) => { ef.precio = e.target.checked; paint(); });
      main.querySelector('#efMarcar').addEventListener('click', () => marcar(elegidos, true));
      main.querySelector('#efDesmarcar').addEventListener('click', () => marcar(elegidos, false));
      main.querySelector('#efPrint').addEventListener('click', () => imprimir(elegidos));
    };

    async function marcar(lista, valor) {
      try { await API.setEtiquetaImpresa(lista.map((p) => p.id), valor); await APP.refreshCore(); toast(valor ? `${lista.length} marcadas como impresas` : `${lista.length} marcadas como sin imprimir`); ef.sel.clear(); paint(); } catch (e) { APP.handleErr(e); }
    }

    async function imprimir(lista) {
      let area = document.getElementById('printArea');
      if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
      area.innerHTML = `<div class="label-sheet ${ef.formato}" id="printSheet"></div>`;
      armarEtiquetas(area.firstChild, lista);
      await new Promise((r) => setTimeout(r, 350)); // los QR se dibujan en un instante
      const despues = () => {
        window.removeEventListener('afterprint', despues);
        setTimeout(() => {
          const m = openModal({
            title: '¿Se imprimieron bien?',
            body: `<p>Si las ${lista.length} etiquetas salieron bien, márcalas como impresas para que el panel te avise cuáles faltan. Si no, no pasa nada: puedes volver a imprimirlas.</p>`,
            footer: '<button type="button" class="btn secondary" data-no>No, todavía no</button><button type="button" class="btn green" data-ok>Sí, marcar impresas</button>'
          });
          m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
          m.foot.querySelector('[data-ok]').addEventListener('click', async () => { m.close(); await marcar(lista, true); });
        }, 300);
      };
      window.addEventListener('afterprint', despues);
      window.print();
    }

    function armarEtiquetas(el, lista) {
      const size = ef.formato === 'f-24' ? 200 : 160; // en píxeles, para que el QR salga nítido al imprimir
      el.innerHTML = '';
      lista.forEach((p) => {
        const d = document.createElement('div'); d.className = 'etiqueta';
        d.innerHTML = `<div class="qr"></div><div class="txt"><div class="e-nombre">${esc(p.nombre)}</div><div class="e-cod">${esc(p.codigo)}</div>${ef.precio ? `<div class="e-precio">${money(p.precio)}</div>` : ''}</div>`;
        el.appendChild(d);
        APP.makeQR(d.querySelector('.qr'), APP.qrLink(p.codigo), size);
      });
    }
    paint();
  };

  /* =====================================================================
     NOTIFICACIONES
     ===================================================================== */
  P.notificaciones = async function (main) {
    await APP.refreshCore();
    const st = await APP.pushEstado();
    const icono = { venta: 'bag', stock_bajo: 'alert', deuda_vencida: 'wallet' };
    const paint = () => {
      main.innerHTML = `
        <div class="page-head"><div><h1>Notificaciones</h1><p class="sub">Ventas de tu equipo, stock bajo y deudas vencidas.</p></div>
          ${APP.unread() ? '<button type="button" class="btn secondary sm" id="nAll">Marcar todo como leído</button>' : ''}</div>
        <section class="card flat stack-sm" style="margin-bottom:16px" id="nPush"></section>
        <div class="list">${APP.notifs.length ? APP.notifs.map((n) => `
          <button type="button" class="item ${n.leida ? '' : 'unread'}" data-id="${esc(n.id)}" data-tipo="${esc(n.tipo)}">
            <span class="thumb" style="background:var(--pink-100);color:var(--pink-700)">${icon(icono[n.tipo] || 'bell')}</span>
            <span class="grow"><div class="t1">${esc(n.titulo)}</div><div class="t2">${esc(n.mensaje || '')}</div></span>
            <span class="xs faint">${U.ago(n.created_at)}</span></button>`).join('') : '<div class="card empty">No hay avisos por ahora.</div>'}</div>`;
      pintarPush();
      const all = main.querySelector('#nAll');
      if (all) all.addEventListener('click', async () => { await API.marcarLeidas(); await APP.refreshCore(); paint(); });
      main.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', async () => {
        const n = APP.notifs.find((x) => x.id === b.dataset.id);
        if (n && !n.leida) { API.marcarLeidas([n.id]).catch(() => {}); n.leida = true; APP.paintBadges(); }
        APP.go(n.tipo === 'venta' ? 'ventas' : n.tipo === 'deuda_vencida' ? 'cobrar' : 'productos?f=stock');
      }));
    };
    function pintarPush() {
      const box = main.querySelector('#nPush');
      const msgs = {
        'no-soportado': 'Este navegador no permite avisos en el teléfono. En iPhone, primero instala la app: Compartir → Agregar a pantalla de inicio, y ábrela desde ahí.',
        'sin-llave': 'Los avisos al teléfono todavía no están configurados en el servidor (falta la llave VAPID). Mira SUPABASE_SETUP.md, paso 6.',
        'bloqueado': 'Bloqueaste los avisos para esta página. Actívalos en la configuración del navegador o de la app.'
      };
      if (!st.ok) { box.innerHTML = `<div class="row">${icon('bell')}<b>Avisos en el teléfono</b></div><p class="small muted">${msgs[st.motivo]}</p>`; return; }
      box.innerHTML = `<div class="row between wrap"><div><b>Avisos en el teléfono</b><p class="small muted">Te llegan aunque tengas la app cerrada.</p></div>
        ${st.activo ? `<span class="pill ok">Activados</span>` : ''}</div>
        <div class="row wrap">${st.activo ? '<button type="button" class="btn secondary sm" id="pTest">Probar aviso</button><button type="button" class="btn ghost sm" id="pOff">Desactivar en este teléfono</button>' : '<button type="button" class="btn sm" id="pOn">Activar avisos</button>'}</div>`;
      const on = box.querySelector('#pOn'), off = box.querySelector('#pOff'), test = box.querySelector('#pTest');
      if (on) on.addEventListener('click', async () => { try { await APP.pushActivar(); st.activo = true; toast('Avisos activados'); pintarPush(); } catch (e) { toast(e.message === 'PERMISO_DENEGADO' ? 'No diste permiso para los avisos.' : APP.errMsg(e), { error: true }); } });
      if (off) off.addEventListener('click', async () => { await APP.pushDesactivar(); st.activo = false; pintarPush(); toast('Avisos desactivados aquí'); });
      if (test) test.addEventListener('click', async () => { const reg = await navigator.serviceWorker.ready; reg.showNotification('Vedith Variedades', { body: 'Así te llegarán los avisos.', icon: 'icon-192.png', badge: 'icon-192.png' }); });
    }
    paint();
  };

  /* =====================================================================
     AJUSTES
     ===================================================================== */
  P.ajustes = async function (main) {
    const c = APP.config;
    main.innerHTML = `
      <div class="page-head"><div><h1>Ajustes</h1></div></div>
      <div class="stack">
        <section class="card stack"><h2>Negocio</h2>
          <label class="field">Nombre<input class="input" id="aNom" value="${esc(c.nombre_negocio || '')}" maxlength="60"></label>
          <label class="field">WhatsApp del negocio <span class="hint">Sale en la ficha pública para que el cliente te escriba. Ej.: 5555-1234</span><input class="input" id="aWa" type="tel" inputmode="tel" value="${esc(c.whatsapp || '')}"></label>
          <label class="field">Dirección de la app para los QR <span class="hint">Es la dirección web donde vive este panel (ej.: https://tuusuario.github.io/tupper-inventario/). Los QR impresos abren esta dirección: si la cambias después, hay que reimprimirlos.</span>
            <input class="input" id="aUrl" type="url" inputmode="url" value="${esc(c.url_base_qr || '')}" placeholder="${esc(new URL('./', location.href).href)}"></label>
          <div class="row wrap"><button type="button" class="btn secondary sm" id="aUsar">Usar la dirección actual</button><button type="button" class="btn" id="aGuardar">Guardar</button></div>
        </section>

        <section class="card stack"><h2>Cambiar PIN</h2>
          <p class="small muted">Cada PIN tiene 6 números. Uno para ti (administración) y otro para quien solo ve productos y vende. Deben ser distintos.</p>
          <div class="grid-2"><label class="field">¿De quién?<select class="input" id="pRol"><option value="visualizador">Visualizador</option><option value="administrador">Administración (el tuyo)</option></select></label>
          <label class="field">PIN nuevo<input class="input" id="pNuevo" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="••••••"></label></div>
          <div><button type="button" class="btn" id="pGuardar">Cambiar PIN</button></div>
        </section>

        <section class="card stack"><h2>Categorías</h2>
          <div class="chips" style="flex-wrap:wrap;overflow:visible" id="aCats"></div>
          <div class="row"><input class="input grow" id="aCatNew" placeholder="Nueva categoría" maxlength="40"><button type="button" class="btn secondary" id="aCatAdd">Agregar</button></div>
        </section>

        <section class="card stack"><h2>Datos</h2>
          <div class="row wrap"><button type="button" class="btn secondary" id="aExcel">${icon('download')} Descargar respaldo en Excel</button>
          <a class="btn secondary" href="#/notificaciones">${icon('bell')} Avisos en el teléfono</a>
          <button type="button" class="btn secondary" id="aAyuda">${icon('help')} Cómo usar el panel</button></div>
          ${API.mode === 'demo' ? '<button type="button" class="btn ghost" id="aReset">Reiniciar datos de la demo</button>' : ''}
        </section>
        <button type="button" class="btn secondary block" id="aSalir">${icon('logout')} Salir</button>
      </div>`;
    const g = (s) => main.querySelector(s);
    g('#aUsar').addEventListener('click', () => { g('#aUrl').value = new URL('./', location.href).href; });
    g('#aGuardar').addEventListener('click', async () => {
      let url = g('#aUrl').value.trim();
      if (url && !/^https?:\/\//i.test(url)) return toast('La dirección debe empezar con https://', { error: true });
      try { await API.setConfig({ nombre_negocio: g('#aNom').value.trim(), whatsapp: g('#aWa').value.trim(), url_base_qr: url }); await APP.refreshCore(); toast('Ajustes guardados'); } catch (e) { APP.handleErr(e); }
    });
    g('#pGuardar').addEventListener('click', async () => {
      const pin = g('#pNuevo').value.trim();
      if (!/^\d{6}$/.test(pin)) return toast('El PIN debe tener exactamente 6 números.', { error: true });
      if (!await confirmDialog({ title: 'Cambiar PIN', message: `¿Cambiar el PIN de ${g('#pRol').value === 'administrador' ? 'la administración' : 'el visualizador'}? El PIN anterior dejará de servir.`, okLabel: 'Cambiar' })) return;
      try { await API.cambiarPin(g('#pRol').value, pin); g('#pNuevo').value = ''; toast('PIN cambiado'); } catch (e) { APP.handleErr(e); }
    });
    const pintarCats = () => {
      g('#aCats').innerHTML = APP.categorias.map((cat) => `<span class="chip">${esc(cat.nombre)} <button type="button" class="icon-btn" style="width:28px;height:28px" data-del="${esc(cat.id)}" aria-label="Borrar ${esc(cat.nombre)}">${icon('x', 'sm')}</button></span>`).join('') || '<span class="muted small">Sin categorías</span>';
      g('#aCats').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!await confirmDialog({ title: 'Borrar categoría', message: 'Los productos de esta categoría quedan "sin categoría".', okLabel: 'Borrar', danger: true })) return;
        try { await API.deleteCategoria(b.dataset.del); await APP.refreshCore(); pintarCats(); } catch (e) { APP.handleErr(e); }
      }));
    };
    pintarCats();
    g('#aCatAdd').addEventListener('click', async () => {
      const v = g('#aCatNew').value.trim(); if (!v) return;
      try { await API.addCategoria(v); g('#aCatNew').value = ''; await APP.refreshCore(); pintarCats(); } catch (e) { APP.handleErr(/duplicate|unique/i.test(e.message) ? new Error('Esa categoría ya existe.') : e); }
    });
    g('#aExcel').addEventListener('click', APP.exportarExcel);
    g('#aAyuda').addEventListener('click', APP.openHelp);
    g('#aSalir').addEventListener('click', APP.logout);
    const rs = g('#aReset'); if (rs) rs.addEventListener('click', () => API.reiniciarDemo());
  };
})();
