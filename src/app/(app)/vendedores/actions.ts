"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vendedorInviteSchema, primerMensajeDeError } from "@/lib/validation";
import { safeDbError } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types/db";

export interface ActionResult {
  ok: boolean;
  error?: string;
  tempPassword?: string;
}

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Password temporal legible (el vendedor debe cambiarla desde
 * /configuracion). Usa el CSPRNG del sistema: `Math.random()` no es
 * criptográficamente seguro — su estado interno se puede reconstruir a
 * partir de unas pocas salidas, así que quien viera un par de contraseñas
 * temporales podría predecir las siguientes.
 */
function generateTempPassword(length = 14) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

/**
 * Confirma que `targetId` es un perfil del MISMO negocio que el admin que
 * llama. Imprescindible antes de cualquier operación con la service role
 * key, que ignora RLS por completo: sin esta comprobación, el id llega
 * desde el navegador y un admin podría operar sobre usuarios de otros
 * negocios.
 */
async function assertMiembroDelNegocio(
  supabase: SupabaseClient,
  businessId: string,
  targetId: string,
): Promise<{ ok: true; role: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, business_id")
    .eq("id", targetId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) return { ok: false, error: safeDbError(error) };
  if (!data)
    return { ok: false, error: "Ese usuario no pertenece a tu negocio." };
  return { ok: true, role: data.role as string };
}

/**
 * Cuenta los administradores activos del negocio, sin contar a `excluyendo`.
 *
 * Existe para una sola regla: un negocio nunca puede quedarse sin ningún
 * administrador activo. Si eso pasa, nadie puede volver a gestionar
 * precios, gastos ni cuentas, y recuperarlo exige entrar al SQL Editor de
 * Supabase.
 */
async function contarOtrosAdminsActivos(
  supabase: SupabaseClient,
  businessId: string,
  excluyendo: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("role", "admin")
    .eq("active", true)
    .neq("id", excluyendo);

  if (error) {
    console.error("[contarOtrosAdminsActivos]", error);
    return null;
  }
  return count ?? 0;
}

/**
 * Crea la cuenta de un vendedor. Usa la Service Role Key (sólo en el
 * servidor, nunca expuesta al cliente) porque `auth.admin.createUser` no
 * está disponible con la anon key. `requireAdmin()` ya garantiza que
 * quien llama es administrador del negocio.
 */
export async function crearVendedor(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = vendedorInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: primerMensajeDeError(parsed.error) };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
    });

  if (createError || !created.user) {
    // No se refleja el mensaje de Supabase tal cual: distingue entre
    // "correo ya registrado" y otros fallos, lo que permitiría sondear
    // qué correos existen en la plataforma.
    console.error("[crearVendedor] createUser", createError);
    return {
      ok: false,
      error:
        "No se pudo crear la cuenta. Verifica el correo e intenta de nuevo.",
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    business_id: ctx.business.id,
    role: "vendedor",
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
  });

  if (profileError) {
    // Revertimos la cuenta huérfana en auth para no dejar basura.
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      ok: false,
      error: safeDbError(
        profileError,
        "No se pudo crear el perfil del vendedor.",
      ),
    };
  }

  revalidatePath("/vendedores");
  return { ok: true, tempPassword };
}

export async function actualizarEstadoVendedor(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (id === ctx.userId) {
    return { ok: false, error: "No puedes desactivarte a ti mismo." };
  }

  const supabase = await createClient();

  const miembro = await assertMiembroDelNegocio(supabase, ctx.business.id, id);
  if (!miembro.ok) return { ok: false, error: miembro.error };

  // Desactivar al último administrador dejaría el negocio sin quien pueda
  // gestionarlo.
  if (!active && miembro.role === "admin") {
    const otros = await contarOtrosAdminsActivos(supabase, ctx.business.id, id);
    if (otros === null)
      return { ok: false, error: "No se pudo verificar el estado del equipo." };
    if (otros === 0) {
      return {
        ok: false,
        error:
          "Es el único administrador activo. Nombra a otro antes de desactivarlo.",
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  if (error) return { ok: false, error: safeDbError(error) };
  revalidatePath("/vendedores");
  return { ok: true };
}

/**
 * Regenera la contraseña de un vendedor del negocio.
 *
 * `updateUserById` corre con la service role key, que ignora RLS y puede
 * tocar CUALQUIER usuario del proyecto de Supabase — incluidos los
 * administradores de otros negocios. Por eso el `id` que llega del
 * navegador se valida antes contra `profiles`: debe existir, pertenecer al
 * mismo negocio y ser un vendedor (un admin no puede resetear la
 * contraseña de otro admin; para eso está el flujo de "olvidé mi
 * contraseña" de Supabase Auth).
 */
export async function resetPasswordVendedor(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();

  if (id === ctx.userId) {
    return {
      ok: false,
      error: "Cambia tu propia contraseña desde Configuración.",
    };
  }

  const supabase = await createClient();

  const miembro = await assertMiembroDelNegocio(supabase, ctx.business.id, id);
  if (!miembro.ok) return { ok: false, error: miembro.error };

  if (miembro.role !== "vendedor") {
    return {
      ok: false,
      error: "Sólo se puede regenerar la contraseña de un vendedor.",
    };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: tempPassword,
  });
  if (error) {
    console.error("[resetPasswordVendedor] updateUserById", error);
    return { ok: false, error: "No se pudo regenerar la contraseña." };
  }

  return { ok: true, tempPassword };
}

/**
 * Cambia el rol de un miembro del negocio entre `admin` y `vendedor`.
 *
 * No hace falta la service role key: quien llama ya es administrador, así
 * que la política RLS `profiles_update_self_or_admin` y el trigger
 * `protect_profile_privileged_columns` permiten el cambio con la sesión
 * normal. (Ese trigger es justo el que impide hacerlo con un UPDATE suelto
 * desde el SQL Editor, donde no hay sesión.)
 */
export async function cambiarRolMiembro(
  id: string,
  nuevoRol: Role,
): Promise<ActionResult> {
  const ctx = await requireAdmin();

  if (nuevoRol !== "admin" && nuevoRol !== "vendedor") {
    return { ok: false, error: "Rol inválido." };
  }

  // Cambiarse el rol a uno mismo sólo sirve para quitarse permisos y
  // quedar fuera de esta pantalla; que lo haga otro administrador.
  if (id === ctx.userId) {
    return {
      ok: false,
      error: "No puedes cambiar tu propio rol. Pídeselo a otro administrador.",
    };
  }

  const supabase = await createClient();

  const miembro = await assertMiembroDelNegocio(supabase, ctx.business.id, id);
  if (!miembro.ok) return { ok: false, error: miembro.error };

  if (miembro.role === nuevoRol) {
    return { ok: false, error: "Esa persona ya tiene ese rol." };
  }

  if (nuevoRol === "vendedor") {
    const otros = await contarOtrosAdminsActivos(supabase, ctx.business.id, id);
    if (otros === null)
      return { ok: false, error: "No se pudo verificar el estado del equipo." };
    if (otros === 0) {
      return {
        ok: false,
        error:
          "Es el único administrador activo. Nombra a otro antes de quitarle el rol.",
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: nuevoRol })
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  if (error) return { ok: false, error: safeDbError(error) };
  revalidatePath("/vendedores");
  return { ok: true };
}
