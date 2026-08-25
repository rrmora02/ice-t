-- =====================================================================
-- Ice-T · Ventas por cliente y día
-- =====================================================================
-- Ejecutar DESPUÉS de 0004_security_hardening.sql.
-- Es idempotente: se puede correr más de una vez.
--
-- Permite responder "¿cuántas ventas y cuánto dinero hizo cada cliente
-- hoy?", que hasta ahora no se podía consultar desde ningún lado: el
-- dashboard sólo agregaba por día, por producto y por vendedor.
-- =====================================================================

create or replace view public.v_sales_by_customer
with (security_invoker = true) as
select
  s.business_id,
  s.customer_id,
  -- Las ventas sin cliente (mostrador) se agrupan todas juntas bajo un
  -- customer_id nulo; se les pone nombre aquí para no tener que
  -- resolverlo en cada pantalla.
  coalesce(c.name, 'Venta de mostrador') as customer_name,
  c.customer_type,
  -- Igual que el resto de vistas desde 0004: el día es el del negocio,
  -- no el del servidor.
  (s.sold_at at time zone b.timezone)::date as sale_date,
  count(*)        as sales_count,
  sum(s.total)    as total_amount,
  max(s.sold_at)  as last_sale_at
from public.sales s
join public.businesses b on b.id = s.business_id
left join public.customers c on c.id = s.customer_id
where s.status = 'completada'
group by
  s.business_id,
  s.customer_id,
  c.name,
  c.customer_type,
  (s.sold_at at time zone b.timezone)::date;

comment on view public.v_sales_by_customer is
  'Ventas agrupadas por cliente y día (en la zona horaria del negocio). Hereda RLS de sales: un vendedor sólo ve las suyas; un admin, las de todo el negocio.';
