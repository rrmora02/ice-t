-- =====================================================================
-- Ice-T · Vistas de apoyo para dashboard, recordatorios y ROI
-- Las vistas heredan RLS de las tablas base (security_invoker = true en
-- PG15+; si tu proyecto es anterior, ver nota al final del archivo).
-- =====================================================================

-- Ventas diarias por negocio (para gráficas día/semana/mes)
create or replace view public.v_sales_daily
with (security_invoker = true) as
select
  business_id,
  (sold_at at time zone 'UTC')::date as sale_date,
  count(*) as sales_count,
  sum(total) as total_amount
from public.sales
where status = 'completada'
group by business_id, (sold_at at time zone 'UTC')::date;

-- Ventas por vendedor (para el dashboard de admin y del propio vendedor)
create or replace view public.v_sales_by_vendedor
with (security_invoker = true) as
select
  s.business_id,
  s.vendedor_id,
  p.full_name as vendedor_name,
  (s.sold_at at time zone 'UTC')::date as sale_date,
  count(*) as sales_count,
  sum(s.total) as total_amount
from public.sales s
join public.profiles p on p.id = s.vendedor_id
where s.status = 'completada'
group by s.business_id, s.vendedor_id, p.full_name, (s.sold_at at time zone 'UTC')::date;

-- Producto más vendido / mezcla de ventas por producto
create or replace view public.v_sales_by_product
with (security_invoker = true) as
select
  si.business_id,
  si.product_id,
  si.product_name_snapshot,
  (s.sold_at at time zone 'UTC')::date as sale_date,
  sum(si.quantity) as total_quantity,
  sum(si.subtotal) as total_amount
from public.sale_items si
join public.sales s on s.id = si.sale_id
where s.status = 'completada'
group by si.business_id, si.product_id, si.product_name_snapshot, (s.sold_at at time zone 'UTC')::date;

-- Clientes próximos a reabasto (usado por el dashboard y por la Edge
-- Function de recordatorios; days_until negativo = ya se pasó la fecha)
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
  (c.next_restock_date - current_date) as days_until
from public.customers c
where c.active = true
  and c.next_restock_date is not null
order by c.next_restock_date asc;

-- Resumen financiero / ROI por negocio: inversión (gastos de capital,
-- ej. máquina de hielo) vs. ganancia acumulada (ingresos - gastos
-- operativos), y si ya se recuperó la inversión.
create or replace view public.v_business_roi_summary
with (security_invoker = true) as
select
  b.id as business_id,
  coalesce(cap.total, 0) as capital_invested,
  coalesce(opx.total, 0) as total_operational_expenses,
  coalesce(inc.total, 0) as total_income,
  coalesce(inc.total, 0) - coalesce(opx.total, 0) as net_profit,
  greatest(coalesce(cap.total, 0) - (coalesce(inc.total, 0) - coalesce(opx.total, 0)), 0) as remaining_to_recover,
  (coalesce(inc.total, 0) - coalesce(opx.total, 0)) >= coalesce(cap.total, 0) as investment_recovered
from public.businesses b
left join (
  select business_id, sum(amount) as total from public.expenses where expense_type = 'capital' group by business_id
) cap on cap.business_id = b.id
left join (
  select business_id, sum(amount) as total from public.expenses where expense_type = 'operativo' group by business_id
) opx on opx.business_id = b.id
left join (
  select business_id, sum(total) as total from public.sales where status = 'completada' group by business_id
) inc on inc.business_id = b.id;

-- NOTA: `security_invoker` requiere PostgreSQL 15+ (Supabase lo trae por
-- defecto desde 2023). Si tu proyecto es anterior, sustituye por
-- `revoke all on <vista> from public, anon, authenticated;` + funciones
-- SECURITY INVOKER a medida, o contacta soporte de Supabase para
-- actualizar la versión de Postgres del proyecto.
