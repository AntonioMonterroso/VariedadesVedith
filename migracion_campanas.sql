-- =====================================================================
-- CAMPAÑAS, ARCHIVADO AUTOMÁTICO Y LIMPIEZA DE LA BASE
-- Corre esto UNA vez en el SQL Editor. Es seguro correrlo más de una vez.
--
-- Los productos van por tandadas y casi no se repiten, así que:
--  · campana            → cada producto lleva el nombre de su campaña (ej. "Tupper Tips 11")
--  · archivado          → el producto sale de la lista, del catálogo y del QR (activo = false);
--                         las ventas ya hechas no se tocan
--  · conservar          → "mantener siempre": ese producto no se archiva solo
--  · agotado_desde      → desde cuándo se agotó (se llena solo cuando la existencia pasa de >0 a 0)
--  · fn_archivar_agotados() → archiva los productos agotados hace 3 días o más (cada día, 3:30 am)
--  · fn_depurar()           → borra de verdad lo archivado hace 30 días y la basura vieja (cada día, 3:45 am)
--  Los plazos (3 y 30 días) se cambian en Ajustes; se guardan en la tabla configuracion.
-- =====================================================================
alter table productos add column if not exists campana       text;
alter table productos add column if not exists archivado     boolean not null default false;
alter table productos add column if not exists archivado_at  timestamptz;
alter table productos add column if not exists conservar     boolean not null default false;
alter table productos add column if not exists agotado_desde timestamptz;
-- Los productos nuevos nacen SIN aviso de poco stock (casi nunca se vuelven a pedir)
alter table productos alter column avisar_stock set default false;
create index if not exists idx_productos_campana   on productos (campana);
create index if not exists idx_productos_archivado on productos (archivado, archivado_at);

insert into configuracion (clave, valor) values
  ('dias_agotado_archivar', '3'),
  ('dias_borrar_archivados', '30')
on conflict (clave) do nothing;

-- Se anota desde cuándo está agotado (solo cuando de verdad se acabó, no los borradores en 0)
create or replace function fn_agotado_desde() returns trigger language plpgsql as $$
begin
  if new.cantidad = 0 and old.cantidad > 0 then new.agotado_desde := now();
  elsif new.cantidad > 0 then new.agotado_desde := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_agotado_desde on productos;
create trigger trg_agotado_desde before update of cantidad on productos
  for each row execute function fn_agotado_desde();

-- Archiva los agotados que llevan p_dias o más (por defecto, lo de Ajustes: 3 días)
create or replace function fn_archivar_agotados(p_dias int default null) returns int
language plpgsql security definer set search_path = public as $$
declare d int; n int;
begin
  if auth.uid() is not null and not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  d := coalesce(p_dias, nullif((select valor from configuracion where clave = 'dias_agotado_archivar'), '')::int, 3);
  update productos
     set archivado = true, activo = false, archivado_at = now()
   where not archivado and not conservar and cantidad = 0
     and agotado_desde is not null and agotado_desde <= now() - make_interval(days => d);
  get diagnostics n = row_count;
  if n > 0 then insert into bitacora (accion, detalle) values ('archivado_automatico', jsonb_build_object('productos', n)); end if;
  return n;
end $$;

-- Limpieza: borra de verdad lo archivado hace mucho y los registros viejos que ya no sirven.
-- Las ventas, ganancias y reportes NO se tocan (cada venta guarda su propia copia del nombre y precio).
create or replace function fn_depurar(p_dias int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d int; a int; n int; e int; b int;
begin
  if auth.uid() is not null and not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  d := coalesce(p_dias, nullif((select valor from configuracion where clave = 'dias_borrar_archivados'), '')::int, 30);
  delete from productos where archivado and archivado_at <= now() - make_interval(days => d);
  get diagnostics a = row_count;
  delete from notificaciones where leida and created_at < now() - interval '60 days';
  get diagnostics n = row_count;
  delete from escaneos_qr where created_at < now() - interval '90 days';
  get diagnostics e = row_count;
  delete from bitacora where created_at < now() - interval '180 days';
  get diagnostics b = row_count;
  return jsonb_build_object('productos', a, 'avisos', n, 'escaneos', e, 'bitacora', b);
end $$;

revoke all on function fn_archivar_agotados(int), fn_depurar(int) from public, anon;
grant execute on function fn_archivar_agotados(int), fn_depurar(int) to authenticated;

-- Programación diaria (hora de Guatemala = UTC-6)
do $$ begin perform cron.unschedule('vedith-archivar-agotados'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('vedith-depurar');           exception when others then null; end $$;
select cron.schedule('vedith-archivar-agotados', '30 9 * * *', $$select fn_archivar_agotados();$$);
select cron.schedule('vedith-depurar',           '45 9 * * *', $$select fn_depurar();$$);
