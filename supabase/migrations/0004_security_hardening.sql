-- =====================================================================
-- Ice-T · Endurecimiento de seguridad e integridad
-- =====================================================================
-- Ejecutar DESPUÉS de 0001_init.sql, 0002_views.sql y 0003.
-- Es idempotente: se puede correr más de una vez sin efectos raros.
--
-- Resumen de lo que corrige:
--   1. create_sale ya no confía en el precio que manda el cliente.
--   2. create_sale acota `sold_at` (evita ventas fechadas en el futuro o
--      en un pasado remoto por un reloj mal puesto o manipulado).
--   3. Se revoca EXECUTE de PUBLIC en las funciones (por defecto Postgres
--      se lo concede a todo el mundo, incluido el rol anon).
--   4. customers.assigned_vendedor_id debe pertenecer al mismo negocio.
--   5. Las vistas agregan por la zona horaria del negocio, no por UTC.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1-2. create_sale: precio autoritativo del servidor + fecha acotada
-- ---------------------------------------------------------------------
-- La versión anterior insertaba `unit_price` tal como venía en el JSON del
-- cliente. Como la venta se registra desde el navegador (y desde la cola
-- offline), cualquiera con la sesión de un vendedor podía registrar una
-- venta de 50 bolsas a $0.01 y descuadrar ingresos y ROI. El precio ahora
-- se lee siempre de ice_products dentro de la función.
--
-- Efecto secundario a tener en cuenta: una venta que se guardó offline y
-- se sincroniza después de que el admin cambió el precio se registra con
-- el precio VIGENTE AL SINCRONIZAR, no con el que vio el vendedor. Es el
-- intercambio deliberado: un desfase de precio es corregible, un precio
-- inventado por el cliente no.
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
  v_product record;
  v_quantity numeric;
  v_line_total numeric(10,2);
  v_sold_at timestamptz := coalesce(p_sold_at, now());
