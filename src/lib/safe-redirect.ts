// Rutas internas a las que se permite redirigir tras iniciar sesión.
// Es una lista blanca de prefijos en vez de "cualquier cosa que empiece
// con /" para que un enlace preparado no pueda mandar al usuario a una
// ruta rara del propio dominio.
const ALLOWED_PREFIXES = [
  "/dashboard",
  "/ventas",
  "/clientes",
  "/precios",
  "/gastos",
  "/vendedores",
  "/configuracion",
];

/** true si la cadena trae espacios o caracteres de control. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x20) return true;
  }
  return false;
}

/**
 * Normaliza un destino de redirección recibido por querystring (`?next=`)
 * a una ruta interna segura.
 *
 * Sin esto, `/login?next=https://phishing.example` o el equivalente
 * protocolo-relativo `?next=//phishing.example` convierten el login en un
 * redirector abierto: el enlace se ve legítimo (es nuestro dominio) pero
 * deposita al usuario recién autenticado en un sitio ajeno.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;

  // Varios navegadores recortan espacios y caracteres de control antes de
  // resolver la URL, así que podrían esconder otro destino.
  if (hasControlChars(next)) return fallback;

  // Debe ser una ruta absoluta interna: un solo "/" inicial. "//host" y
  // "/\host" son protocolo-relativos y saldrían del dominio.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }

  const pathOnly = next.split(/[?#]/, 1)[0];

  // Un ":" en la ruta puede hacer que el valor se interprete como esquema.
  if (pathOnly.includes(":")) return fallback;

  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)
  );

  return allowed ? next : fallback;
}
