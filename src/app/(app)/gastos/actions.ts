"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { safeDbError } from "@/lib/errors";
import { gastoSchema, primerMensajeDeError } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function crearGasto(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = gastoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: primerMensajeDeError(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    ...parsed.data,
    business_id: ctx.business.id,
    created_by: ctx.profile.id,
  });

  if (error) return { ok: false, error: safeDbError(error) };
  revalidatePath("/gastos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function eliminarGasto(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) return { ok: false, error: safeDbError(error) };
  revalidatePath("/gastos");
  revalidatePath("/dashboard");
  return { ok: true };
}
