"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vendedorInviteSchema } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  tempPassword?: string;
}

function generateTempPassword() {
  // Password temporal legible (el vendedor debe cambiarla en su primer
  // inicio de sesión, ver /configuracion).
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !created.user) {
    return { ok: false, error: createError?.message ?? "No se pudo crear la cuenta" };
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
    return { ok: false, error: profileError.message };
  }

  revalidatePath("/vendedores");
  return { ok: true, tempPassword };
}

export async function actualizarEstadoVendedor(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (id === ctx.userId) {
    return { ok: false, error: "No puedes desactivarte a ti mismo." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/vendedores");
  return { ok: true };
}

export async function resetPasswordVendedor(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { error } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true, tempPassword };
}
