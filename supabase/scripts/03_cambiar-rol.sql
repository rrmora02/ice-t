-- =====================================================================
-- Ice-T · Cambiar el rol de un usuario (vendedor <-> admin)
-- =====================================================================
-- Se pega en el SQL Editor de Supabase. Cambia sólo las dos líneas
-- marcadas con <<< y ejecuta todo el bloque.
--
-- POR QUÉ NO BASTA UN UPDATE NORMAL
-- `profiles` tiene el trigger `protect_profile_privileged_columns`, que
-- impide cambiar `role`, `active` o `business_id` a quien no sea admin. En
-- el SQL Editor no hay sesión de usuario, así que `auth.uid()` es nulo,
-- `is_admin()` da falso y un UPDATE directo falla con:
--
--   ERROR: No tienes permiso para cambiar estos campos de tu perfil
--
-- Este script no desactiva el trigger (dejarlo apagado por accidente
-- abriría un agujero). En su lugar se identifica, sólo durante esta
-- transacción, como un administrador que ya existe en ese mismo negocio.
-- =====================================================================

do $$
declare
  -- <<< CAMBIA ESTO: correo de la persona a la que le cambias el rol
  v_correo text := 'maria@ejemplo.com';
  -- <<< CAMBIA ESTO: 'admin' para ascender, 'vendedor' para degradar
  v_rol_nuevo text := 'admin';

  v_perfil   record;
  v_admin_id uuid;
  v_admins   int;
begin
  if v_rol_nuevo not in ('admin', 'vendedor') then
    raise exception 'El rol debe ser admin o vendedor, no %', v_rol_nuevo;
  end if;

  select id, business_id, role, full_name, active
    into v_perfil
    from public.profiles
   where lower(email) = lower(trim(v_correo));

  if not found then
    raise exception 'No hay ningún usuario con el correo %. Revisa que esté bien escrito.', v_correo;
  end if;

  if v_perfil.role = v_rol_nuevo then
    raise notice '% ya tiene el rol %. No se cambió nada.', v_perfil.full_name, v_rol_nuevo;
    return;
  end if;

  -- Un negocio no se puede quedar sin administradores: nadie podría
  -- volver a gestionar precios, gastos ni vendedores.
  if v_rol_nuevo = 'vendedor' then
    select count(*) into v_admins
      from public.profiles
     where business_id = v_perfil.business_id and role = 'admin' and active;
    if v_admins <= 1 then
      raise exception 'No se puede degradar: % es el único administrador activo del negocio.', v_perfil.full_name;
    end if;
  end if;

  -- Identidad prestada para pasar el trigger (sólo dentro de esta
  -- transacción; al terminar se descarta sola).
  select id into v_admin_id
    from public.profiles
   where business_id = v_perfil.business_id
     and role = 'admin'
     and active
     and id <> v_perfil.id
   limit 1;

  if v_admin_id is null then
    raise exception 'El negocio no tiene otro administrador activo desde el cual autorizar el cambio.';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);

  update public.profiles
     set role = v_rol_nuevo
   where id = v_perfil.id;

  raise notice 'Listo: % pasó de % a %.', v_perfil.full_name, v_perfil.role, v_rol_nuevo;
end $$;

-- Comprobación: así queda el equipo del negocio.
select
  full_name as nombre,
  email     as correo,
  role      as rol,
  case when active then 'activo' else 'inactivo' end as estado
from public.profiles
order by role, full_name;
