-- =====================================================================
-- Ice-T · Borrar sólo los datos, conservando el esquema
-- =====================================================================
--
--   ⚠️  DESTRUCTIVO E IRREVERSIBLE para los datos.
--
--   Deja las tablas, vistas, funciones y políticas RLS intactas, y vacía
--   negocios, usuarios, clientes, ventas y gastos.
--
--   ÚSALO SÓLO si 00_diagnostico.sql reporta el esquema completo y
--   "0004 aplicado". Si falta algo, usa 01_reset-completo.sql: dejar un
--   esquema viejo con datos nuevos es peor que empezar de cero.
--
--   Confirma en la esquina superior del panel que estás en el proyecto
--   correcto antes de ejecutar.
-- =====================================================================

begin;

-- Borrar las cuentas basta para arrastrar todo lo demás: profiles y
-- businesses.owner_id apuntan a auth.users con `on delete cascade`, y de
-- businesses cuelgan en cascada productos, clientes, ventas, gastos y
-- suscripciones push.
--
-- Aun así abajo se truncan las tablas de forma explícita: es idempotente
-- y deja el estado determinado aunque alguna fila hubiera quedado
-- huérfana en pruebas anteriores.
delete from auth.users;

-- Si prefieres CONSERVAR una cuenta, comenta la línea de arriba y
-- descomenta esta con tu correo. Ojo: entonces NO truncar profiles ni
-- businesses más abajo, o esa cuenta se queda sin negocio.
-- delete from auth.users where email <> 'tucorreo@tudominio.com';

truncate table
  public.reminder_log,
  public.sale_items,
  public.sales,
  public.expenses,
  public.push_subscriptions,
  public.customers,
  public.ice_products,
  public.profiles,
  public.businesses
restart identity cascade;

commit;

-- ---------------------------------------------------------------------
-- Comprobación: todo debe dar 0
-- ---------------------------------------------------------------------
select
  (select count(*) from auth.users)          as usuarios,
  (select count(*) from public.businesses)   as negocios,
  (select count(*) from public.profiles)     as perfiles,
  (select count(*) from public.customers)    as clientes,
  (select count(*) from public.sales)        as ventas,
  (select count(*) from public.expenses)     as gastos,
  (select count(*) from public.ice_products) as productos;
