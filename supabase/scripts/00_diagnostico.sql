-- =====================================================================
-- Ice-T · Diagnóstico del estado de la base de datos
-- =====================================================================
-- SOLO LEE. No modifica nada. Ejecútalo primero para saber en qué estado
-- está el proyecto antes de decidir qué script de limpieza usar.
--
-- Cómo interpretarlo:
--   * Todo en "falta"        -> proyecto vacío: corre las migraciones 0001..0004.
--   * Todo "ok" + 0004 "ok"  -> esquema al día: puedes usar 02_borrar-datos.sql.
--   * Mezcla / 0004 "falta"  -> esquema viejo o a medias: usa 01_reset-completo.sql
--                               y vuelve a correr las cuatro migraciones.
-- =====================================================================

with esperado(tipo, nombre) as (
  values
    ('tabla',   'businesses'),
    ('tabla',   'profiles'),
    ('tabla',   'ice_products'),
    ('tabla',   'customers'),
    ('tabla',   'sales'),
    ('tabla',   'sale_items'),
    ('tabla',   'expenses'),
    ('tabla',   'push_subscriptions'),
    ('tabla',   'reminder_log'),
    ('vista',   'v_sales_daily'),
    ('vista',   'v_sales_by_vendedor'),
    ('vista',   'v_sales_by_product'),
    ('vista',   'v_upcoming_restocks'),
    ('vista',   'v_business_roi_summary'),
    ('función', 'set_updated_at'),
    ('función', 'current_business_id'),
    ('función', 'current_role'),
    ('función', 'is_admin'),
    ('función', 'protect_profile_privileged_columns'),
    ('función', 'create_business_and_admin'),
    ('función', 'create_sale'),
    ('función', 'validate_customer_assigned_vendedor')
)
select
  e.tipo,
  e.nombre,
  case
    when e.tipo = 'tabla' then
      coalesce((select 'ok' from pg_tables t
                 where t.schemaname = 'public' and t.tablename = e.nombre), 'FALTA')
    when e.tipo = 'vista' then
      coalesce((select 'ok' from pg_views v
                 where v.schemaname = 'public' and v.viewname = e.nombre), 'FALTA')
    else
      coalesce((select 'ok' from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = e.nombre
                 limit 1), 'FALTA')
  end as estado
from esperado e
order by
  case e.tipo when 'tabla' then 1 when 'vista' then 2 else 3 end,
  e.nombre;

-- ---------------------------------------------------------------------
-- ¿Se aplicó 0004_security_hardening.sql?
-- ---------------------------------------------------------------------
-- El trigger de validación de vendedor asignado sólo lo crea ese archivo,
-- así que sirve de marcador fiable.
select
  case when exists (
    select 1 from pg_trigger
    where tgname = 'trg_validate_customer_assigned_vendedor'
      and not tgisinternal
  ) then 'ok — 0004 aplicado'
  else 'FALTA — corre 0004_security_hardening.sql'
  end as migracion_0004;

-- ---------------------------------------------------------------------
-- Cuántos datos hay ahora mismo
-- ---------------------------------------------------------------------
-- Un bloque dinámico porque las tablas pueden no existir todavía.
do $$
declare
  v_tabla text;
  v_filas bigint;
  v_salida text := '';
begin
  foreach v_tabla in array array[
    'businesses','profiles','ice_products','customers',
    'sales','sale_items','expenses','push_subscriptions','reminder_log'
  ] loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = v_tabla) then
      execute format('select count(*) from public.%I', v_tabla) into v_filas;
      v_salida := v_salida || format('  %-20s %s', v_tabla, v_filas) || chr(10);
    else
      v_salida := v_salida || format('  %-20s (no existe)', v_tabla) || chr(10);
    end if;
  end loop;

  select count(*) into v_filas from auth.users;
  v_salida := v_salida || format('  %-20s %s', 'auth.users', v_filas);

  raise notice E'\nFilas por tabla:\n%', v_salida;
end $$;
