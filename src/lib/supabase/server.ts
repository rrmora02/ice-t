import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Lee/escribe la sesión desde las cookies de Next.js.
 *
 * En Server Components (render) `cookies().set` lanza error porque no se
 * pueden mutar cookies durante el render; el try/catch lo ignora a
 * propósito — la sesión igual se refresca en el middleware, que sí puede
 * escribir cookies en cada request.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa tu archivo .env.local"
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Se llamó desde un Server Component durante el render; el
          // middleware se encarga de refrescar la sesión en ese caso.
        }
      },
    },
  });
}
