-- =====================================================================
-- ROLES · correr DESPUÉS de crear los 2 usuarios en Authentication > Users
-- (ver SUPABASE_SETUP.md). Se puede correr las veces que haga falta.
-- =====================================================================
insert into perfiles (id, rol, nombre)
select id, 'administrador', 'Administración'
from auth.users where email = 'admin@vedith.example.com'
on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre;

insert into perfiles (id, rol, nombre)
select id, 'visualizador', 'Visualizador'
from auth.users where email = 'visor@vedith.example.com'
on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre;

-- Verificación: deben salir 2 filas
select p.rol, u.email from perfiles p join auth.users u on u.id = p.id order by p.rol;
