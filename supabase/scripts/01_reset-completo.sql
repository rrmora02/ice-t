-- =====================================================================
-- Ice-T · Reinicio completo de la base de datos
-- =====================================================================
--
--   ⚠️  DESTRUCTIVO E IRREVERSIBLE.
--
--   Borra TODOS los objetos de Ice-T (tablas, vistas, funciones,
--   triggers y políticas) y TODAS las cuentas de usuario del proyecto,
--   incluidos los administradores. No hay deshacer: si el proyecto
--   tiene algo que quieras conservar, expórtalo antes.
--
--   Sirve para reutilizar un proyecto de pruebas como producción,
--   dejándolo idéntico a lo que producen las migraciones del repo.
--
--   ANTES DE EJECUTAR, confirma en la esquina superior del panel que
--   estás en el proyecto correcto. Es el error más caro de esta guía.
--
--   No se toca la extensión `pgcrypto`: el esquema la necesita para
--   gen_random_uuid(), y dejarla instalada no arrastra ningún dato.
--
-- Después de correr este archivo, ejecuta en orden:
--   supabase/migrations/0001_init.sql
--   supabase/migrations/0002_views.sql
--   supabase/migrations/0003_manual_restock_reminders.sql
--   supabase/migrations/0004_security_hardening.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Quitar la tarea programada de recordatorios, si la habías creado
-- ---------------------------------------------------------------------
-- Va dentro de un bloque con captura de excepción porque falla si la
-- extensión pg_cron no está instalada o si la tarea no existe, y eso no
-- debe abortar el resto del script.
do $$
begin
  perform cron.unschedule('ice-t-restock-reminders');
  raise notice 'Tarea de cron eliminada.';
exception
  when others then
    raise notice 'Sin tarea de cron que eliminar (%).', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 2. Vistas
-- ---------------------------------------------------------------------
-- Primero las vistas: dependen de las tablas.
drop view if exists public.v_business_roi_summary cascade;
drop view if exists public.v_upcoming_restocks    cascade;
drop view if exists public.v_sales_by_product     cascade;
drop view if exists public.v_sales_by_vendedor    cascade;
drop view if exists public.v_sales_daily          cascade;

-- ---------------------------------------------------------------------
-- 3. Tablas
-- ---------------------------------------------------------------------
-- `cascade` se lleva por delante índices, triggers, políticas RLS y las
-- claves foráneas que apunten a cada tabla, así que no hay que
-- enumerarlos uno por uno. El orden va de las dependientes a las base.
drop table if exists public.reminder_log        cascade;
drop table if exists public.push_subscriptions  cascade;
drop table if exists public.expenses            cascade;
drop table if exists public.sale_items          cascade;
drop table if exists public.sales               cascade;
drop table if exists public.customers           cascade;
drop table if exists public.ice_products        cascade;
drop table if exists public.profiles            cascade;
drop table if exists public.businesses          cascade;

-- ---------------------------------------------------------------------
-- 4. Funciones
-- ---------------------------------------------------------------------
-- Van con su firma completa porque puede haber versiones anteriores con
-- otros argumentos conviviendo en el esquema.
drop function if exists public.create_sale(uuid, jsonb, text, uuid, timestamptz, text);
drop function if exists public.create_business_and_admin(text, text);
drop function if exists public.validate_customer_assigned_vendedor();
drop function if exists public.protect_profile_privileged_columns();
drop function if exists public.is_admin();
-- current_role es palabra reservada de Postgres; se entrecomilla para
-- que el analizador no la confunda con la función interna del mismo
-- nombre. Es la misma función que creó 0001_init.sql.
drop function if exists public."current_role"();
drop function if exists public.current_business_id();
drop function if exists public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Cuentas de usuario
-- ---------------------------------------------------------------------
-- Borrar las tablas NO borra las cuentas: viven en el esquema `auth`, que
-- administra Supabase. Si las dejas, esos correos siguen pudiendo iniciar
-- sesión y, al no encontrar perfil, la app los mandaría a crear un
-- negocio nuevo — justo lo que no quieres en producción.
delete from auth.users;

-- Si prefieres CONSERVAR una cuenta (por ejemplo la tuya), comenta la
-- línea de arriba y descomenta esta, con tu correo:
-- delete from auth.users where email <> 'tucorreo@tudominio.com';

commit;

-- ---------------------------------------------------------------------
-- 6. Comprobación
-- ---------------------------------------------------------------------
-- Las tres cuentas deben dar 0 y la lista de objetos venir vacía.
select
  (select count(*) from auth.users) as usuarios_restantes,
  (select count(*) from pg_tables
     where schemaname = 'public'
       and tablename in ('businesses','profiles','ice_products','customers',
                         'sales','sale_items','expenses','push_subscriptions',
                         'reminder_log')) as tablas_restantes,
  (select count(*) from pg_views
     where schemaname = 'public'
       and viewname like 'v\_%') as vistas_restantes;
