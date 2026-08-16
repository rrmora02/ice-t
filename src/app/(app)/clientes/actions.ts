"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { clienteSchema } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function crearCliente(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession();
  const parsed = clienteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    ...parsed.data,
    business_id: ctx.business.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function actualizarCliente(id: string, input: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = clienteSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(parsed.data).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function eliminarCliente(id: string): Promise<ActionResult> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "admin") {
    return { ok: false, error: "Sólo un administrador puede eliminar clientes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ active: false }).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}

/**
 * Registra una entrega y, opcionalmente, la próxima fecha de reabasto que
 * el cliente haya dado en ese momento ("en 3 días me surtes otra vez").
 * A propósito NO recalcula nada automático: si `nextRestockDate` viene
 * null, el cliente simplemente queda sin recordatorio hasta que alguien
 * lo capture de nuevo (manual por visita, no un ciclo fijo).
 */
export async function registrarEntrega(
  customerId: string,
  deliveryDate: string,
  nextRestockDate: string | null
): Promise<ActionResult> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ last_restock_date: deliveryDate, next_restock_date: nextRestockDate })
    .eq("id", customerId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true };
}
