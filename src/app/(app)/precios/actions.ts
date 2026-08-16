"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { productoSchema } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function crearProducto(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ice_products").insert({
    ...parsed.data,
    business_id: ctx.business.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/precios");
  return { ok: true };
}

export async function actualizarProducto(id: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productoSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ice_products").update(parsed.data).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/precios");
  return { ok: true };
}

export async function eliminarProducto(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  // Baja lógica: si el producto ya tiene ventas asociadas conviene
  // conservar el historial en vez de borrar filas.
  const { error } = await supabase.from("ice_products").update({ active: false }).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/precios");
  return { ok: true };
}
