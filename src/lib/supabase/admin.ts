import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la Service Role Key. IGNORA por completo RLS,
 * así que:
 *   - `import "server-only"` evita que este módulo se pueda importar
 *     jamás desde código de cliente/bundle del navegador.
 *   - Sólo debe usarse dentro de Route Handlers (`src/app/api/**`) que ya
 *     validaron sesión + rol admin manualmente antes de llamarlo.
 *   - La variable SUPABASE_SERVICE_ROLE_KEY nunca debe llevar el prefijo
 *     NEXT_PUBLIC_ y nunca debe commitearse (ver .env.local.example).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
