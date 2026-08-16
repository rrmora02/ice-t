import "server-only";

/**
 * Traduce un error de Postgres/PostgREST a un mensaje seguro para mostrar
 * al usuario.
 *
 * Devolver `error.message` tal cual filtra detalle interno de la base
 * (nombres de tablas y columnas, constraints, políticas RLS) a cualquiera
 * que sepa provocar el error. Aquí sólo dejamos pasar los mensajes que
 * nosotros mismos escribimos con `raise exception` en las funciones RPC —
 * esos sí están redactados para el usuario final — y el detalle completo
 * se manda a los logs del servidor para poder depurar.
 */
export function safeDbError(error: unknown, fallback = "No se pudo completar la operación."): string {
  if (!error || typeof error !== "object") return fallback;

  const { message, code, details, hint } = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  console.error("[db]", { code, message, details, hint });

  switch (code) {
    case "23505":
      return "Ese registro ya existe.";
    case "23503":
      return "El registro hace referencia a algo que ya no existe.";
    case "23514":
      return "Alguno de los datos está fuera del rango permitido.";
    case "42501":
      return "No tienes permiso para hacer esto.";
  }

  // P0001 = raise_exception: son los mensajes en español que escribimos
  // nosotros en las funciones RPC, seguros de mostrar.
  if (code === "P0001" && message) return message;

  return fallback;
}
