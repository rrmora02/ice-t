-- =====================================================================
-- Ice-T · Cliente obligatorio en las ventas + detalle de productos
-- =====================================================================
-- Ejecutar DESPUÉS de 0005_sales_by_customer.sql. Idempotente.
--
-- 1. `create_sale` deja de aceptar ventas sin cliente. Hasta ahora se
--    permitía `p_customer_id` nulo y esas ventas aparecían agrupadas como
--    "Venta de mostrador"; el negocio quiere que toda venta quede a
--    nombre de quien compró.
--
--    Las ventas anteriores sin cliente NO se tocan: siguen en el
--    histórico bajo "Venta de mostrador", que es lo correcto — el pasado
--    no se reescribe.
--
--    Para volver a permitirlas, basta con borrar el bloque marcado abajo.
--
-- 2. `v_sales_by_customer` gana una columna `products` con el desglose de
--    lo vendido a cada cliente ese día (nombre y cantidad), para poder
--    ver "10 × Bolsa 1 kg" y no sólo el total.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cliente obligatorio
-- ---------------------------------------------------------------------
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

  -- ---- Cliente obligatorio (borra este bloque para permitir mostrador) ----
  if p_customer_id is null then
    raise exception 'Toda venta debe registrarse a nombre de un cliente';
  end if;
  -- ------------------------------------------------------------------------

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


-- Los permisos se vuelven a fijar porque `create or replace function` los
-- conserva, pero si alguien recreó la función a mano podrían haberse
-- perdido. Es barato y deja el estado explícito.
revoke all on function public.create_sale(uuid, jsonb, text, uuid, timestamptz, text) from public;
grant execute on function public.create_sale(uuid, jsonb, text, uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Detalle de productos por cliente
-- ---------------------------------------------------------------------
-- `products` llega como un arreglo jsonb ya ordenado de mayor a menor
-- cantidad, para que la tarjeta del dashboard no tenga que ordenar ni
-- hacer una segunda consulta.
--
-- El desglose sale de `sale_items`, cuya política RLS refleja la de
-- `sales` (un vendedor sólo ve las suyas), así que el detalle respeta el
-- mismo aislamiento que el total.
create or replace view public.v_sales_by_customer
with (security_invoker = true) as
with ventas as (
  select
    s.id,
    s.business_id,
    s.customer_id,
    s.total,
    s.sold_at,
    (s.sold_at at time zone b.timezone)::date as sale_date
  from public.sales s
  join public.businesses b on b.id = s.business_id
  where s.status = 'completada'
),
productos as (
  select
    v.business_id,
    v.customer_id,
    v.sale_date,
    si.product_name_snapshot as product_name,
    sum(si.quantity) as quantity
  from ventas v
  join public.sale_items si on si.sale_id = v.id
  group by v.business_id, v.customer_id, v.sale_date, si.product_name_snapshot
),
productos_agg as (
  select
    business_id,
    customer_id,
    sale_date,
    jsonb_agg(
      jsonb_build_object('name', product_name, 'quantity', quantity)
      order by quantity desc, product_name
    ) as products
  from productos
  group by business_id, customer_id, sale_date
)
select
  v.business_id,
  v.customer_id,
  coalesce(c.name, 'Venta de mostrador') as customer_name,
  c.customer_type,
  v.sale_date,
  count(*)       as sales_count,
  sum(v.total)   as total_amount,
  max(v.sold_at) as last_sale_at,
  -- El join de arriba da como mucho una fila por grupo, así que
  -- `products` va en el GROUP BY y no necesita agregarse (jsonb no
  -- tiene max()).
  coalesce(pa.products, '[]'::jsonb) as products
from ventas v
left join public.customers c on c.id = v.customer_id
-- `is not distinct from` porque customer_id puede ser nulo en las ventas
-- de mostrador anteriores a esta migración; un `=` normal las perdería.
left join productos_agg pa
  on pa.business_id = v.business_id
 and pa.customer_id is not distinct from v.customer_id
 and pa.sale_date = v.sale_date
group by v.business_id, v.customer_id, c.name, c.customer_type, v.sale_date, pa.products;

comment on view public.v_sales_by_customer is
  'Ventas agrupadas por cliente y día (zona horaria del negocio), con el desglose de productos en `products`. Hereda RLS de sales/sale_items.';
