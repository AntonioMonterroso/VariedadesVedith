/* Modo DEMO: la misma interfaz que api-supabase.js pero con datos de ejemplo guardados
   en este navegador (localStorage). PIN admin: 111111 · PIN visualizador: 222222.
   Sirve para enseñar el panel sin tocar la base real. */
(function () {
  'use strict';
  const KEY = 'vedith-demo-v4';
  const PIN = { administrador: '111111', visualizador: '222222' };
  const ymdHoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
  const now = () => new Date().toISOString();

  const svg = (bg, fg, shape) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/>${shape(fg)}</svg>`);
  const bowl = (fg) => `<path d="M30 90h140c0 45-30 75-70 75s-70-30-70-75z" fill="${fg}"/><rect x="24" y="78" width="152" height="16" rx="8" fill="${fg}" opacity=".75"/>`;
  const bottle = (fg) => `<rect x="82" y="26" width="36" height="22" rx="6" fill="${fg}" opacity=".75"/><rect x="62" y="46" width="76" height="130" rx="22" fill="${fg}"/>`;
  const box = (fg) => `<rect x="36" y="70" width="128" height="86" rx="14" fill="${fg}"/><rect x="30" y="58" width="140" height="20" rx="8" fill="${fg}" opacity=".75"/>`;
  const jug = (fg) => `<path d="M64 40h72l10 120a12 12 0 0 1-12 12H66a12 12 0 0 1-12-12z" fill="${fg}"/><path d="M146 66c26 0 26 44 0 44" fill="none" stroke="${fg}" stroke-width="12"/>`;

  function seed() {
    const cats = ['Recipientes y contenedores', 'Botellas y jarras', 'Cocina y utensilios', 'Repostería', 'Niños', 'Otros']
      .map((nombre, i) => ({ id: 'c' + (i + 1), nombre, orden: i + 1 }));
    const P = (n, cat, nom, desc, precio, costo, cant, min, tupper, foto) => ({
      id: 'p' + n, codigo: 'VED-' + String(n).padStart(4, '0'), codigo_tupperware: tupper, nombre: nom,
      categoria_id: 'c' + cat, descripcion: desc, precio, costo, cantidad: cant, stock_minimo: min, activo: true,
      etiqueta_impresa_at: n <= 4 ? now() : null, fotos: foto ? [foto] : [], created_at: now(),
      precio_regateo: [1, 3, 4, 9, 10].includes(n) ? Math.round(precio * 0.9) : null
    });
    const productos = [
      P(1, 1, 'Set Cristalwave 4 piezas', 'Recipientes herméticos aptos para microondas y congelador.', 285, 190, 8, 2, 'C41', svg('#DDF1E5', '#168552', box)),
      P(2, 2, 'Botella EcoTwist 750 ml', 'Botella sin BPA con tapa de rosca. Ideal para la escuela.', 95, 58, 14, 4, 'B12', svg('#FCE3E8', '#EC6478', bottle)),
      P(3, 2, 'Jarra Tupperware 2 litros', 'Jarra con tapa sellada, no gotea.', 165, 110, 3, 3, 'J22', svg('#FBEBD0', '#E3942B', jug)),
      P(4, 1, 'Ensaladera Fresh 3 L', 'Ensaladera grande con tapa; mantiene todo crujiente.', 210, 140, 5, 2, 'E30', svg('#DDF1E5', '#168552', bowl)),
      P(5, 3, 'Exprimidor de cítricos', 'Exprimidor manual con colador incluido.', 75, 42, 9, 3, 'X05', svg('#FBEBD0', '#E3942B', bowl)),
      P(6, 4, 'Molde para hielo (2 piezas)', 'Bandejas flexibles fáciles de desmoldar.', 55, 30, 0, 3, 'H09', svg('#FCE3E8', '#EC6478', box)),
      P(7, 5, 'Vaso entrenador 200 ml', 'Vaso con asas y tapa antiderrame para peques.', 68, 38, 11, 3, 'V77', svg('#FCE3E8', '#EC6478', bottle)),
      P(8, 1, 'Lonchera Cubix', 'Compartimentos separados, cierra hermético.', 120, 76, 7, 2, 'L18', svg('#DDF1E5', '#168552', box)),
      P(9, 3, 'Juego de cuchillos Chef', 'Tres cuchillos con funda protectora.', 240, 165, 2, 2, 'K03', svg('#FBEBD0', '#E3942B', jug)),
      P(10, 4, 'Bowl mezclador 1.5 L', 'Con pico vertedor y base antideslizante.', 130, 82, 6, 2, 'M15', svg('#DDF1E5', '#168552', bowl)),
      P(11, 6, 'Organizador de refri', 'Apilable, con asa. Para verduras y frutas.', 98, 60, 10, 3, 'O11', svg('#FCE3E8', '#EC6478', box)),
      P(12, 2, 'Botella Aqua 1 L', 'Botella deportiva con boquilla.', 105, 66, 12, 4, 'B21', svg('#FBEBD0', '#E3942B', bottle))
    ];
    return {
      categorias: cats, productos, clientes: [{ id: 'k1', nombre: 'Doña Marta', telefono: '5555-1234' }],
      ventas: [], abonos: [], gastos: [], notificaciones: [],
      cuentas: [{ id: 'cu1', nombre: 'Efectivo', tipo: 'efectivo', activa: true, orden: 0 }, { id: 'cu2', nombre: 'Banco Industrial', tipo: 'banco', activa: true, orden: 1 }],
      movimientos: [], cajas: [{ id: 'cj1', nombre: 'Caja 14 · Campaña 9', numero_pedido: 'TW-88231', fecha_pedido: ymdHoy(), fecha_llegada: null, estado: 'pedida', recibida_at: null, monto_total: 1150, pagada: false, pagada_el: null, metodo_pago: null, cuenta_id: null, nota_pago: null, notas: '', created_at: now(), items: [{ id: 'ci1', producto_id: 'p1', producto_nombre: 'Set Cristalwave 4 piezas', cantidad: 4, costo_unitario: 190 }, { id: 'ci2', producto_id: 'p6', producto_nombre: 'Molde para hielo (2 piezas)', cantidad: 6, costo_unitario: 30 }, { id: 'ci3', producto_id: 'p3', producto_nombre: 'Jarra Tupperware 2 litros', cantidad: 2, costo_unitario: 110 }] }],
      config: { nombre_negocio: 'Vedith Variedades', whatsapp: '', url_base_qr: '' }, seq: 12
    };
  }

  let db;
  const load = () => { try { db = JSON.parse(localStorage.getItem(KEY)); } catch (_) {} if (!db) db = seed(); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} };
  load();

  const CAT = { lista: [], pags: {}, archivados: [], zonas: [] };
  let session = null;
  const rolActual = () => (session ? session.rol : null);
  const admin = () => { if (rolActual() !== 'administrador') throw new Error('NO_AUTORIZADO'); };
  const delay = (v) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v ?? null))), 60));
  const catName = (id) => (db.categorias.find((c) => c.id === id) || {}).nombre || '';

  window.API = {
    mode: 'demo',

    async init() { const s = U.lsGet('vedith-demo-sesion', null); if (s) session = s; return delay(session); },
    async login(pin) {
      const rol = Object.keys(PIN).find((r) => PIN[r] === pin);
      if (!rol) throw new Error('PIN_INCORRECTO');
      session = { id: rol, email: rol + '@demo', rol, nombre: rol === 'administrador' ? 'Administración' : 'Visualizador' };
      U.lsSet('vedith-demo-sesion', session);
      return delay(session);
    },
    async logout() { session = null; U.lsSet('vedith-demo-sesion', null); },
    session: () => session,

    async categorias() { return delay(db.categorias); },
    async addCategoria(nombre) { admin(); const c = { id: uid(), nombre: nombre.trim(), orden: 5 }; db.categorias.push(c); save(); return delay(c); },
    async deleteCategoria(id) { admin(); db.categorias = db.categorias.filter((c) => c.id !== id); db.productos.forEach((p) => { if (p.categoria_id === id) p.categoria_id = null; }); save(); },

    async productos() {
      if (!session) throw new Error('NO_AUTORIZADO');
      const list = db.productos.filter((p) => rolActual() === 'administrador' || p.activo).map((p) => {
        const o = { ...p, categoria: catName(p.categoria_id) };
        if (rolActual() !== 'administrador') { delete o.costo; delete o.precio_catalogo; delete o.codigo_tupperware; delete o.stock_minimo; delete o.etiqueta_impresa_at; }
        return o;
      });
      return delay(list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    },
    async saveProducto(p) {
      admin();
      const row = {
        nombre: p.nombre.trim(), categoria_id: p.categoria_id || null, descripcion: (p.descripcion || '').trim(),
        precio: Number(p.precio) || 0, costo: Number(p.costo) || 0, cantidad: parseInt(p.cantidad, 10) || 0,
        stock_minimo: parseInt(p.stock_minimo, 10) || 0, activo: p.activo !== false,
        precio_regateo: p.precio_regateo === '' || p.precio_regateo == null ? null : Number(p.precio_regateo),
        ...(p.precio_catalogo !== undefined ? { precio_catalogo: p.precio_catalogo === '' || p.precio_catalogo == null ? null : Number(p.precio_catalogo) } : {}),
        codigo_tupperware: (p.codigo_tupperware || '').trim(), fotos: (p.fotos || []).filter(Boolean).slice(0, 5)
      };
      if (p.id) Object.assign(db.productos.find((x) => x.id === p.id), row);
      else { db.seq += 1; p.id = uid(); db.productos.push({ id: p.id, codigo: 'VED-' + String(db.seq).padStart(4, '0'), etiqueta_impresa_at: null, created_at: now(), ...row }); }
      save(); return delay(p.id);
    },
    async deleteProducto(id) { admin(); db.productos = db.productos.filter((p) => p.id !== id); save(); },
    async setEtiquetaImpresa(ids, impresa) { admin(); db.productos.forEach((p) => { if (ids.includes(p.id)) p.etiqueta_impresa_at = impresa ? now() : null; }); save(); },

    async vender(l) {
      if (!session) throw new Error('NO_AUTORIZADO');
      const p = db.productos.find((x) => x.id === l.producto_id && x.activo);
      if (!p) throw new Error('PRODUCTO_NO_ENCONTRADO');
      if (!(l.cantidad >= 1)) throw new Error('CANTIDAD_INVALIDA');
      if (p.cantidad < l.cantidad) throw new Error('STOCK_INSUFICIENTE');
      const nombre = (l.cliente_nombre || '').trim();
      if (l.forma_pago === 'fiado' && !nombre) throw new Error('CLIENTE_REQUERIDO');
      let cuenta = null;
      if (l.forma_pago === 'contado') {
        const met = l.metodo_cobro || 'efectivo';
        if (!['efectivo', 'transferencia', 'deposito'].includes(met)) throw new Error('METODO_INVALIDO');
        cuenta = l.cuenta_id || (met === 'efectivo' ? (db.cuentas.find((c) => c.tipo === 'efectivo' && c.activa) || {}).id : null);
        if (!cuenta) throw new Error('CUENTA_REQUERIDA');
      }
      const esAdmin = rolActual() === 'administrador';
      const precio = esAdmin && l.precio != null ? Number(l.precio)
        : (l.precio != null && p.precio_regateo != null && Number(l.precio) === p.precio_regateo ? p.precio_regateo : p.precio);
      const quien = (l.vendido_por || '').trim() || (rolActual() === 'administrador' ? 'Administración' : 'Visualizador');
      let cli = null;
      if (nombre) {
        cli = db.clientes.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase());
        if (!cli) { cli = { id: uid(), nombre, telefono: (l.cliente_telefono || '').trim() }; db.clientes.push(cli); }
        else if (!cli.telefono && l.cliente_telefono) cli.telefono = l.cliente_telefono;
      }
      p.cantidad -= l.cantidad;
      const v = {
        id: uid(), producto_id: p.id, producto_codigo: p.codigo, producto_nombre: p.nombre, cantidad: l.cantidad,
        precio_unitario: precio, costo_unitario: p.costo, total: Math.round(precio * l.cantidad * 100) / 100,
        cliente_id: cli ? cli.id : null, cliente_nombre: nombre || null, forma_pago: l.forma_pago,
        fecha_limite: l.forma_pago === 'fiado' ? (l.fecha_limite || null) : null, vendido_por: quien,
        rol: rolActual(), user_id: session.id, anulada: false, anulada_at: null, created_at: now(),
        precio_lista: p.precio, metodo_cobro: l.forma_pago === 'contado' ? (l.metodo_cobro || 'efectivo') : null, cuenta_id: cuenta
      };
      db.ventas.unshift(v);
      db.notificaciones.unshift({ id: uid(), tipo: 'venta', titulo: 'Venta de ' + quien, mensaje: `${l.cantidad} × ${p.nombre} · ${U.money(v.total)}${v.forma_pago === 'fiado' ? ' · FIADO a ' + nombre : ' · ' + v.metodo_cobro}${precio < p.precio ? ' · con descuento' : ''}`, producto_id: p.id, venta_id: v.id, leida: false, created_at: now() });
      if (p.cantidad <= p.stock_minimo) db.notificaciones.unshift({ id: uid(), tipo: 'stock_bajo', titulo: (p.cantidad === 0 ? 'Se agotó: ' : 'Queda poco: ') + p.nombre, mensaje: `Quedan ${p.cantidad} (${p.codigo} · Tupperware ${p.codigo_tupperware || '—'}).`, producto_id: p.id, venta_id: null, leida: false, created_at: now() });
      save();
      const { costo_unitario, user_id, rol, cuenta_id, precio_lista, ...recibo } = v;
      return delay(recibo);
    },
    async misVentas() { return delay(db.ventas.filter((v) => v.user_id === (session && session.id)).slice(0, 60).map(({ costo_unitario, user_id, rol, cuenta_id, precio_lista, ...r }) => r)); },
    async ventas() { admin(); return delay(db.ventas); },
    async anularVenta(id) {
      admin(); const v = db.ventas.find((x) => x.id === id); if (!v || v.anulada) return;
      const p = db.productos.find((x) => x.id === v.producto_id); if (p) p.cantidad += v.cantidad;
      v.anulada = true; v.anulada_at = now(); save();
    },
    async abonos() { admin(); return delay(db.abonos); },
    async registrarAbono(ventaId, monto, nota, metodo, cuentaId) {
      admin(); const v = db.ventas.find((x) => x.id === ventaId);
      const pagado = db.abonos.filter((a) => a.venta_id === ventaId).reduce((s, a) => s + a.monto, 0);
      if (!v || v.anulada || v.forma_pago !== 'fiado') throw new Error('VENTA_NO_VALIDA');
      if (!(monto > 0) || monto > v.total - pagado + 0.001) throw new Error('MONTO_INVALIDO');
      metodo = metodo || 'efectivo';
      const cuenta = cuentaId || (metodo === 'efectivo' ? (db.cuentas.find((c) => c.tipo === 'efectivo' && c.activa) || {}).id : null);
      if (!cuenta) throw new Error('CUENTA_REQUERIDA');
      const a = { id: uid(), venta_id: ventaId, monto, nota: nota || null, metodo_cobro: metodo, cuenta_id: cuenta, created_at: now() };
      db.abonos.unshift(a); save(); return delay(a);
    },
    async clientes() { admin(); return delay(db.clientes); },

    async cuentas() { return delay(db.cuentas.filter((c) => rolActual() === 'administrador' || c.activa)); },
    async addCuenta(nombre) { admin(); const c = { id: uid(), nombre: nombre.trim(), tipo: 'banco', activa: true, orden: 5 }; db.cuentas.push(c); save(); return delay(c); },
    async setCuentaActiva(id, activa) { admin(); db.cuentas.find((c) => c.id === id).activa = activa; save(); },
    async movimientos() { admin(); return delay(db.movimientos); },
    async addMovimiento(m) { admin(); db.movimientos.unshift({ id: uid(), fecha: m.fecha, origen_id: m.origen_id, destino_id: m.destino_id, monto: Number(m.monto), nota: m.nota || null, created_at: now() }); save(); },
    async deleteMovimiento(id) { admin(); db.movimientos = db.movimientos.filter((m) => m.id !== id); save(); },

    async cajas() { admin(); return delay(db.cajas); },
    async saveCaja(c) {
      admin();
      const row = { nombre: c.nombre.trim(), numero_pedido: (c.numero_pedido || '').trim(), fecha_pedido: c.fecha_pedido, fecha_llegada: c.fecha_llegada || null, monto_total: Number(c.monto_total) || 0, notas: (c.notas || '').trim() };
      const items = (c.items || []).map((i) => ({ id: uid(), producto_id: i.producto_id || null, producto_nombre: i.producto_nombre, cantidad: parseInt(i.cantidad, 10), costo_unitario: Number(i.costo_unitario) || 0 }));
      if (c.id) { const x = db.cajas.find((k) => k.id === c.id); Object.assign(x, row); if (c.items) x.items = items; }
      else { c.id = uid(); db.cajas.unshift({ id: c.id, estado: 'pedida', recibida_at: null, pagada: false, pagada_el: null, metodo_pago: null, cuenta_id: null, nota_pago: null, created_at: now(), ...row, items }); }
      save(); return delay(c.id);
    },
    async deleteCaja(id) { admin(); db.cajas = db.cajas.filter((c) => c.id !== id); save(); },
    async recibirCaja(id) {
      admin(); const c = db.cajas.find((k) => k.id === id); if (!c || c.estado === 'recibida') return;
      c.items.forEach((i) => { const p = db.productos.find((x) => x.id === i.producto_id); if (p) { p.cantidad += i.cantidad; if (i.costo_unitario > 0) p.costo = i.costo_unitario; } });
      c.estado = 'recibida'; c.recibida_at = now(); c.fecha_llegada = c.fecha_llegada || ymdHoy(); save();
    },
    async revertirRecepcion(id) {
      admin(); const c = db.cajas.find((k) => k.id === id); if (!c || c.estado !== 'recibida') return;
      c.items.forEach((i) => { const p = db.productos.find((x) => x.id === i.producto_id); if (p) p.cantidad = Math.max(0, p.cantidad - i.cantidad); });
      c.estado = 'pedida'; c.recibida_at = null; save();
    },
    async pagarCaja(id, d) { admin(); Object.assign(db.cajas.find((k) => k.id === id), { pagada: true, pagada_el: d.fecha, metodo_pago: d.metodo, cuenta_id: d.cuenta_id || null, nota_pago: d.nota || null }); save(); },
    async desmarcarPago(id) { admin(); Object.assign(db.cajas.find((k) => k.id === id), { pagada: false, pagada_el: null, metodo_pago: null, cuenta_id: null, nota_pago: null }); save(); },

    async gastos() { admin(); return delay(db.gastos); },
    async saveGasto(g) {
      admin(); const row = { concepto: g.concepto.trim(), monto: Number(g.monto), fecha: g.fecha, nota: g.nota || null };
      if (g.id) Object.assign(db.gastos.find((x) => x.id === g.id), row); else db.gastos.unshift({ id: uid(), created_at: now(), ...row });
      save();
    },
    async deleteGasto(id) { admin(); db.gastos = db.gastos.filter((g) => g.id !== id); save(); },

    async notificaciones() { admin(); return delay(db.notificaciones.slice(0, 120)); },
    async marcarLeidas(ids) { admin(); db.notificaciones.forEach((n) => { if (!ids || ids.includes(n.id)) n.leida = true; }); save(); },
    async probarNotificacion() { admin(); db.notificaciones.unshift({ id: uid(), tipo: 'prueba', titulo: 'Prueba de aviso', mensaje: 'Aviso de prueba (demo).', leida: false, created_at: now() }); save(); },
    async pushSubscribe() {}, async pushUnsubscribe() {},

    async config() { return delay(rolActual() === 'administrador' ? db.config : { nombre_negocio: db.config.nombre_negocio, whatsapp: db.config.whatsapp }); },
    async setConfig(obj) { admin(); Object.assign(db.config, obj); save(); },

    async publicProducto(codigo) {
      const p = db.productos.find((x) => x.codigo === codigo && x.activo);
      return delay({
        producto: p ? { codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion, categoria: catName(p.categoria_id), precio: p.precio, disponible: p.cantidad > 0, fotos: p.fotos } : null,
        config: { nombre_negocio: db.config.nombre_negocio, whatsapp: db.config.whatsapp }
      });
    },
    async logScan() {},
    /* Catálogos: en la demo viven solo en memoria (se pierden al recargar la página) */
    async catalogos() { admin(); return delay(CAT.lista); },
    async catalogosArchivados() { admin(); return delay(CAT.archivados); },
    async crearCatalogo(titulo) { admin(); const c = { id: uid(), titulo: titulo.trim(), paginas: 0, publicado: false, vigente: false, portada_url: null, created_at: now() }; CAT.lista.unshift(c); CAT.pags[c.id] = []; return delay(c); },
    async subirPaginaCatalogo(id, numero, blob) { admin(); return { ruta: `${id}/p${numero}.jpg`, url: URL.createObjectURL(blob) }; },
    async guardarPaginasCatalogo(id, paginas) {
      admin(); const c = CAT.lista.find((x) => x.id === id);
      CAT.pags[id] = paginas.map((p) => ({ catalogo_id: id, numero: p.numero, url_imagen: p.url, ruta: p.ruta, ancho: p.ancho, alto: p.alto }));
      c.paginas = paginas.length; c.portada_url = paginas[0] ? paginas[0].url : null;
    },
    async paginasCatalogo(id) { admin(); return CAT.pags[id] || []; },
    async setCatalogoPublicado(id, v) { admin(); CAT.lista.find((x) => x.id === id).publicado = v; },
    async marcarVigente(id) { admin(); CAT.lista.forEach((c) => { c.vigente = c.id === id; }); },
    async archivarCatalogo(id) {
      admin(); const c = CAT.lista.find((x) => x.id === id);
      CAT.archivados.unshift({ id: uid(), titulo: c.titulo, paginas: c.paginas, creado_el: c.created_at, archivado_el: now() });
      CAT.lista = CAT.lista.filter((x) => x.id !== id); delete CAT.pags[id];
    },
    async borrarCatalogoIncompleto(id) { CAT.lista = CAT.lista.filter((x) => x.id !== id); delete CAT.pags[id]; },
    async eliminarRegistroArchivado(id) { admin(); CAT.archivados = CAT.archivados.filter((x) => x.id !== id); },
    async catalogoPublico(clave) {
      const c = CAT.lista.find((x) => x.publicado && (clave === 'vigente' ? x.vigente : x.id === clave));
      return c ? { catalogo: c, paginas: CAT.pags[c.id] || [], config: db.config } : { catalogo: null, paginas: [], config: {} };
    },
    async zonasProductos() { admin(); return CAT.zonas; },
    async importarProductos(catalogoId, items) {
      admin(); const creados = [];
      for (const it of items) {
        const id = await this.saveProducto({ nombre: it.nombre, descripcion: it.descripcion || '', codigo_tupperware: it.codigo || '', precio: 0, costo: 0, cantidad: 0, stock_minimo: 2, activo: false, fotos: [], precio_catalogo: it.precio_catalogo });
        CAT.zonas.push({ id: uid(), catalogo_id: catalogoId, producto_id: id, pagina: it.pagina, x: it.x, y: it.y, w: it.w, h: it.h });
        creados.push(id);
      }
      return creados;
    },
    async cambiarPin(rol, pin) {
      admin(); if (!/^\d{6}$/.test(pin)) throw new Error('PIN_INVALIDO');
      const otro = rol === 'administrador' ? 'visualizador' : 'administrador';
      if (PIN[otro] === pin) throw new Error('PIN_REPETIDO');
      PIN[rol] = pin; return { ok: true };
    },
    reiniciarDemo() { localStorage.removeItem(KEY); localStorage.removeItem('vedith-demo-sesion'); location.reload(); }
  };
})();
