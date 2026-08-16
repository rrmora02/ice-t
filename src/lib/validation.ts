import { z } from "zod";

// Todas las mutaciones (Server Actions y Route Handlers) validan con estos
// esquemas ANTES de tocar la base de datos. Nunca confiar únicamente en la
// validación del formulario en el cliente.

/**
 * Campo numérico de formulario.
 *
 * `z.coerce.number()` a secas no sirve aquí: convierte `""` en `0`, así que
 * un campo vacío se guardaba como cero en silencio (un gasto sin costo, una
 * cantidad sin capturar) en vez de avisar. Este helper distingue los tres
 * casos —vacío, no numérico y fuera de rango— y devuelve mensajes en
 * español; los de zod por defecto salen en inglés y hablan de "Number".
 *
 * También acepta coma decimal (12,5), habitual al teclear en móvil.
 *
 * Los mensajes están redactados para servir con cualquier género: se dice
 * "no puede ser un número negativo" y no "no puede ser negativo/a".
 */
function campoNumerico(
  etiqueta: string,
  { max, minimo = "cero" }: { max: number; minimo?: "cero" | "mayor-a-cero" }
) {
  return z.preprocess(
    (v) => {
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const limpio = v.trim().replace(",", ".");
        if (limpio === "") return undefined;
        const n = Number(limpio);
        return Number.isFinite(n) ? n : NaN;
      }
      return v;
    },
    z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? `Falta ${etiqueta.toLowerCase()}.`
            : `${etiqueta} debe ser un número.`,
      })
      .refine(
        (v) => (minimo === "cero" ? v >= 0 : v > 0),
        minimo === "cero"
          ? `${etiqueta} no puede ser un número negativo.`
          : `${etiqueta} debe ser mayor a cero.`
      )
      .refine((v) => v <= max, `${etiqueta} no puede pasar de ${max.toLocaleString("es-MX")}.`)
  );
}

/**
 * Campo de texto opcional que se normaliza a `null` cuando viene vacío.
 *
 * INVARIANTE IMPORTANTE: estos esquemas se aplican DOS veces sobre el mismo
 * dato. El formulario valida en el navegador y react-hook-form entrega al
 * server action la SALIDA ya transformada; el server action vuelve a
 * parsear esa salida (no confía en el cliente). Por eso el esquema tiene
 * que aceptar su propio resultado: si transforma `""` en `null`, tiene que
 * admitir `null` como entrada válida.
 *
 * Antes estos campos eran `.optional().or(z.literal(""))`, que acepta
 * `undefined` y `""` pero NO `null`. El navegador convertía `""` en `null`,
 * lo mandaba al servidor y el servidor rechazaba ese `null` con el mensaje
 * genérico de zod, "Invalid input" — así que guardar un cliente nuevo
 * fallaba siempre y sin explicación útil.
 */
function textoOpcional(max: number, etiqueta: string) {
  return z
    .string()
    .trim()
    .max(max, `${etiqueta} no puede pasar de ${max} caracteres.`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
}

/**
 * Fecha en formato ISO corto (YYYY-MM-DD), tal como la entrega un
 * `<input type="date">`. Antes estos campos eran `z.string()` a secas, así
 * que cualquier cadena llegaba hasta Postgres y el error de parseo (con el
 * nombre de la columna) terminaba mostrándose al usuario.
 */
export const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

// Igual que textoOpcional: acepta null (su propia salida), "" y undefined.
const fechaOpcional = fechaISO
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const registroNegocioSchema = z.object({
  businessName: z.string().trim().min(2, "El nombre del negocio es muy corto").max(120),
  fullName: z.string().trim().min(2, "Tu nombre es muy corto").max(120),
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const completarRegistroSchema = z.object({
  businessName: z.string().trim().min(2, "El nombre del negocio es muy corto").max(120),
  fullName: z.string().trim().min(2, "Tu nombre es muy corto").max(120),
});

export const productoSchema = z.object({
  name: z.string().trim().min(2).max(80),
  unit: z.enum(["pieza", "kg"]),
  is_bulk: z.boolean(),
  price: campoNumerico("El precio", { max: 1_000_000 }),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

export const clienteSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(120),
  customer_type: z.enum(["tienda", "restaurante", "particular", "otro"]),
  phone: textoOpcional(30, "El teléfono"),
  address: textoOpcional(300, "La dirección"),
  notes: textoOpcional(500, "Las notas"),
  last_restock_date: fechaOpcional,
  next_restock_date: fechaOpcional,
  assigned_vendedor_id: z
    .string()
    .uuid("Vendedor asignado inválido")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  active: z.boolean().default(true),
});

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  // El servidor ignora este precio y usa el de ice_products (ver
  // create_sale en 0004_security_hardening.sql); se valida igual para no
  // aceptar payloads con basura.
  unit_price: campoNumerico("El precio", { max: 1_000_000 }),
  quantity: campoNumerico("La cantidad", { max: 100_000, minimo: "mayor-a-cero" }),
});

export const createSaleSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  items: z.array(saleItemSchema).min(1, "Agrega al menos un producto"),
  payment_method: z.enum(["efectivo", "transferencia", "credito"]),
  client_uuid: z.string().uuid(),
  sold_at: z.string().datetime({ message: "Fecha/hora inválida" }),
  notes: textoOpcional(500, "Las notas"),
});

export const entregaSchema = z.object({
  customerId: z.string().uuid(),
  deliveryDate: fechaISO,
  nextRestockDate: fechaOpcional,
});

export const gastoSchema = z.object({
  expense_type: z.enum(["capital", "operativo"]),
  category: z.enum(["equipo", "insumo", "transporte", "servicios", "otro"]),
  description: z.string().trim().min(2, "Describe el gasto").max(200),
  unit_cost: campoNumerico("El costo unitario", { max: 10_000_000 }),
  quantity: campoNumerico("La cantidad", { max: 1_000_000, minimo: "mayor-a-cero" }),
  expense_date: fechaISO,
});

export const vendedorInviteSchema = z.object({
  fullName: z.string().trim().min(2, "El nombre es muy corto").max(120),
  email: z.string().trim().email("Correo inválido"),
  phone: textoOpcional(30, "El teléfono"),
});

/**
 * Primer mensaje de error de un ZodError, listo para mostrar al usuario.
 *
 * Cuando falla una unión (`.or(...)`), zod no sabe cuál de las ramas era la
 * intención y emite su mensaje genérico en inglés, "Invalid input", sin
 * decir el campo. Eso fue exactamente lo que vio el usuario al guardar un
 * cliente: un texto que no explica nada y no señala dónde mirar. Si el
 * mensaje es uno de los nuestros se usa tal cual; si es genérico, al menos
 * se nombra el campo.
 */
export function primerMensajeDeError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Datos inválidos.";

  const esGenerico = !issue.message || /^invalid|^expected|^required/i.test(issue.message);
  if (!esGenerico) return issue.message;

  const campo = issue.path.join(".");
  return campo ? `El campo "${campo}" tiene un valor inválido.` : "Datos inválidos.";
}

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
