/* Dulces (gelatinas y gomitas) · SECCIÓN PRIVADA, solo administración.
   Control personal: qué entregó, a quién, cuánto le han pagado, cuánto gastó y cuánto le sobra.
   Nada de esto aparece en el catálogo, el QR, las imágenes para estados ni para el visualizador:
   vive en tablas propias que solo la administración puede leer (ver migracion_dulces.sql).
   El comprobante para el cliente NO lleva gastos ni ganancias. */
(function () {
  'use strict';
  const { icon, esc, money, toast, openModal, confirmDialog, fmtDate } = U;
  const APP = window.APP;
  const P = APP.pages;
  const TIPO = { gelatina: 'Gelatina', gomita: 'Gomitas' };
  const METODO = { efectivo: 'Efectivo', transferencia: 'Transferencia', deposito: 'Depósito' };

  const S = { entregas: [], productos: [], vista: 'entregas', filtro: 'todas', q: '' };
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const r2 = (n) => Math.round(n * 100) / 100;
  const total = (e) => r2(sum(e.items, (i) => i.cantidad * Number(i.precio_unitario)));
  const pagado = (e) => r2(sum(e.pagos, (p) => Number(p.monto)));
  const gasto = (e) => r2(sum(e.gastos, (g) => Number(g.cantidad) * Number(g.costo_unitario)));
  const piezas = (e) => sum(e.items, (i) => i.cantidad);
  const saldo = (e) => r2(total(e) - pagado(e));
  const estado = (e) => (saldo(e) < -0.004 ? 'demas' : saldo(e) <= 0.004 ? 'pagada' : pagado(e) > 0 ? 'parcial' : 'pendiente');
  const nombreRecibo = () => APP.config.dulces_nombre || APP.config.nombre_negocio || 'Vedith Variedades';

  function pill(e) {
    const s = estado(e);
    return s === 'pagada' ? '<span class="pill ok">Pagada</span>' : s === 'demas' ? '<span class="pill warn">Pagó de más</span>' : s === 'parcial' ? '<span class="pill warn">Pago parcial</span>' : '<span class="pill bad">Sin pagar</span>';
  }
  function cuadre(e) {
    const t = total(e), p = pagado(e), s = saldo(e);
    if (estado(e) === 'pagada') return { clase: 'info', txt: `Cuadra: te pagaron ${money(p)} y eran ${money(t)}.` };
    if (estado(e) === 'demas') return { clase: '', txt: `Te pagaron ${money(-s)} de más (${money(p)} en vez de ${money(t)}). Revísalo.` };
    if (p > 0) return { clase: '', txt: `Te pagaron ${money(p)} de ${money(t)}. Te faltan ${money(s)}.` };
    return { clase: 'bad', txt: `Todavía no te pagan. Te deben ${money(t)}.` };
  }

  async function cargar() {
    const [entregas, productos] = await Promise.all([API.dulcesEntregas(), API.dulcesProductos()]);
    S.entregas = entregas; S.productos = productos;
  }
  const faltaMigracion = (e) => /PGRST205|schema cache|does not exist|42P01|42501/i.test((e.code || '') + ' ' + (e.message || ''));

  /* =====================================================================
     PANTALLA PRINCIPAL
     ===================================================================== */
  P.dulces = async function (main) {
    try { await cargar(); }
    catch (e) {
      if (faltaMigracion(e)) {
        main.innerHTML = `<div class="page-head"><div><h1>Dulces</h1></div></div>
          <div class="card stack center">${icon('alert', 'lg')}<h2>Falta un paso en Supabase</h2>
          <p class="muted">Para usar esta sección hay que crear sus tablas una sola vez. En Supabase abre <b>SQL Editor</b>, pega todo el archivo <b>migracion_dulces.sql</b> y toca <b>Run</b>. Luego vuelve aquí.</p>
          <button type="button" class="btn" onclick="location.reload()">Ya lo hice, volver a cargar</button></div>`;
        return;
      }
      throw e;
    }
    paint(main);
  };

  function paint(main) {
    const mes = APP.hoyStr().slice(0, 7);
    const delMes = S.entregas.filter((e) => e.fecha.startsWith(mes));
    const porCobrar = sum(S.entregas, (e) => Math.max(0, saldo(e)));
    const entMes = sum(delMes, total), gasMes = sum(delMes, gasto);
    main.innerHTML = `
      <div class="page-head"><div><h1>Dulces <span class="pill pink" style="vertical-align:middle">${icon('lock', 'sm')} Privado</span></h1>
        <p class="sub">Gelatinas y gomitas: lo que entregas, lo que te pagan y lo que gastas.</p></div>
        <div class="row wrap"><button type="button" class="btn secondary" id="dProd">Mis productos</button><button type="button" class="btn" id="dNueva">${icon('plus')} Entrega</button></div></div>
      <div class="banner info" style="margin-bottom:14px">${icon('lock')}<span class="small">Esta sección es solo tuya: no se ve en el catálogo, en el QR ni para quien solo vende.</span></div>
      <div class="kpis" style="margin-bottom:16px">
        <div class="kpi ${porCobrar > 0 ? 'orange' : 'green'}"><span class="k-l">Te deben</span><span class="k-v num">${money(porCobrar)}</span></div>
        <div class="kpi pink"><span class="k-l">Entregado este mes</span><span class="k-v num">${money(entMes)}</span><span class="small muted">${sum(delMes, piezas)} piezas</span></div>
        <div class="kpi"><span class="k-l">Gastos este mes</span><span class="k-v num">${money(gasMes)}</span></div>
        <div class="kpi ${entMes - gasMes >= 0 ? 'green' : 'orange'}"><span class="k-l">Te sobra este mes</span><span class="k-v num">${money(entMes - gasMes)}</span><span class="small muted">entregado − gastos</span></div>
      </div>
      ${panelCobrar()}
      <div class="seg" role="group" aria-label="Vista" style="margin-bottom:12px"><button type="button" data-v="entregas" aria-pressed="${S.vista === 'entregas'}">Entregas</button><button type="button" data-v="clientes" aria-pressed="${S.vista === 'clientes'}">Por cliente</button><button type="button" data-v="resumen" aria-pressed="${S.vista === 'resumen'}">Resumen</button></div>
      <div id="dCuerpo"></div>`;
    main.querySelector('#dNueva').addEventListener('click', () => formEntrega(main));
    main.querySelector('#dProd').addEventListener('click', () => productos(main));
    main.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { S.vista = b.dataset.v; paint(main); }));
    main.querySelectorAll('[data-cobro]').forEach((b) => b.addEventListener('click', () => { const e = S.entregas.find((x) => x.id === b.dataset.cobro); if (e) formPago(main, e); }));
    main.querySelectorAll('[data-recordar]').forEach((b) => b.addEventListener('click', () => { const e = S.entregas.find((x) => x.id === b.dataset.recordar); if (e) recordar(e); }));
    S.vista === 'entregas' ? listaEntregas(main) : S.vista === 'clientes' ? listaClientes(main) : resumen(main);
  }

  // Lo que más urge: las entregas con saldo, de la más antigua a la más nueva
  function panelCobrar() {
    const deben = S.entregas.filter((e) => saldo(e) > 0.004).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 3);
    if (!deben.length) return S.entregas.length ? `<div class="banner info" style="margin-bottom:14px">${icon('check')}<span class="small"><b>Todo cobrado.</b> Nadie te debe por ahora.</span></div>` : '';
    return `<section class="card stack-sm" style="margin-bottom:14px"><h2 class="small" style="font-weight:800">Para cobrar primero</h2>
      ${deben.map((e) => { const dias = Math.max(0, Math.floor((Date.now() - new Date(e.fecha + 'T12:00:00')) / 86400000)); return `<div class="row" style="gap:10px;align-items:center">
        <div class="grow" style="min-width:0"><div class="t1 ellipsis">${esc(e.cliente)}</div><div class="t2">debe <b>${money(saldo(e))}</b> · hace ${dias} ${dias === 1 ? 'día' : 'días'}</div></div>
        <button type="button" class="btn secondary sm" data-recordar="${esc(e.id)}" aria-label="Recordar a ${esc(e.cliente)}">${icon('chat', 'sm')}</button>
        <button type="button" class="btn green sm" data-cobro="${esc(e.id)}">Cobré</button></div>`; }).join('')}</section>`;
  }
  // Mensaje de WhatsApp para recordar un pago (sin número: se elige el contacto al abrir WhatsApp)
  function recordar(e) {
    const txt = `Hola ${e.cliente}, te recuerdo el pago de las ${e.items.map((i) => TIPO[i.tipo].toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).join(' y ')} que te entregué el ${fmtDate(e.fecha)}. ${pagado(e) > 0 ? `Llevas pagado ${money(pagado(e))} y faltan ${money(saldo(e))}.` : `Son ${money(saldo(e))}.`} ¡Gracias!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
  }

  // Resumen: qué se entrega más y cómo va cada mes
  function resumen(main) {
    const meses = {};
    S.entregas.forEach((e) => { const k = e.fecha.slice(0, 7); const m = meses[k] = meses[k] || { ent: 0, gas: 0, cob: 0, n: 0 }; m.ent += total(e); m.gas += gasto(e); m.cob += pagado(e); m.n += piezas(e); });
    const filasM = Object.entries(meses).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
    const prods = {};
    S.entregas.forEach((e) => e.items.forEach((i) => { const p = prods[i.nombre] = prods[i.nombre] || { tipo: i.tipo, n: 0, t: 0 }; p.n += i.cantidad; p.t += i.cantidad * Number(i.precio_unitario); }));
    const filasP = Object.entries(prods).sort((a, b) => b[1].n - a[1].n);
    const maxN = Math.max(1, ...filasP.map(([, p]) => p.n));
    const nombreMes = (k) => { const t = new Date(k + '-15T12:00:00').toLocaleDateString('es-GT', { month: 'long', year: 'numeric' }).replace(' de ', ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
    main.querySelector('#dCuerpo').innerHTML = S.entregas.length ? `
      <section class="stack-sm"><h2 class="small" style="font-weight:800">Lo que más entregas</h2>
        <div class="card stack-sm">${filasP.map(([n, p]) => `<div><div class="row between"><span class="t1">${esc(n)}</span><span class="small muted"><b class="num">${p.n}</b> piezas · ${money(p.t)}</span></div><div class="pano-bar" style="height:8px;margin-top:4px"><i class="${p.tipo === 'gelatina' ? 'ok' : 'warn'}" style="flex:${p.n}"></i><i style="flex:${maxN - p.n};background:transparent"></i></div></div>`).join('')}</div></section>
      <section class="stack-sm" style="margin-top:14px"><h2 class="small" style="font-weight:800">Mes por mes</h2>
        <div class="list">${filasM.map(([k, m]) => `<div class="item"><span class="grow"><div class="t1">${nombreMes(k)}</div><div class="t2">${m.n} piezas · entregado ${money(m.ent)} · cobrado ${money(m.cob)} · gastos ${money(m.gas)}</div></span>
          <span style="text-align:right"><div class="amt num" style="color:${m.ent - m.gas >= 0 ? 'var(--green-700)' : 'var(--red-600)'}">${money(m.ent - m.gas)}</div><div class="xs muted">te sobra</div></span></div>`).join('')}</div></section>`
      : '<div class="card empty">Aún no hay entregas para resumir.</div>';
  }

  function listaEntregas(main) {
    const cuerpo = main.querySelector('#dCuerpo');
    const norm = U.norm(S.q);
    const lista = S.entregas.filter((e) => (!norm || U.norm(e.cliente).includes(norm))
      && (S.filtro === 'todas' || (S.filtro === 'cobrar' && saldo(e) > 0.004) || (S.filtro === 'pagadas' && saldo(e) <= 0.004)));
    cuerpo.innerHTML = `
      <div class="toolbar"><div class="searchbox">${icon('search')}<input class="input" id="dQ" type="search" placeholder="Buscar por cliente…" autocomplete="off" value="${esc(S.q)}"></div>
        <div class="chips" role="group" aria-label="Filtro">${[['todas', 'Todas'], ['cobrar', 'Por cobrar'], ['pagadas', 'Pagadas']].map(([k, l]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${S.filtro === k}">${l}</button>`).join('')}</div></div>
      ${norm && lista.length && lista.every((x) => U.norm(x.cliente) === U.norm(lista[0].cliente)) ? `<button type="button" class="btn secondary sm" data-nuevacli style="margin-bottom:10px">${icon('plus', 'sm')} Nueva entrega para ${esc(lista[0].cliente)}</button>` : ''}
      ${lista.length ? `<div class="list">${lista.map((e) => `
        <button type="button" class="item" data-id="${esc(e.id)}"><span class="thumb" style="background:var(--pink-100);color:var(--pink-700)">${icon('receipt')}</span>
          <span class="grow"><div class="t1 ellipsis">${esc(e.cliente)}</div><div class="t2">${fmtDate(e.fecha)} · ${piezas(e)} ${piezas(e) === 1 ? 'pieza' : 'piezas'}</div><div style="margin-top:4px">${pill(e)}</div></span>
          <span style="text-align:right"><div class="amt num">${money(total(e))}</div>${saldo(e) > 0.004 ? `<div class="xs" style="color:var(--red-600);font-weight:800">debe ${money(saldo(e))}</div>` : ''}</span></button>`).join('')}</div>`
        : `<div class="card empty">${icon('receipt', 'lg')}<p>${S.entregas.length ? 'No hay entregas con ese filtro.' : 'Aún no registras entregas. Toca <b>+ Entrega</b> cuando entregues gelatinas o gomitas.'}</p></div>`}`;
    cuerpo.querySelector('#dQ').addEventListener('input', U.debounce((ev) => { S.q = ev.target.value; listaEntregas(main); const i = main.querySelector('#dQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 150));
    const nc = cuerpo.querySelector('[data-nuevacli]'); if (nc) nc.addEventListener('click', () => formEntrega(main, { ...lista[0], items: lista[0].items, gastos: [], nota: '' }, true));
    cuerpo.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { S.filtro = b.dataset.f; listaEntregas(main); }));
    cuerpo.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => detalle(main, b.dataset.id)));
  }

  function listaClientes(main) {
    const por = {};
    S.entregas.forEach((e) => { const k = e.cliente.trim().toLowerCase(); (por[k] = por[k] || { nombre: e.cliente.trim(), es: [] }).es.push(e); });
    const filas = Object.values(por).map((c) => ({ ...c, t: sum(c.es, total), p: sum(c.es, pagado) })).map((c) => ({ ...c, s: r2(c.t - c.p) })).sort((a, b) => b.s - a.s);
    main.querySelector('#dCuerpo').innerHTML = filas.length ? `
      <p class="small muted" style="margin-bottom:8px">Lo que cada cliente debería haberte pagado frente a lo que de verdad te ha pagado.</p>
      <div class="list">${filas.map((c) => `
        <button type="button" class="item" data-cli="${esc(c.nombre)}"><span class="grow"><div class="t1">${esc(c.nombre)}</div>
          <div class="t2">${c.es.length} ${c.es.length === 1 ? 'entrega' : 'entregas'} · entregado ${money(c.t)} · pagado ${money(c.p)}</div></span>
          <span style="text-align:right">${c.s > 0.004 ? `<div class="amt num" style="color:var(--red-600)">${money(c.s)}</div><div class="xs muted">te debe</div>` : c.s < -0.004 ? `<div class="amt num">${money(-c.s)}</div><div class="xs muted">de más</div>` : '<span class="pill ok">Al día</span>'}</span></button>`).join('')}</div>`
      : '<div class="card empty">Aún no hay entregas.</div>';
    main.querySelectorAll('[data-cli]').forEach((b) => b.addEventListener('click', () => { S.vista = 'entregas'; S.q = b.dataset.cli; S.filtro = 'todas'; paint(main); }));
  }

  /* =====================================================================
     DETALLE DE UNA ENTREGA: pagos, gastos, cuadre y comprobante
     ===================================================================== */
  function detalle(main, id) {
    const e = S.entregas.find((x) => x.id === id); if (!e) return;
    const cu = cuadre(e), g = gasto(e), t = total(e), n = piezas(e);
    const sobra = r2(t - g);
    const m = openModal({
      title: e.cliente, wide: true,
      body: `<div class="stack">
        <div class="row between wrap"><span class="muted">${fmtDate(e.fecha)} · ${n} ${n === 1 ? 'pieza' : 'piezas'}</span>${pill(e)}</div>
        <div class="banner ${cu.clase}">${icon(cu.clase === 'info' ? 'check' : 'alert')}<span class="small grow"><b>${esc(cu.txt)}</b></span>${saldo(e) > 0.004 ? `<button type="button" class="btn secondary sm" data-a="recordar">${icon('chat', 'sm')} Recordar</button>` : ''}</div>
        <section class="stack-sm"><h3>Lo que entregaste</h3>
          <div class="list">${e.items.map((i) => `<div class="item"><span class="grow"><div class="t1">${i.cantidad} × ${esc(i.nombre)}</div><div class="t2">${TIPO[i.tipo]} · ${money(i.precio_unitario)} c/u</div></span><span class="amt num">${money(i.cantidad * i.precio_unitario)}</span></div>`).join('')}
            <div class="item"><span class="grow t1">Total a cobrar</span><span class="amt num">${money(t)}</span></div></div></section>
        <section class="stack-sm"><div class="row between"><h3>Pagos recibidos</h3><button type="button" class="btn secondary sm" data-a="pago">${icon('plus', 'sm')} Registrar pago</button></div>
          ${e.pagos.length ? `<div class="list">${e.pagos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((p) => `<div class="item"><span class="grow"><div class="t1">${fmtDate(p.fecha)}</div><div class="t2">${METODO[p.metodo]}${p.nota ? ' · ' + esc(p.nota) : ''}</div></span><span class="amt num">${money(p.monto)}</span><button type="button" class="icon-btn" data-delpago="${esc(p.id)}" aria-label="Quitar pago">${icon('x')}</button></div>`).join('')}</div>` : '<p class="small muted">Aún no hay pagos.</p>'}</section>
        <section class="stack-sm"><h3>Tus gastos en esta entrega</h3>
          ${e.gastos.length ? `<div class="list">${e.gastos.map((x) => `<div class="item"><span class="grow"><div class="t1">${esc(x.concepto)}</div><div class="t2">${Number(x.cantidad)} × ${money(x.costo_unitario)}</div></span><span class="amt num">${money(x.cantidad * x.costo_unitario)}</span></div>`).join('')}</div>` : '<p class="small muted">No anotaste gastos. Toca Editar para agregarlos.</p>'}
          <dl class="kv card flat"><dt>Gastaste</dt><dd class="num">${money(g)}</dd><dt>Cobras</dt><dd class="num">${money(t)}</dd>
            <dt><b>Te sobra</b></dt><dd class="num" style="color:${sobra >= 0 ? 'var(--green-700)' : 'var(--red-600)'}"><b>${money(sobra)}</b></dd>
            ${n ? `<dt>Cada pieza te cuesta</dt><dd class="num">${money(g / n)}</dd><dt>Ganas por pieza</dt><dd class="num">${money(sobra / n)}</dd>` : ''}
            <dt>Ya recuperaste</dt><dd class="num">${money(pagado(e) - g)}</dd></dl>
          <p class="xs muted">«Ya recuperaste» es lo que te han pagado menos lo que gastaste. Esto es solo para ti: no sale en el comprobante.</p></section>
        ${e.nota ? `<p class="small muted">Nota: ${esc(e.nota)}</p>` : ''}</div>`,
      footer: `<button type="button" class="btn secondary" style="flex:0 0 auto" data-a="borrar" aria-label="Eliminar entrega">${icon('trash')}</button><button type="button" class="btn secondary" data-a="repetir" title="Nueva entrega con lo mismo">${icon('plus')} Repetir</button><button type="button" class="btn secondary" data-a="editar">${icon('edit')} Editar</button><button type="button" class="btn" data-a="recibo">${icon('receipt')} Comprobante</button>`
    });
    const on = (a, fn) => m.el.querySelectorAll(`[data-a="${a}"]`).forEach((b) => b.addEventListener('click', fn));
    on('editar', () => { m.close(); formEntrega(main, e); });
    on('repetir', () => { m.close(); formEntrega(main, e, true); });
    on('recordar', () => recordar(e));
    on('recibo', () => comprobante(e));
    on('pago', () => { m.close(); formPago(main, e); });
    on('borrar', async () => { if (!await confirmDialog({ title: 'Eliminar entrega', message: `Se borra la entrega de ${e.cliente} con sus pagos y gastos. No se puede deshacer.`, okLabel: 'Eliminar', danger: true })) return; try { await API.deleteDulceEntrega(e.id); m.close(); toast('Entrega eliminada'); await cargar(); paint(main); } catch (er) { APP.handleErr(er); } });
    m.body.querySelectorAll('[data-delpago]').forEach((b) => b.addEventListener('click', async () => { if (!await confirmDialog({ title: 'Quitar pago', message: '¿Quitar este pago de la entrega?', okLabel: 'Quitar', danger: true })) return; try { await API.deleteDulcePago(b.dataset.delpago); m.close(); await cargar(); paint(main); detalle(main, id); } catch (er) { APP.handleErr(er); } }));
  }

  function formPago(main, e) {
    const falta = Math.max(0, saldo(e));
    const m = openModal({
      title: 'Pago de ' + e.cliente,
      body: `<p class="muted">Total ${money(total(e))} · pagado ${money(pagado(e))} · falta <b>${money(falta)}</b></p>
        <label class="field">Monto que te pagaron *<input class="input" id="pgMonto" type="number" inputmode="decimal" min="0.01" step="0.01" value="${falta > 0 ? falta : ''}" autofocus></label>
        <div class="stack-sm"><span class="small" style="font-weight:800">¿Cómo te pagaron?</span><div class="seg" role="group" aria-label="Forma de pago">${Object.entries(METODO).map(([k, l]) => `<button type="button" data-m="${k}" aria-pressed="${k === 'efectivo'}">${l}</button>`).join('')}</div></div>
        <label class="field">Fecha<input class="input" id="pgFecha" type="date" value="${APP.hoyStr()}"></label>
        <label class="field">Nota <span class="hint">opcional</span><input class="input" id="pgNota" maxlength="80" placeholder="Ej.: pagó la mitad"></label>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn green" data-ok>Guardar pago</button>'
    });
    let metodo = 'efectivo';
    m.body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { metodo = b.dataset.m; m.body.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    m.foot.querySelector('[data-no]').addEventListener('click', () => { m.close(); detalle(main, e.id); });
    m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
      const monto = parseFloat(m.body.querySelector('#pgMonto').value);
      if (!(monto > 0)) return toast('Escribe cuánto te pagaron.', { error: true });
      if (monto > falta + 0.004 && !await confirmDialog({ title: 'Monto mayor', message: `Te faltaban ${money(falta)} y estás anotando ${money(monto)}. ¿Guardar igual?`, okLabel: 'Guardar igual' })) return;
      try { await API.addDulcePago(e.id, { fecha: m.body.querySelector('#pgFecha').value || APP.hoyStr(), monto, metodo, nota: m.body.querySelector('#pgNota').value }); m.close(); toast('Pago anotado'); await cargar(); paint(main); detalle(main, e.id); } catch (er) { APP.handleErr(er); }
    });
  }

  /* =====================================================================
     FORMULARIO DE ENTREGA (con gastos)
     ===================================================================== */
  function formEntrega(main, previa, copia) {
    const nueva = !previa || !!copia;
    const activos = () => S.productos.filter((p) => p.activo);
    const primero = (tipo) => activos().find((p) => p.tipo === tipo);
    const nuevaLinea = (tipo) => { const p = primero(tipo); return { tipo, producto_id: p ? p.id : '', nombre: p ? p.nombre : '', cantidad: 1, precio_unitario: p ? Number(p.precio_default) : 0 }; };
    const e = previa ? { ...previa, ...(copia ? { id: undefined, fecha: APP.hoyStr(), nota: '' } : {}), items: previa.items.map((i) => ({ ...i })), gastos: previa.gastos.map((x) => ({ ...x })) } : { fecha: APP.hoyStr(), cliente: '', nota: '', items: [nuevaLinea('gelatina')], gastos: [] };
    const clientes = [...new Set(S.entregas.map((x) => x.cliente.trim()))].sort();
    const conceptos = [...new Set(S.entregas.flatMap((x) => x.gastos.map((g) => g.concepto.trim())))].sort();
    let pagoMetodo = 'efectivo';

    const m = openModal({
      title: copia ? 'Repetir entrega' : nueva ? 'Entrega nueva' : 'Editar entrega', wide: true,
      body: `<div class="stack">
        <div class="grid-2"><label class="field">Cliente *<input class="input" id="enCli" list="enCliList" value="${esc(e.cliente)}" maxlength="80" placeholder="¿A quién se la entregaste?" autocomplete="off" autofocus></label>
          <label class="field">Fecha de entrega<input class="input" id="enFecha" type="date" value="${esc(e.fecha)}"></label></div>
        <datalist id="enCliList">${clientes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <section class="stack-sm"><h3>Lo que entregaste</h3><div id="enItems" class="stack-sm"></div>
          <div class="row wrap"><button type="button" class="btn secondary sm" data-add="gelatina">${icon('plus', 'sm')} Gelatinas</button><button type="button" class="btn secondary sm" data-add="gomita">${icon('plus', 'sm')} Gomitas</button></div></section>
        <section class="stack-sm"><h3>Lo que gastaste <span class="small muted" style="font-weight:600">(para saber cuánto te sobra)</span></h3>
          <p class="small muted">Ejemplo: 6 bolsas de gelatina a Q9 y 2 cajas de leche condensada a Q18.</p>
          <div id="enGastos" class="stack-sm"></div>
          <datalist id="enConList">${conceptos.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
          <button type="button" class="btn secondary sm" data-addg style="justify-self:start">${icon('plus', 'sm')} Agregar gasto</button></section>
        <div class="card flat stack-sm" id="enResumen" aria-live="polite"></div>
        ${nueva ? `<section class="stack-sm"><h3>¿Ya te pagaron?</h3><div class="grid-2"><label class="field">Monto recibido <span class="hint">déjalo vacío si aún no</span><input class="input" id="enPago" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></label>
          <div class="stack-sm"><span class="small" style="font-weight:800">Forma de pago</span><div class="seg" role="group" aria-label="Forma de pago">${Object.entries(METODO).map(([k, l]) => `<button type="button" data-m="${k}" aria-pressed="${k === 'efectivo'}">${l}</button>`).join('')}</div></div></div></section>` : ''}
        <label class="field">Nota <span class="hint">opcional</span><input class="input" id="enNota" maxlength="200" value="${esc(e.nota || '')}"></label></div>`,
      footer: '<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn" data-ok>Guardar entrega</button>'
    });
    const g = (s) => m.body.querySelector(s);

    function resumen() {
      const t = r2(sum(e.items, (i) => (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0)));
      const gs = r2(sum(e.gastos, (x) => (Number(x.cantidad) || 0) * (Number(x.costo_unitario) || 0)));
      const n = sum(e.items, (i) => Number(i.cantidad) || 0), sobra = r2(t - gs);
      g('#enResumen').innerHTML = `<dl class="kv"><dt>Total a cobrar (${n} ${n === 1 ? 'pieza' : 'piezas'})</dt><dd class="num">${money(t)}</dd><dt>Gastaste</dt><dd class="num">${money(gs)}</dd>
        <dt><b>Te sobra</b></dt><dd class="num" style="color:${sobra >= 0 ? 'var(--green-700)' : 'var(--red-600)'}"><b>${money(sobra)}</b></dd>
        ${n && gs ? `<dt>Cada pieza te cuesta</dt><dd class="num">${money(gs / n)}</dd>` : ''}</dl>`;
      const p = g('#enPago'); if (p && !p.dataset.tocado) p.placeholder = t ? String(t) : '0.00';
    }
    function pintarItems() {
      g('#enItems').innerHTML = e.items.map((it, i) => {
        const ps = activos().filter((p) => p.tipo === it.tipo);
        const otro = !it.producto_id;
        return `<div class="cart-line dul-linea" data-i="${i}">
          <div class="grow"><div class="seg" role="group" aria-label="Tipo">${Object.entries(TIPO).map(([k, l]) => `<button type="button" data-tipo="${k}" aria-pressed="${it.tipo === k}">${l}</button>`).join('')}</div></div>
          <button type="button" class="icon-btn" data-del aria-label="Quitar">${icon('x')}</button>
          <div style="grid-column:1/-1" class="stack-sm"><select class="input" data-prod aria-label="Producto">${ps.map((p) => `<option value="${esc(p.id)}" ${p.id === it.producto_id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}<option value="" ${otro ? 'selected' : ''}>Otro…</option></select>
            ${otro ? `<input class="input" data-nombre placeholder="Nombre (ej.: Gelatina de mango)" value="${esc(it.nombre)}" maxlength="60">` : ''}</div>
          <label class="field"><span class="xs muted">Cantidad</span><input class="input" data-cant type="number" inputmode="numeric" min="1" value="${esc(it.cantidad)}"></label>
          <label class="field"><span class="xs muted">Precio c/u (Q)</span><input class="input" data-precio type="number" inputmode="decimal" min="0" step="0.01" value="${esc(it.precio_unitario)}"></label>
          <div class="amt num" style="grid-column:1/-1;text-align:right" data-sub>${money((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0))}</div></div>`;
      }).join('') || '<p class="small muted">Agrega gelatinas o gomitas.</p>';
      g('#enItems').querySelectorAll('.dul-linea').forEach((row) => {
        const it = e.items[Number(row.dataset.i)];
        const sub = () => { row.querySelector('[data-sub]').textContent = money((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0)); resumen(); };
        row.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { if (it.tipo === b.dataset.tipo) return; Object.assign(it, nuevaLinea(b.dataset.tipo), { cantidad: it.cantidad }); pintarItems(); resumen(); }));
        row.querySelector('[data-del]').addEventListener('click', () => { e.items.splice(Number(row.dataset.i), 1); pintarItems(); resumen(); });
        row.querySelector('[data-prod]').addEventListener('change', (ev) => { const p = S.productos.find((x) => x.id === ev.target.value); if (p) { it.producto_id = p.id; it.nombre = p.nombre; it.precio_unitario = Number(p.precio_default); } else { it.producto_id = ''; it.nombre = ''; } pintarItems(); resumen(); });
        const nm = row.querySelector('[data-nombre]'); if (nm) nm.addEventListener('input', () => { it.nombre = nm.value; });
        row.querySelector('[data-cant]').addEventListener('input', (ev) => { it.cantidad = ev.target.value; sub(); });
        row.querySelector('[data-precio]').addEventListener('input', (ev) => { it.precio_unitario = ev.target.value; sub(); });
      });
    }
    function pintarGastos() {
      g('#enGastos').innerHTML = e.gastos.map((x, i) => `<div class="cart-line dul-linea" data-i="${i}">
          <label class="field grow"><span class="xs muted">¿Qué compraste?</span><input class="input" data-con list="enConList" value="${esc(x.concepto)}" maxlength="60" placeholder="Ej.: bolsas de gelatina" autocomplete="off"></label>
          <button type="button" class="icon-btn" data-del aria-label="Quitar">${icon('x')}</button>
          <label class="field"><span class="xs muted">Cantidad</span><input class="input" data-cant type="number" inputmode="decimal" min="0" step="0.01" value="${esc(x.cantidad)}"></label>
          <label class="field"><span class="xs muted">Costo c/u (Q)</span><input class="input" data-costo type="number" inputmode="decimal" min="0" step="0.01" value="${esc(x.costo_unitario)}"></label>
          <div class="amt num" style="grid-column:1/-1;text-align:right" data-sub>${money((Number(x.cantidad) || 0) * (Number(x.costo_unitario) || 0))}</div></div>`).join('');
      g('#enGastos').querySelectorAll('.dul-linea').forEach((row) => {
        const x = e.gastos[Number(row.dataset.i)];
        const sub = () => { row.querySelector('[data-sub]').textContent = money((Number(x.cantidad) || 0) * (Number(x.costo_unitario) || 0)); resumen(); };
        row.querySelector('[data-del]').addEventListener('click', () => { e.gastos.splice(Number(row.dataset.i), 1); pintarGastos(); resumen(); });
        row.querySelector('[data-con]').addEventListener('input', (ev) => { x.concepto = ev.target.value; });
        row.querySelector('[data-cant]').addEventListener('input', (ev) => { x.cantidad = ev.target.value; sub(); });
        row.querySelector('[data-costo]').addEventListener('input', (ev) => { x.costo_unitario = ev.target.value; sub(); });
      });
    }
    m.body.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { e.items.push(nuevaLinea(b.dataset.add)); pintarItems(); resumen(); }));
    g('[data-addg]').addEventListener('click', () => { e.gastos.push({ concepto: '', cantidad: 1, costo_unitario: '' }); pintarGastos(); resumen(); const ins = g('#enGastos').querySelectorAll('[data-con]'); ins[ins.length - 1].focus(); });
    m.body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { pagoMetodo = b.dataset.m; m.body.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    const pg = g('#enPago'); if (pg) pg.addEventListener('input', () => { pg.dataset.tocado = '1'; });
    pintarItems(); pintarGastos(); resumen();

    m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.foot.querySelector('[data-ok]').addEventListener('click', async () => {
      e.cliente = g('#enCli').value.trim(); e.fecha = g('#enFecha').value || APP.hoyStr(); e.nota = g('#enNota').value;
      if (!e.cliente) { g('#enCli').classList.add('bad'); g('#enCli').focus(); return toast('Escribe el nombre del cliente.', { error: true }); }
      const items = e.items.map((i) => ({ ...i, cantidad: parseInt(i.cantidad, 10), precio_unitario: Number(i.precio_unitario), nombre: (i.nombre || '').trim() }));
      if (!items.length || items.some((i) => !(i.cantidad >= 1) || !i.nombre || isNaN(i.precio_unitario) || i.precio_unitario < 0)) return toast('Revisa lo entregado: cada línea necesita producto, cantidad y precio.', { error: true });
      const gastos = e.gastos.filter((x) => (x.concepto || '').trim() || Number(x.costo_unitario));
      if (gastos.some((x) => !(x.concepto || '').trim() || !(Number(x.cantidad) > 0) || isNaN(Number(x.costo_unitario)) || x.costo_unitario === '')) return toast('Revisa los gastos: cada uno necesita descripción, cantidad y costo.', { error: true });
      const btn = m.foot.querySelector('[data-ok]'); btn.disabled = true;
      try {
        const id = await API.saveDulceEntrega({ id: e.id, fecha: e.fecha, cliente: e.cliente, nota: e.nota, items, gastos });
        const monto = pg ? parseFloat(pg.value) : 0;
        if (monto > 0) await API.addDulcePago(id, { fecha: e.fecha, monto, metodo: pagoMetodo });
        m.close(); toast(nueva ? 'Entrega guardada' : 'Cambios guardados'); await cargar(); paint(main); detalle(main, id);
      } catch (er) { btn.disabled = false; APP.handleErr(er); }
    });
  }

  /* =====================================================================
     MIS PRODUCTOS (lista de gelatinas y gomitas con su precio)
     ===================================================================== */
  function productos(main) {
    const m = openModal({ title: 'Mis productos', body: '<div id="pdBody" class="stack"></div>', footer: '<button type="button" class="btn secondary" data-cerrar>Cerrar</button><button type="button" class="btn" data-nuevo>+ Producto</button>' });
    const pintar = () => {
      m.body.querySelector('#pdBody').innerHTML = `<p class="small muted">Ponles el precio por pieza; al hacer una entrega se llena solo y lo puedes cambiar.</p>
        <div class="list">${S.productos.length ? S.productos.map((p) => `<button type="button" class="item" data-id="${esc(p.id)}"><span class="grow"><div class="t1">${esc(p.nombre)}</div><div class="t2">${TIPO[p.tipo]}${p.activo ? '' : ' · oculto'}</div></span><span class="amt num">${money(p.precio_default)}</span></button>`).join('') : '<div class="item">Aún no hay productos.</div>'}</div>`;
      m.body.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => editar(S.productos.find((x) => x.id === b.dataset.id))));
    };
    function editar(p) {
      const nuevo = !p; p = p || { nombre: '', tipo: 'gelatina', precio_default: '', activo: true };
      let tipo = p.tipo;
      const e = openModal({
        title: nuevo ? 'Producto nuevo' : 'Editar producto',
        body: `<label class="field">Nombre *<input class="input" id="pdN" value="${esc(p.nombre)}" maxlength="60" placeholder="Ej.: Gelatina de mango" autofocus></label>
          <div class="stack-sm"><span class="small" style="font-weight:800">Tipo</span><div class="seg" role="group" aria-label="Tipo">${Object.entries(TIPO).map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${tipo === k}">${l}</button>`).join('')}</div></div>
          <label class="field">Precio por pieza (Q)<input class="input" id="pdP" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(p.precio_default)}"></label>
          <label class="row"><input type="checkbox" id="pdA" ${p.activo ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--pink-600)"> <span>Mostrar al hacer entregas</span></label>`,
        footer: `${nuevo ? '' : `<button type="button" class="btn secondary" style="flex:0 0 auto" data-del aria-label="Eliminar">${icon('trash')}</button>`}<button type="button" class="btn" data-ok>Guardar</button>`
      });
      e.body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { tipo = b.dataset.t; e.body.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
      const del = e.foot.querySelector('[data-del]');
      if (del) del.addEventListener('click', async () => { if (!await confirmDialog({ title: 'Eliminar producto', message: 'Las entregas anteriores se quedan igual. ¿Eliminar de la lista?', okLabel: 'Eliminar', danger: true })) return; try { await API.deleteDulceProducto(p.id); e.close(); await cargar(); pintar(); } catch (er) { APP.handleErr(er); } });
      e.foot.querySelector('[data-ok]').addEventListener('click', async () => {
        const nombre = e.body.querySelector('#pdN').value.trim(); if (!nombre) return toast('Falta el nombre.', { error: true });
        try { await API.saveDulceProducto({ id: p.id, nombre, tipo, precio_default: e.body.querySelector('#pdP').value, activo: e.body.querySelector('#pdA').checked }); e.close(); await cargar(); pintar(); } catch (er) { APP.handleErr(er); }
      });
    }
    m.foot.querySelector('[data-cerrar]').addEventListener('click', () => m.close());
    m.foot.querySelector('[data-nuevo]').addEventListener('click', () => editar(null));
    pintar();
  }

  /* =====================================================================
     COMPROBANTE PARA EL CLIENTE (imagen) · sin gastos ni ganancias
     ===================================================================== */
  const W = 1080;
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function recortar(ctx, texto, ancho) { let t = String(texto); if (ctx.measureText(t).width <= ancho) return t; while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1); return t.trimEnd() + '…'; }

  async function dibujarRecibo(e) {
    try { await Promise.all([document.fonts.load('600 60px Fraunces'), document.fonts.load('800 40px "Nunito Sans"'), document.fonts.load('600 40px "Nunito Sans"')]); } catch (_) {}
    const lineas = e.items, pagos = e.pagos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    const H = 520 + lineas.length * 96 + 250 + (pagos.length ? 90 + pagos.length * 70 : 0) + (e.nota ? 120 : 0) + 260;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    // cabecera
    const g = c.createLinearGradient(0, 0, W, 260); g.addColorStop(0, '#0E7C7B'); g.addColorStop(1, '#0A5F5E');
    c.fillStyle = g; c.fillRect(0, 0, W, 260);
    c.fillStyle = 'rgba(242,107,91,.9)'; c.beginPath(); c.arc(W - 90, 40, 150, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `600 66px ${"'Fraunces', Georgia, serif"}`;
    c.fillText(recortar(c, nombreRecibo(), W - 160), 70, 125);
    c.font = `700 40px 'Nunito Sans', system-ui, sans-serif`; c.globalAlpha = .92; c.fillText('Comprobante de entrega', 70, 190); c.globalAlpha = 1;
    // datos
    c.fillStyle = '#16302F'; c.font = `800 46px 'Nunito Sans', system-ui, sans-serif`; c.fillText(recortar(c, e.cliente, W - 140), 70, 350);
    c.fillStyle = '#48605F'; c.font = `600 36px 'Nunito Sans', system-ui, sans-serif`;
    c.fillText(`${fmtDate(e.fecha)}  ·  No. ${String(e.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`, 70, 405);
    // tabla
    let y = 470;
    c.fillStyle = '#EEF6F5'; rr(c, 50, y, W - 100, 70, 16); c.fill();
    c.fillStyle = '#48605F'; c.font = `800 30px 'Nunito Sans', system-ui, sans-serif`;
    c.textAlign = 'left'; c.fillText('CANT.', 76, y + 46); c.fillText('DETALLE', 200, y + 46);
    c.textAlign = 'right'; c.fillText('PRECIO', 790, y + 46); c.fillText('SUBTOTAL', W - 76, y + 46);
    y += 70;
    lineas.forEach((i) => {
      y += 96; c.fillStyle = '#16302F'; c.font = `700 38px 'Nunito Sans', system-ui, sans-serif`;
      c.textAlign = 'left'; c.fillText(String(i.cantidad), 84, y - 30);
      c.fillText(recortar(c, i.nombre, 420), 200, y - 30);
      c.textAlign = 'right'; c.fillText(money(i.precio_unitario), 790, y - 30); c.font = `800 38px 'Nunito Sans', system-ui, sans-serif`; c.fillText(money(i.cantidad * i.precio_unitario), W - 76, y - 30);
      c.strokeStyle = '#DCE9E7'; c.lineWidth = 2; c.beginPath(); c.moveTo(70, y + 16); c.lineTo(W - 70, y + 16); c.stroke();
    });
    // total
    y += 110; c.fillStyle = '#16302F'; c.textAlign = 'left'; c.font = `800 46px 'Nunito Sans', system-ui, sans-serif`; c.fillText('TOTAL', 76, y);
    c.textAlign = 'right'; c.font = `600 70px ${"'Fraunces', Georgia, serif"}`; c.fillText(money(total(e)), W - 76, y + 4);
    // pagos
    if (pagos.length) {
      y += 90; c.textAlign = 'left'; c.fillStyle = '#48605F'; c.font = `800 32px 'Nunito Sans', system-ui, sans-serif`; c.fillText('PAGOS RECIBIDOS', 76, y);
      pagos.forEach((p) => { y += 70; c.fillStyle = '#16302F'; c.font = `600 36px 'Nunito Sans', system-ui, sans-serif`; c.textAlign = 'left'; c.fillText(`${fmtDate(p.fecha)} · ${METODO[p.metodo]}`, 76, y); c.textAlign = 'right'; c.fillText(money(p.monto), W - 76, y); });
    }
    // estado
    y += 120; const s = saldo(e);
    if (s <= 0.004) { c.fillStyle = '#E1F3E6'; rr(c, 70, y - 70, W - 140, 130, 30); c.fill(); c.fillStyle = '#1F5E33'; c.textAlign = 'center'; c.font = `800 62px 'Nunito Sans', system-ui, sans-serif`; c.fillText('PAGADO ✓', W / 2, y + 12); }
    else { c.fillStyle = '#FDE6E2'; rr(c, 70, y - 70, W - 140, 130, 30); c.fill(); c.fillStyle = '#B03F2E'; c.textAlign = 'center'; c.font = `700 40px 'Nunito Sans', system-ui, sans-serif`; c.fillText('Saldo pendiente', W / 2, y - 12); c.font = `800 62px 'Nunito Sans', system-ui, sans-serif`; c.fillText(money(s), W / 2, y + 40); }
    if (e.nota) { y += 120; c.fillStyle = '#48605F'; c.textAlign = 'center'; c.font = `600 34px 'Nunito Sans', system-ui, sans-serif`; c.fillText(recortar(c, e.nota, W - 140), W / 2, y); }
    y += 120; c.fillStyle = '#0E7C7B'; c.textAlign = 'center'; c.font = `600 48px ${"'Fraunces', Georgia, serif"}`; c.fillText('¡Gracias por tu compra!', W / 2, y);
    const alto = Math.min(H, y + 90);
    if (alto < H) { const out = document.createElement('canvas'); out.width = W; out.height = alto; out.getContext('2d').drawImage(cv, 0, 0); return out; }
    return cv;
  }

  async function comprobante(e) {
    const cv = await dibujarRecibo(e);
    const url = cv.toDataURL('image/png');
    const nombre = `comprobante-${e.cliente.replace(/[^\w]+/g, '-').toLowerCase()}-${e.fecha}.png`;
    const m = openModal({
      title: 'Comprobante', wide: true,
      body: `<div class="center"><img src="${url}" alt="Comprobante de entrega" style="max-height:62dvh;max-width:100%;margin:0 auto;border-radius:14px;box-shadow:var(--shadow-2)"></div><p class="xs muted center">Es la imagen que le mandas al cliente. No lleva tus gastos ni tus ganancias.</p>`,
      footer: `<button type="button" class="btn secondary" data-a="imprimir">${icon('printer')} Imprimir</button><button type="button" class="btn secondary" data-a="bajar">${icon('download')} Descargar</button><button type="button" class="btn" data-a="enviar">${icon('chat')} Compartir</button>`
    });
    const blob = () => new Promise((res) => cv.toBlob(res, 'image/png'));
    m.foot.querySelector('[data-a="bajar"]').addEventListener('click', async () => { U.download(nombre, await blob()); toast('Imagen descargada'); });
    m.foot.querySelector('[data-a="enviar"]').addEventListener('click', async () => {
      try {
        const b = await blob(), file = new File([b], nombre, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { U.download(nombre, b); toast('Tu navegador no comparte directo: la imagen se descargó. Súbela desde la galería.', { ms: 5000 }); }
      } catch (er) { if (er && er.name !== 'AbortError') toast('No se pudo compartir la imagen.', { error: true }); }
    });
    m.foot.querySelector('[data-a="imprimir"]').addEventListener('click', () => {
      let area = document.getElementById('printArea');
      if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
      area.innerHTML = `<div class="recibo-print"><img src="${url}" alt="Comprobante"></div>`;
      const limpiar = () => { window.removeEventListener('afterprint', limpiar); area.innerHTML = ''; };
      window.addEventListener('afterprint', limpiar);
      const im = area.querySelector('img'); (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => window.print());
    });
  }

  /* Total pendiente (para el aviso en Inicio) */
  APP.dulcesPorCobrar = (entregas) => sum(entregas.map((x) => ({ ...x, items: x.items || [], pagos: x.pagos || [] })), (e) => Math.max(0, saldo(e)));
})();
