/* Capa de datos con Supabase. La app solo habla con esta interfaz (ver api-demo.js,
   que expone exactamente lo mismo con datos de ejemplo en el navegador). */
(function () {
  'use strict';
  const C = window.VEDITH_CONFIG;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'vedith-auth' }
  });

  const fail = (error, fallback = 'ERROR') => {
    const e = new Error((error && (error.message || error.code)) || fallback);
    e.code = error && error.code;
    e.status = error && error.status;
    throw e;
  };
  const ok = ({ data, error }) => { if (error) fail(error); return data; };

  let session = null; // { rol, nombre, email, id }

  async function cargarPerfil(user) {
    const { data, error } = await sb.from('perfiles').select('rol, nombre').eq('id', user.id).maybeSingle();
    if (error) fail(error);
    if (!data) { await sb.auth.signOut(); const e = new Error('SIN_PERFIL'); throw e; }
    session = { id: user.id, email: user.email, rol: data.rol, nombre: data.nombre };
    return session;
  }

  const normProd = (r) => ({
    id: r.id, codigo: r.codigo, codigo_tupperware: r.codigo_tupperware || '',
    nombre: r.nombre, categoria_id: r.categoria_id, categoria: r.categorias ? r.categorias.nombre : (r.categoria || ''),
    descripcion: r.descripcion || '', precio: Number(r.precio), precio_regateo: r.precio_regateo == null ? null : Number(r.precio_regateo),
    precio_catalogo: r.precio_catalogo == null ? null : Number(r.precio_catalogo), costo: r.costo == null ? null : Number(r.costo),
    cantidad: r.cantidad, stock_minimo: r.stock_minimo == null ? 2 : r.stock_minimo,
    activo: r.activo !== false, etiqueta_impresa_at: r.etiqueta_impresa_at || null,
    fotos: Array.isArray(r.fotos) ? r.fotos
      : (r.fotos_producto || []).slice().sort((a, b) => a.orden - b.orden).map((f) => f.url_foto)
  });

  window.API = {
    mode: 'supabase',

    async init() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      try { return await cargarPerfil(data.session.user); } catch (e) { return null; }
    },

    async login(pin) {
      if (!/^\d{6}$/.test(pin)) throw new Error('PIN_INCORRECTO');
      const last = U.lsGet('vedith-ultimo-rol', 'administrador');
      const cuentas = last === 'visualizador' ? [C.VISOR_EMAIL, C.ADMIN_EMAIL] : [C.ADMIN_EMAIL, C.VISOR_EMAIL];
      let limitado = false, red = false;
      for (const email of cuentas) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pin });
        if (!error && data.user) {
          const s = await cargarPerfil(data.user);
          U.lsSet('vedith-ultimo-rol', s.rol);
          return s;
        }
        if (error && (error.status === 429 || /rate|too many/i.test(error.message))) { limitado = true; break; }
        if (error && (error.status === 0 || /fetch|network/i.test(error.message))) { red = true; break; }
      }
      throw new Error(limitado ? 'MUCHOS_INTENTOS' : red ? 'RED' : 'PIN_INCORRECTO');
    },
    async logout() { session = null; await sb.auth.signOut(); },
    session: () => session,

    /* ---- catálogo ---- */
    async categorias() {
      if (session.rol === 'administrador') return ok(await sb.from('categorias').select('*').order('orden').order('nombre'));
      return ok(await sb.from('vista_categorias').select('*').order('orden').order('nombre'));
    },
    async addCategoria(nombre) { return ok(await sb.from('categorias').insert({ nombre: nombre.trim(), orden: 5 }).select().single()); },
    async deleteCategoria(id) { ok(await sb.from('categorias').delete().eq('id', id)); },

    async productos() {
      if (session.rol === 'administrador') {
        const rows = ok(await sb.from('productos').select('*, categorias(nombre), fotos_producto(url_foto, orden)').order('nombre').limit(5000));
        return rows.map(normProd);
      }
      const rows = ok(await sb.from('vista_catalogo').select('*').order('nombre').limit(5000));
      return rows.map(normProd);
    },

    async saveProducto(p) {
      const row = {
        nombre: p.nombre.trim(), categoria_id: p.categoria_id || null, descripcion: (p.descripcion || '').trim() || null,
        precio: Number(p.precio) || 0, costo: Number(p.costo) || 0,
        precio_regateo: p.precio_regateo === '' || p.precio_regateo == null ? null : Number(p.precio_regateo), cantidad: parseInt(p.cantidad, 10) || 0,
        stock_minimo: parseInt(p.stock_minimo, 10) || 0, activo: p.activo !== false,
        codigo_tupperware: (p.codigo_tupperware || '').trim() || null
      };
      if (p.precio_catalogo !== undefined) row.precio_catalogo = p.precio_catalogo === '' || p.precio_catalogo == null ? null : Number(p.precio_catalogo);
      let id = p.id;
      if (id) ok(await sb.from('productos').update(row).eq('id', id));
      else id = ok(await sb.from('productos').insert(row).select('id').single()).id;
      // fotos: solo links; se reemplazan completas
      ok(await sb.from('fotos_producto').delete().eq('producto_id', id));
      const fotos = (p.fotos || []).filter(Boolean).slice(0, 5).map((url, i) => ({ producto_id: id, url_foto: url, orden: i }));
      if (fotos.length) ok(await sb.from('fotos_producto').insert(fotos));
      return id;
    },
    async deleteProducto(id) { ok(await sb.from('productos').delete().eq('id', id)); },
    async setEtiquetaImpresa(ids, impresa) {
      if (!ids.length) return;
      ok(await sb.from('productos').update({ etiqueta_impresa_at: impresa ? new Date().toISOString() : null }).in('id', ids));
    },

    /* ---- ventas ---- */
    async vender(l) {
      const { data, error } = await sb.rpc('registrar_venta', {
        p_producto_id: l.producto_id, p_cantidad: l.cantidad, p_vendido_por: l.vendido_por,
        p_forma_pago: l.forma_pago, p_cliente_nombre: l.cliente_nombre || null, p_cliente_telefono: l.cliente_telefono || null,
        p_fecha_limite: l.fecha_limite || null, p_precio: l.precio == null ? null : l.precio,
        p_metodo: l.metodo_cobro || 'efectivo', p_cuenta_id: l.cuenta_id || null
      });
      if (error) fail(error);
      return data;
    },
    async misVentas() { return ok(await sb.rpc('mis_ventas', { p_limite: 60 })); },
    async ventas() { return ok(await sb.from('ventas').select('*').order('created_at', { ascending: false }).limit(5000)); },
    async anularVenta(id) { ok(await sb.rpc('anular_venta', { p_venta_id: id })); },
    async abonos() { return ok(await sb.from('abonos').select('*').order('created_at', { ascending: false }).limit(5000)); },
    async registrarAbono(ventaId, monto, nota, metodo, cuentaId) {
      return ok(await sb.rpc('registrar_abono', { p_venta_id: ventaId, p_monto: monto, p_nota: nota || null, p_metodo: metodo || 'efectivo', p_cuenta_id: cuentaId || null }));
    },

    /* ---- cuentas (a dónde va el dinero) y depósitos de efectivo al banco ---- */
    async cuentas() {
      if (session.rol === 'administrador') return ok(await sb.from('cuentas').select('*').order('orden').order('nombre'));
      return ok(await sb.from('vista_cuentas').select('*').order('orden').order('nombre'));
    },
    async addCuenta(nombre) { return ok(await sb.from('cuentas').insert({ nombre: nombre.trim(), tipo: 'banco', orden: 5 }).select().single()); },
    async setCuentaActiva(id, activa) { ok(await sb.from('cuentas').update({ activa }).eq('id', id)); },
    async movimientos() { return ok(await sb.from('movimientos_caja').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1000)); },
    async addMovimiento(m) { ok(await sb.from('movimientos_caja').insert({ fecha: m.fecha, origen_id: m.origen_id, destino_id: m.destino_id, monto: Number(m.monto), nota: m.nota || null })); },
    async deleteMovimiento(id) { ok(await sb.from('movimientos_caja').delete().eq('id', id)); },

    /* ---- cajas (pedidos a Tupperware) ---- */
    async cajas() {
      const rows = ok(await sb.from('cajas').select('*, caja_items(*)').order('fecha_pedido', { ascending: false }).order('created_at', { ascending: false }));
      return rows.map((c) => ({ ...c, items: c.caja_items || [], monto_total: Number(c.monto_total) }));
    },
    async saveCaja(c) {
      const row = { nombre: c.nombre.trim(), numero_pedido: (c.numero_pedido || '').trim() || null, fecha_pedido: c.fecha_pedido,
        fecha_llegada: c.fecha_llegada || null, monto_total: Number(c.monto_total) || 0, notas: (c.notas || '').trim() || null };
      let id = c.id;
      if (id) ok(await sb.from('cajas').update(row).eq('id', id));
      else id = ok(await sb.from('cajas').insert(row).select('id').single()).id;
      if (c.items) {
        ok(await sb.from('caja_items').delete().eq('caja_id', id));
        const items = c.items.map((i) => ({ caja_id: id, producto_id: i.producto_id || null, producto_nombre: i.producto_nombre, cantidad: parseInt(i.cantidad, 10), costo_unitario: Number(i.costo_unitario) || 0 }));
        if (items.length) ok(await sb.from('caja_items').insert(items));
      }
      return id;
    },
    async deleteCaja(id) { ok(await sb.from('cajas').delete().eq('id', id)); },
    async recibirCaja(id) { ok(await sb.rpc('recibir_caja', { p_caja_id: id })); },
    async revertirRecepcion(id) { ok(await sb.rpc('revertir_recepcion_caja', { p_caja_id: id })); },
    async pagarCaja(id, d) { ok(await sb.from('cajas').update({ pagada: true, pagada_el: d.fecha, metodo_pago: d.metodo, cuenta_id: d.cuenta_id || null, nota_pago: d.nota || null }).eq('id', id)); },
    async desmarcarPago(id) { ok(await sb.from('cajas').update({ pagada: false, pagada_el: null, metodo_pago: null, cuenta_id: null, nota_pago: null }).eq('id', id)); },
    async clientes() { return ok(await sb.from('clientes').select('*').order('nombre')); },

    async gastos() { return ok(await sb.from('gastos').select('*').order('fecha', { ascending: false }).limit(2000)); },
    async saveGasto(g) {
      const row = { concepto: g.concepto.trim(), monto: Number(g.monto), fecha: g.fecha, nota: g.nota || null };
      if (g.id) ok(await sb.from('gastos').update(row).eq('id', g.id)); else ok(await sb.from('gastos').insert(row));
    },
    async deleteGasto(id) { ok(await sb.from('gastos').delete().eq('id', id)); },

    /* ---- notificaciones y push ---- */
    async notificaciones() { return ok(await sb.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(120)); },
    async marcarLeidas(ids) {
      let q = sb.from('notificaciones').update({ leida: true });
      q = ids ? q.in('id', ids) : q.eq('leida', false);
      ok(await q);
    },
    // Crea un aviso real: el servidor lo manda al teléfono igual que uno de venta
    async probarNotificacion() { ok(await sb.from('notificaciones').insert({ tipo: 'prueba', titulo: 'Prueba de aviso', mensaje: 'Si lees esto en el teléfono, los avisos de ventas funcionan.' })); },
    async pushSubscribe(sub) {
      const j = sub.toJSON();
      ok(await sb.from('push_suscripciones').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' }));
    },
    async pushUnsubscribe(endpoint) { ok(await sb.from('push_suscripciones').delete().eq('endpoint', endpoint)); },

    /* ---- configuración ---- */
    async config() {
      const rows = session && session.rol === 'administrador'
        ? ok(await sb.from('configuracion').select('*'))
        : ok(await sb.from('vista_config_publica').select('*'));
      return Object.fromEntries(rows.map((r) => [r.clave, r.valor || '']));
    },
    async setConfig(obj) {
      const rows = Object.entries(obj).map(([clave, valor]) => ({ clave, valor: String(valor ?? '') }));
      ok(await sb.from('configuracion').upsert(rows, { onConflict: 'clave' }));
    },

    /* ---- ficha pública (sin sesión) ---- */
    async publicProducto(codigo) {
      const p = ok(await sb.from('vista_producto_publico').select('*').eq('codigo', codigo).maybeSingle());
      const cfgRows = ok(await sb.from('vista_config_publica').select('*'));
      return { producto: p, config: Object.fromEntries(cfgRows.map((r) => [r.clave, r.valor || ''])) };
    },
    async logScan(codigo) {
      try { await sb.from('escaneos_qr').insert({ producto_codigo: codigo, dispositivo: /Mobi/i.test(navigator.userAgent) ? 'móvil' : 'computadora' }); } catch (_) {}
    },

    /* ---- catálogos (librito) ---- */
    async catalogos() { return ok(await sb.from('catalogos').select('*').order('created_at', { ascending: false })); },
    async catalogosArchivados() { return ok(await sb.from('catalogos_archivados').select('*').order('archivado_el', { ascending: false })); },
    async crearCatalogo(titulo) { return ok(await sb.from('catalogos').insert({ titulo: titulo.trim() }).select().single()); },
    async subirPaginaCatalogo(catalogoId, numero, blob) {
      const ruta = `${catalogoId}/p${String(numero).padStart(3, '0')}.jpg`;
      const { error } = await sb.storage.from('catalogos').upload(ruta, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (error) fail(error);
      return { ruta, url: sb.storage.from('catalogos').getPublicUrl(ruta).data.publicUrl };
    },
    async guardarPaginasCatalogo(catalogoId, paginas) {
      const rows = paginas.map((p) => ({ catalogo_id: catalogoId, numero: p.numero, url_imagen: p.url, ruta: p.ruta, ancho: p.ancho, alto: p.alto }));
      ok(await sb.from('catalogo_paginas').upsert(rows, { onConflict: 'catalogo_id,numero' }));
      ok(await sb.from('catalogos').update({ paginas: paginas.length, portada_url: paginas[0] ? paginas[0].url : null }).eq('id', catalogoId));
    },
    async paginasCatalogo(id) { return ok(await sb.from('catalogo_paginas').select('*').eq('catalogo_id', id).order('numero')); },
    async setCatalogoPublicado(id, v) { ok(await sb.from('catalogos').update({ publicado: v }).eq('id', id)); },
    async marcarVigente(id) { ok(await sb.rpc('marcar_catalogo_vigente', { p_id: id })); },
    async quitarArchivosCatalogo(rutas) {
      for (let i = 0; i < rutas.length; i += 100) {
        const { error } = await sb.storage.from('catalogos').remove(rutas.slice(i, i + 100));
        if (error) fail(error);
      }
    },
    async archivarCatalogo(id) {
      const pags = await this.paginasCatalogo(id);
      await this.quitarArchivosCatalogo(pags.map((p) => p.ruta));   // primero los archivos; si falla, no se archiva
      ok(await sb.rpc('archivar_catalogo', { p_id: id }));
    },
    async borrarCatalogoIncompleto(id, rutas) {
      try { await this.quitarArchivosCatalogo(rutas); } catch (_) {}
      ok(await sb.from('catalogos').delete().eq('id', id));
    },
    async eliminarRegistroArchivado(id) { ok(await sb.from('catalogos_archivados').delete().eq('id', id)); },
    async catalogoPublico(clave) {
      let q = sb.from('vista_catalogo_publico').select('*');
      q = clave === 'vigente' ? q.eq('vigente', true).limit(1) : q.eq('id', clave).limit(1);
      const cat = ok(await q)[0];
      if (!cat) return { catalogo: null, paginas: [], config: {} };
      const paginas = ok(await sb.from('vista_catalogo_paginas_pub').select('*').eq('catalogo_id', cat.id).order('numero'));
      const cfg = ok(await sb.from('vista_config_publica').select('*'));
      return { catalogo: cat, paginas, config: Object.fromEntries(cfg.map((r) => [r.clave, r.valor || ''])) };
    },

    /* ---- importador de productos desde el catálogo ---- */
    async zonasProductos() { return ok(await sb.from('catalogo_productos').select('*')); },
    // Crea cada producto como BORRADOR (oculto, sin precio de venta ni foto) y anota dónde está en el catálogo
    async importarProductos(catalogoId, items) {
      const creados = [];
      for (const it of items) {
        const id = await this.saveProducto({
          nombre: it.nombre, descripcion: it.descripcion || '', codigo_tupperware: it.codigo || '', precio: 0, costo: 0, cantidad: 0,
          stock_minimo: 2, activo: false, fotos: [], precio_catalogo: it.precio_catalogo
        });
        ok(await sb.from('catalogo_productos').insert({ catalogo_id: catalogoId, producto_id: id, pagina: it.pagina, x: it.x, y: it.y, w: it.w, h: it.h }));
        creados.push(id);
      }
      return creados;
    },

    async cambiarPin(rol, pin) {
      const { data, error } = await sb.functions.invoke(C.FUNCION_CAMBIAR_PIN || 'cambiar-pin', { body: { rol, pin } });
      if (error) {
        let code = 'ERROR';
        try { code = (await error.context.json()).error || code; } catch (_) {}
        throw new Error(code);
      }
      return data;
    }
  };
})();
