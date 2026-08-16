-- =====================================================================
-- Ice-T · Esquema inicial (multi-negocio / multi-tenant)
-- =====================================================================
-- Convenciones de seguridad:
--   * RLS habilitado en TODAS las tablas de negocio.
--   * Aislamiento por tenant vía business_id + funciones SECURITY DEFINER
--     (evitan recursión de RLS al consultar profiles).
--   * Mutaciones sensibles (crear negocio, registrar venta) se hacen vía
--     funciones RPC transaccionales que validan pertenencia al tenant,
--     nunca confiando en valores enviados libremente por el cliente.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Función utilitaria: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- TABLA: businesses (negocios / tenants)
-- =====================================================================
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'MXN',
  timezone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- =====================================================================
-- TABLA: profiles (usuarios de la app, 1-1 con auth.users)
-- =====================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null check (role in ('admin', 'vendedor')),
  full_name text not null default '',
  email text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_business on public.profiles(business_id);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Funciones SECURITY DEFINER para resolver tenant/rol del usuario actual
-- sin disparar recursión de RLS.
-- ---------------------------------------------------------------------
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

grant execute on function public.current_business_id to authenticated;
grant execute on function public.current_role to authenticated;
grant execute on function public.is_admin to authenticated;

-- ---------------------------------------------------------------------
-- Guarda de columnas privilegiadas en profiles.
--
-- La policy de UPDATE de profiles (más abajo) permite a cualquier
-- usuario editar SU PROPIA fila (para poder cambiar su nombre/teléfono
-- desde /configuracion). Sin este trigger, esa misma policy dejaría a un
-- vendedor auto-promoverse con
-- `update profiles set role='admin' where id=auth.uid()` desde el
-- cliente, porque RLS sólo filtra FILAS, no columnas. Este trigger
-- bloquea cambios a role/active/business_id salvo que quien ejecuta la
-- actualización ya sea admin del negocio.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.business_id is distinct from old.business_id then
      raise exception 'No tienes permiso para cambiar estos campos de tu perfil';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- =====================================================================
