import { z } from "zod";

// Todas las mutaciones (Server Actions y Route Handlers) validan con estos
// esquemas ANTES de tocar la base de datos. Nunca confiar únicamente en la
// validación del formulario en el cliente.

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

const fechaOpcional = fechaISO
  .optional()
  .nullable()
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
  price: z.coerce.number().min(0, "El precio no puede ser negativo").max(1_000_000),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

export const clienteSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(120),
  customer_type: z.enum(["tienda", "restaurante", "particular", "otro"]),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  last_restock_date: fechaOpcional,
  next_restock_date: fechaOpcional,
  assigned_vendedor_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  active: z.boolean().default(true),
});

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  unit_price: z.number().min(0),
  quantity: z.number().gt(0).max(100_000),
});

export const createSaleSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  items: z.array(saleItemSchema).min(1, "Agrega al menos un producto"),
  payment_method: z.enum(["efectivo", "transferencia", "credito"]),
  client_uuid: z.string().uuid(),
  sold_at: z.string().datetime({ message: "Fecha/hora inválida" }),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
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
  unit_cost: z.coerce.number().min(0).max(10_000_000),
  quantity: z.coerce.number().gt(0).max(1_000_000),
  expense_date: fechaISO,
});

export const vendedorInviteSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email("Correo inválido"),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
