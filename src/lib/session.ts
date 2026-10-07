import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Business } from "@/types/db";

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  business: Business;
}

/**
 * Obtiene el perfil + negocio del usuario autenticado. Pensado para usarse
 * al inicio de Server Components / Route Handlers que requieren sesión.
 * Redirige a /login si no hay sesión, y a /registro/completar si el
 * usuario existe en auth pero aún no tiene perfil (negocio) asociado.
 *
 * Va envuelto en `cache()` de React: memoización con alcance de UNA
 * petición. Importa porque se llama dos veces por render —una en
 * `(app)/layout.tsx` y otra en la página— y cada llamada encadena tres
 * viajes a Supabase (getUser, profiles, businesses). Sin esto, un arranque
 * en frío del dashboard hacía seis viajes de ida y vuelta en cadena antes
 * de poder responder una sola línea de HTML.
 *
 * La caché no sobrevive a la petición, así que no hay riesgo de servirle a
 * alguien la sesión de otro.
 */
export const requireSession = cache(async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/registro/completar");
  }

  if (!profile.active) {
    redirect("/cuenta-desactivada");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", profile.business_id)
    .maybeSingle();

  if (!business) {
    redirect("/registro/completar");
  }

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile: profile as Profile,
    business: business as Business,
  };
});

/** Igual que requireSession pero además exige rol admin. */
export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "admin") {
    redirect("/dashboard");
  }
  return ctx;
}