-- TABLA: ice_products (catálogo de precios: bolsas 1/2/3/5 kg, granel...)
-- =====================================================================
create table public.ice_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  unit text not null default 'pieza',        -- 'pieza' | 'kg'
  is_bulk boolean not null default false,     -- true = granel (permite decimales)
  price numeric(10,2) not null default 0 check (price >= 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ice_products_business on public.ice_products(business_id);

create trigger trg_ice_products_updated_at
  before update on public.ice_products
  for each row execute function public.set_updated_at();

-- =====================================================================
-- TABLA: customers (clientes: tienditas, negocios, particulares)
-- =====================================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  assigned_vendedor_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  customer_type text not null default 'tienda' check (customer_type in ('tienda', 'restaurante', 'particular', 'otro')),
  phone text,
  address text,
  notes text,
  last_restock_date date,
  -- Próxima fecha de reabasto, capturada manualmente en cada entrega (se
  -- le pregunta al cliente "¿en cuántos días te resurto?" en ese momento)
  -- en vez de recalcularse sola con una frecuencia fija, porque en la
  -- práctica varía visita a visita.
  next_restock_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_business on public.customers(business_id);
create index idx_customers_next_restock on public.customers(business_id, next_restock_date);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- =====================================================================
-- TABLA: sales (ventas) + sale_items (detalle)
-- =====================================================================
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  vendedor_id uuid not null references public.profiles(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  total numeric(10,2) not null default 0 check (total >= 0),
  payment_method text not null default 'efectivo' check (payment_method in ('efectivo', 'transferencia', 'credito')),
  status text not null default 'completada' check (status in ('completada', 'cancelada')),
  client_uuid uuid not null unique, -- generado en el cliente para idempotencia (sync offline)
  sold_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_sales_business_sold_at on public.sales(business_id, sold_at desc);
create index idx_sales_vendedor on public.sales(vendedor_id, sold_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.ice_products(id) on delete set null,
  product_name_snapshot text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity numeric(10,2) not null check (quantity > 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);

create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_sale_items_business on public.sale_items(business_id);

-- =====================================================================
-- TABLA: expenses (gastos: capital / operativo)
-- =====================================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  expense_type text not null check (expense_type in ('capital', 'operativo')),
  category text not null default 'otro' check (category in ('equipo', 'insumo', 'transporte', 'servicios', 'otro')),
  description text not null check (char_length(trim(description)) > 0),
  unit_cost numeric(10,2) not null check (unit_cost >= 0),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  amount numeric(10,2) generated always as (round(unit_cost * quantity, 2)) stored,
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_expenses_business_date on public.expenses(business_id, expense_date desc);

-- =====================================================================
-- TABLA: push_subscriptions (Web Push / VAPID)
-- =====================================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_business on public.push_subscriptions(business_id);

-- =====================================================================
-- TABLA: reminder_log (evita reenviar el mismo recordatorio push)
-- =====================================================================
create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  unique (customer_id, reminder_date)
);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.ice_products enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security;

-- businesses ------------------------------------------------------------
create policy "businesses_select_own" on public.businesses
  for select using (id = public.current_business_id());

create policy "businesses_update_admin" on public.businesses
  for update using (public.is_admin() and id = public.current_business_id())
  with check (id = public.current_business_id());
-- Sin policy de insert/delete directa: la creación pasa por
-- create_business_and_admin() (SECURITY DEFINER).

-- profiles ----------------------------------------------------------------
create policy "profiles_select_same_business" on public.profiles
  for select using (business_id = public.current_business_id());

create policy "profiles_update_self_or_admin" on public.profiles
  for update using (
    id = auth.uid()
    or (public.is_admin() and business_id = public.current_business_id())
  )
  with check (business_id = public.current_business_id());

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin() and business_id = public.current_business_id() and id <> auth.uid());
-- Sin policy de insert directa: los perfiles se crean vía
-- create_business_and_admin() o el endpoint admin (service role).

-- ice_products --------------------------------------------------------------
create policy "ice_products_select" on public.ice_products
  for select using (business_id = public.current_business_id());

create policy "ice_products_admin_write" on public.ice_products
  for all using (public.is_admin() and business_id = public.current_business_id())
  with check (public.is_admin() and business_id = public.current_business_id());

-- customers -------------------------------------------------------------
create policy "customers_select" on public.customers
  for select using (business_id = public.current_business_id());

create policy "customers_insert" on public.customers
  for insert with check (business_id = public.current_business_id());

create policy "customers_update" on public.customers
  for update using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "customers_delete_admin" on public.customers
  for delete using (public.is_admin() and business_id = public.current_business_id());

-- sales -------------------------------------------------------------------
-- Las inserciones NO se hacen por policy directa: se usa create_sale() RPC.
create policy "sales_select" on public.sales
  for select using (
    business_id = public.current_business_id()
    and (public.is_admin() or vendedor_id = auth.uid())
  );

create policy "sales_update_admin" on public.sales
  for update using (public.is_admin() and business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- sale_items ----------------------------------------------------------------
create policy "sale_items_select" on public.sale_items
  for select using (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (public.is_admin() or s.vendedor_id = auth.uid())
    )
  );

-- expenses ------------------------------------------------------------------
create policy "expenses_admin_all" on public.expenses
  for all using (public.is_admin() and business_id = public.current_business_id())
  with check (public.is_admin() and business_id = public.current_business_id());

-- push_subscriptions ----------------------------------------------------------
create policy "push_subscriptions_owner" on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and business_id = public.current_business_id());

-- reminder_log ------------------------------------------------------------
create policy "reminder_log_select" on public.reminder_log
  for select using (
    exists (
      select 1 from public.customers c
      where c.id = reminder_log.customer_id
        and c.business_id = public.current_business_id()
    )
  );
