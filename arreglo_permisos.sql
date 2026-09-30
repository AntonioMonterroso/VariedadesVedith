-- =====================================================================
-- ARREGLO DE PERMISOS · corre esto UNA vez en el SQL Editor si el schema.sql
-- ya estaba corrido y al entrar sale "permission denied for table perfiles".
-- (Si corres el schema.sql nuevo completo no hace falta.)
-- =====================================================================
-- Permisos de acceso para las cuentas con sesión (authenticated). Las reglas RLS de arriba
-- deciden QUÉ filas ve cada quien; esto solo abre la puerta a la tabla. Supabase ya no da
-- estos permisos solos en proyectos nuevos. Se dan tabla por tabla (nunca a las vistas, porque
-- una vista simple permitiría escribir saltándose las reglas).
grant select on perfiles to authenticated;
grant select, insert, update, delete on
  categorias, productos, fotos_producto, clientes, ventas, abonos, gastos, cuentas, cajas,
  caja_items, movimientos_caja, notificaciones, push_suscripciones, configuracion, bitacora
  to authenticated;
grant select on escaneos_qr to authenticated;
grant usage, select on sequence productos_codigo_seq to authenticated;

-- La función de avisos (enviar-push) entra con el rol service_role: necesita poder leer
-- perfiles y push_suscripciones. En proyectos nuevos tampoco se le dan estos permisos solos.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