begin
  if v_vendedor_id is null then
    raise exception 'No autenticado';
  end if;

  select business_id into v_business_id
    from public.profiles
    where id = v_vendedor_id and active = true;

  if v_business_id is null then
    raise exception 'Perfil no encontrado, inactivo o sin negocio asignado';
  end if;

  -- Idempotencia (reintentos del sync offline). Se acota al negocio del
  -- vendedor para no devolver jamás el id de una venta de otro tenant.
  select id into v_sale_id
    from public.sales
    where client_uuid = p_client_uuid and business_id = v_business_id;

  if v_sale_id is not null then
    return v_sale_id;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'La venta tiene demasiadas líneas';
  end if;

  -- El reloj del dispositivo lo controla el usuario. Una venta "del
  -- futuro" ensucia los cortes del día y una muy antigua reescribiría
  -- históricos ya revisados.
  if v_sold_at > now() + interval '10 minutes' then
    v_sold_at := now();
  end if;

  if v_sold_at < now() - interval '30 days' then
    raise exception 'La fecha de la venta es demasiado antigua para registrarse';
  end if;

  if p_customer_id is not null then
    perform 1 from public.customers where id = p_customer_id and business_id = v_business_id;
    if not found then
      raise exception 'Cliente inválido para este negocio';
    end if;
  end if;

  insert into public.sales (business_id, vendedor_id, customer_id, payment_method, client_uuid, sold_at, notes, total)
  values (
    v_business_id,
    v_vendedor_id,
    p_customer_id,
    coalesce(p_payment_method, 'efectivo'),
    p_client_uuid,
    v_sold_at,
    p_notes,
    0
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- El nombre y el precio salen del catálogo, no del payload.
    select id, name, price into v_product
      from public.ice_products
      where id = (v_item->>'product_id')::uuid
        and business_id = v_business_id;

    if not found then
      raise exception 'Producto inválido para este negocio';
    end if;

    v_quantity := (v_item->>'quantity')::numeric;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;

    if v_quantity > 100000 then
      raise exception 'La cantidad está fuera de rango';
    end if;

    v_line_total := round(v_product.price * v_quantity, 2);

    insert into public.sale_items (sale_id, business_id, product_id, product_name_snapshot, unit_price, quantity, subtotal)
    values (v_sale_id, v_business_id, v_product.id, v_product.name, v_product.price, v_quantity, v_line_total);

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

-- ---------------------------------------------------------------------
-- 3. Permisos de ejecución explícitos
-- ---------------------------------------------------------------------
-- Postgres concede EXECUTE a PUBLIC automáticamente al crear una función.
-- Como estas son SECURITY DEFINER, conviene que sólo las pueda invocar el
-- rol `authenticated` (todas comprueban auth.uid() de todos modos, pero
-- reducir la superficie es gratis).
revoke all on function public.create_sale(uuid, jsonb, text, uuid, timestamptz, text) from public;
revoke all on function public.create_business_and_admin(text, text) from public;
revoke all on function public.current_business_id() from public;
revoke all on function public.current_role() from public;
revoke all on function public.is_admin() from public;

grant execute on function public.create_sale(uuid, jsonb, text, uuid, timestamptz, text) to authenticated;
grant execute on function public.create_business_and_admin(text, text) to authenticated;
grant execute on function public.current_business_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 4. assigned_vendedor_id tiene que ser del mismo negocio
-- ---------------------------------------------------------------------
-- La FK sólo exige que exista en profiles: no impide apuntar al perfil de
-- OTRO negocio. RLS filtra filas, no valida el destino de una FK, así que
-- hace falta un trigger.
create or replace function public.validate_customer_assigned_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_vendedor_id is not null then
    perform 1 from public.profiles
      where id = new.assigned_vendedor_id
        and business_id = new.business_id;
    if not found then
      raise exception 'El vendedor asignado no pertenece a este negocio';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_customer_assigned_vendedor on public.customers;
create trigger trg_validate_customer_assigned_vendedor
  before insert or update on public.customers
  for each row execute function public.validate_customer_assigned_vendedor();

-- ---------------------------------------------------------------------
-- 5. Vistas por zona horaria del negocio
-- ---------------------------------------------------------------------
-- Antes agrupaban por `(sold_at at time zone 'UTC')::date`. Con
-- America/Mexico_City (UTC-6) toda venta después de las 18:00 locales
-- caía en el día siguiente: el corte de "ventas de hoy" del dashboard no
-- coincidía con el día real del negocio.
create or replace view public.v_sales_daily
with (security_invoker = true) as
select
  s.business_id,
  (s.sold_at at time zone b.timezone)::date as sale_date,
  count(*) as sales_count,
  sum(s.total) as total_amount
from public.sales s
join public.businesses b on b.id = s.business_id
where s.status = 'completada'
group by s.business_id, (s.sold_at at time zone b.timezone)::date;

create or replace view public.v_sales_by_vendedor
with (security_invoker = true) as
select
  s.business_id,
  s.vendedor_id,
  p.full_name as vendedor_name,
  (s.sold_at at time zone b.timezone)::date as sale_date,
  count(*) as sales_count,
  sum(s.total) as total_amount
from public.sales s
join public.profiles p on p.id = s.vendedor_id
join public.businesses b on b.id = s.business_id
where s.status = 'completada'
group by s.business_id, s.vendedor_id, p.full_name, (s.sold_at at time zone b.timezone)::date;

create or replace view public.v_sales_by_product
with (security_invoker = true) as
select
  si.business_id,
  si.product_id,
  si.product_name_snapshot,
  (s.sold_at at time zone b.timezone)::date as sale_date,
  sum(si.quantity) as total_quantity,
  sum(si.subtotal) as total_amount
from public.sale_items si
join public.sales s on s.id = si.sale_id
join public.businesses b on b.id = si.business_id
where s.status = 'completada'
group by si.business_id, si.product_id, si.product_name_snapshot, (s.sold_at at time zone b.timezone)::date;

-- days_until también se calcula contra la fecha local del negocio: si no,
-- durante 6 horas cada noche el recordatorio se adelanta un día.
create or replace view public.v_upcoming_restocks
with (security_invoker = true) as
select
  c.id as customer_id,
  c.business_id,
  c.name,
  c.customer_type,
  c.phone,
  c.address,
  c.assigned_vendedor_id,
  c.next_restock_date,
  (c.next_restock_date - (now() at time zone b.timezone)::date) as days_until
from public.customers c
join public.businesses b on b.id = c.business_id
where c.active = true
  and c.next_restock_date is not null;
