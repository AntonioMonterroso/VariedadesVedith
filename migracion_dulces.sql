-- =====================================================================
-- DULCES (gelatinas y gomitas) · SECCIÓN PRIVADA · corre esto UNA vez en el SQL Editor.
-- Es seguro correrlo más de una vez.
--
-- Es solo para el control de la administradora: qué entregó, a quién, cuánto le pagaron,
-- cuánto gastó y cuánto le sobró. NO aparece en el catálogo, en las fichas del QR, en las
-- imágenes para estados ni para el visualizador:
--   · tablas propias (no se mezclan con productos ni ventas de Tupperware)
--   · solo la administración puede leerlas o escribirlas (RLS)
--   · sin vistas públicas y sin ningún permiso para "anon" (visitantes sin PIN)
-- =====================================================================
create table if not exists dulces_productos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  tipo           text not null check (tipo in ('gelatina', 'gomita')),
  precio_default numeric(12,2) not null default 0 check (precio_default >= 0),
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists dulces_entregas (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null default current_date,
  cliente    text not null,
  nota       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_dulces_entregas_fecha on dulces_entregas (fecha desc);

create table if not exists dulces_items (
  id              uuid primary key default gen_random_uuid(),
  entrega_id      uuid not null references dulces_entregas(id) on delete cascade,
  producto_id     uuid references dulces_productos(id) on delete set null,
  nombre          text not null,                     -- copia: el comprobante no cambia aunque cambies el producto
  tipo            text not null check (tipo in ('gelatina', 'gomita')),
  cantidad        int  not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0)
);
create index if not exists idx_dulces_items_entrega on dulces_items (entrega_id);

create table if not exists dulces_pagos (
  id         uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references dulces_entregas(id) on delete cascade,
  fecha      date not null default current_date,
  monto      numeric(12,2) not null check (monto > 0),
  metodo     text not null default 'efectivo' check (metodo in ('efectivo', 'transferencia', 'deposito')),
  nota       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_dulces_pagos_entrega on dulces_pagos (entrega_id);

-- Lo que gastó para preparar esa entrega (ej.: 6 bolsas de gelatina, 2 cajas de leche condensada)
create table if not exists dulces_gastos (
  id             uuid primary key default gen_random_uuid(),
  entrega_id     uuid not null references dulces_entregas(id) on delete cascade,
  concepto       text not null,
  cantidad       numeric(10,2) not null default 1 check (cantidad > 0),
  costo_unitario numeric(12,2) not null check (costo_unitario >= 0)
);
create index if not exists idx_dulces_gastos_entrega on dulces_gastos (entrega_id);

alter table dulces_productos enable row level security;
alter table dulces_entregas  enable row level security;
alter table dulces_items     enable row level security;
alter table dulces_pagos     enable row level security;
alter table dulces_gastos    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dulces_productos','dulces_entregas','dulces_items','dulces_pagos','dulces_gastos'] loop
    execute format('drop policy if exists "solo_admin" on %I', t);
    execute format('create policy "solo_admin" on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

-- Productos de ejemplo (puedes cambiarlos o borrarlos desde el panel)
insert into dulces_productos (nombre, tipo, precio_default)
select * from (values
  ('Gelatina mosaico',        'gelatina', 5.00),
  ('Gelatina de fresa',       'gelatina', 4.00),
  ('Gelatina de uva',         'gelatina', 4.00),
  ('Gomitas en vasito',       'gomita',   8.00)
) v(nombre, tipo, precio_default)
where not exists (select 1 from dulces_productos);
