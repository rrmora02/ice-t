import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";

const PUBLIC_PATHS = ["/login", "/registro", "/manifest.webmanifest", "/sw.js", "/icons", "/offline.html"];
const ADMIN_ONLY_PREFIXES = ["/precios", "/gastos", "/vendedores"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

/**
 * Refresca la sesión de Supabase en cada request (recomendado por
 * @supabase/ssr) y aplica control de acceso por autenticación + rol
 * ANTES de que la petición llegue a cualquier Server Component. Esto es
 * la primera línea de defensa; las políticas RLS son la segunda (y la
 * que realmente importa si algo aquí se equivoca).
 *
 * Criterio general: ante cualquier duda, se cierra el paso. Un fallo de
 * configuración o una consulta que no responde no deben traducirse en
 * acceso concedido.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin credenciales de Supabase no hay forma de comprobar la sesión. Antes
  // se dejaba pasar la petición, lo que dejaba toda la app accesible sin
  // autenticar si faltaba una variable de entorno en el despliegue.
  if (!url || !anonKey) {
    if (isPublicPath(pathname)) return response;
    console.error("[proxy] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return new NextResponse("Servicio no disponible", { status: 503 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    // Se guarda el destino sólo si es una ruta interna reconocida, para no
    // reflejar en la URL de login un valor arbitrario del atacante.
    const next = safeNextPath(pathname, "");
    if (next) redirectUrl.searchParams.set("next", next);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    return redirectTo(request, "/dashboard");
  }

  if (user && ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // Si el perfil no se puede leer (error de red, RLS, perfil aún sin
    // crear) NO se asume que es admin: se manda al dashboard, que ya
    // resuelve el caso con requireSession().
    if (error || !profile || profile.role !== "admin") {
      return redirectTo(request, "/dashboard");
    }
  }

  return response;
}
