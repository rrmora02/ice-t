"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const perfilSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export async function actualizarPerfil(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession();
  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", ctx.userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/configuracion");
  return { ok: true };
}

const negocioSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export async function actualizarNegocio(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = negocioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("businesses").update({ name: parsed.data.name }).eq("id", ctx.business.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/configuracion");
  return { ok: true };
}