-- Sin insert/update de cliente: sólo lo escribe la Edge Function (service role).

-- =====================================================================
-- RPC: create_business_and_admin
-- Crea el negocio + perfil admin para el usuario recién registrado, y
-- siembra el catálogo de precios por defecto.
-- =====================================================================
create or replace function public.create_business_and_admin(
  p_business_name text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Este usuario ya tiene un perfil asignado';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.businesses (name, owner_id)
  values (nullif(trim(p_business_name), ''), auth.uid())
  returning id into v_business_id;

  insert into public.profiles (id, business_id, role, full_name, email)
  values (auth.uid(), v_business_id, 'admin', coalesce(nullif(trim(p_full_name), ''), v_email), v_email);

  insert into public.ice_products (business_id, name, unit, is_bulk, price, sort_order) values
    (v_business_id, 'Bolsa 1 kg', 'pieza', false, 0, 1),
    (v_business_id, 'Bolsa 2 kg', 'pieza', false, 0, 2),
    (v_business_id, 'Bolsa 3 kg', 'pieza', false, 0, 3),
    (v_business_id, 'Bolsa 5 kg', 'pieza', false, 0, 4),
    (v_business_id, 'Hielo a granel', 'kg', true, 0, 5);

  return v_business_id;
end;
$$;

grant execute on function public.create_business_and_admin to authenticated;

-- =====================================================================
-- RPC: create_sale
-- Inserta una venta + sus items de forma atómica. Es la única vía para
-- registrar ventas (no hay policy de insert directa). Valida que
-- cliente/productos pertenezcan al mismo negocio del vendedor y es
-- idempotente vía client_uuid (clave para el sync offline).
-- =====================================================================
create or replace function public.create_sale(
  p_customer_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_client_uuid uuid,
  p_sold_at timestamptz default now(),
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_vendedor_id uuid := auth.uid();
  v_sale_id uuid;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_line_total numeric(10,2);
  v_sold_at timestamptz := coalesce(p_sold_at, now());
begin
  if v_vendedor_id is null then
    raise exception 'No autenticado';
  end if;

  select id into v_sale_id from public.sales where client_uuid = p_client_uuid;
  if v_sale_id is not null then
    return v_sale_id; -- ya sincronizada, idempotente
  end if;

  select business_id into v_business_id from public.profiles where id = v_vendedor_id and active = true;
  if v_business_id is null then
    raise exception 'Perfil no encontrado, inactivo o sin negocio asignado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  if p_customer_id is not null then
    perform 1 from public.customers where id = p_customer_id and business_id = v_business_id;
    if not found then
      raise exception 'Cliente inválido para este negocio';
    end if;
  end if;

  insert into public.sales (business_id, vendedor_id, customer_id, payment_method, client_uuid, sold_at, notes, total)
  values (v_business_id, v_vendedor_id, p_customer_id, coalesce(p_payment_method, 'efectivo'), p_client_uuid, v_sold_at, p_notes, 0)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    perform 1 from public.ice_products
      where id = (v_item->>'product_id')::uuid and business_id = v_business_id;
    if not found then
      raise exception 'Producto inválido para este negocio';
    end if;

    if (v_item->>'quantity')::numeric <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;

    v_line_total := round(((v_item->>'unit_price')::numeric * (v_item->>'quantity')::numeric)::numeric, 2);

    insert into public.sale_items (sale_id, business_id, product_id, product_name_snapshot, unit_price, quantity, subtotal)
    values (
      v_sale_id,
      v_business_id,
      (v_item->>'product_id')::uuid,
      coalesce(v_item->>'product_name', ''),
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric,
      v_line_total
    );

    v_total := v_total + v_line_total;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  if p_customer_id is not null then
    update public.customers
      set last_restock_date = v_sold_at::date
      where id = p_customer_id
        and (last_restock_date is null or last_restock_date <= v_sold_at::date);
  end if;

  return v_sale_id;
end;
$$;

grant execute on function public.create_sale to authenticated;
