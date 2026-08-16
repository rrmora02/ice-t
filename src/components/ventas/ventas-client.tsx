"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, CheckCircle2, Clock3, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { getOfflineDB } from "@/lib/offline/db";
import { syncPendingSales } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";
import type { Customer, IceProduct, PaymentMethod, Sale, SaleCartItem, SaleItem, Role } from "@/types/db";

interface CartLine extends SaleCartItem {
  is_bulk: boolean;
  unit: string;
}

/**
 * Distingue "no hubo red" de "el servidor rechazó la venta".
 *
 * Importa porque el fallback offline sólo tiene sentido en el primer caso:
 * si el rechazo viene de una regla de negocio (producto de otro negocio,
 * cantidad inválida, perfil desactivado), encolar la venta la deja
 * reintentándose para siempre contra un error que nunca se va a arreglar
 * solo — y el vendedor cree que quedó registrada.
 */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch abortado / sin red
  const code = (err as { code?: string } | null)?.code;
  // PostgrestError siempre trae code (SQLSTATE o un código propio del
  // cliente); si no hay ninguno, se asume fallo de transporte.
  return !code;
}

export function VentasClient({
  products,
  customers,
  recentSales,
  currency,
  role,
  currentUserId,
}: {
  products: IceProduct[];
  customers: Customer[];
  recentSales: (Sale & { sale_items: SaleItem[] })[];
  businessId: string;
  currency: string;
  role: Role;
  currentUserId: string;
}) {
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customerId, setCustomerId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "offline" | "error"; message: string } | null>(null);
  const [localSales, setLocalSales] = useState(recentSales);

  // Cachea catálogo/clientes en IndexedDB para poder vender sin conexión.
  useEffect(() => {
    const db = getOfflineDB();
    if (!db) return;
    db.cachedProducts.bulkPut(products.map((p) => ({ ...p, business_id: p.business_id })));
    db.cachedCustomers.bulkPut(customers.map((c) => ({ ...c, business_id: c.business_id })));
  }, [products, customers]);

  const total = useMemo(
    () => Object.values(cart).reduce((sum, line) => sum + line.unit_price * line.quantity, 0),
    [cart]
  );
  const itemCount = Object.values(cart).filter((l) => l.quantity > 0).length;

  function setQty(product: IceProduct, quantity: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[product.id];
      } else {
        next[product.id] = {
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price,
          quantity,
          is_bulk: product.is_bulk,
          unit: product.unit,
        };
      }
      return next;
    });
  }

  function step(product: IceProduct, delta: number) {
    const current = cart[product.id]?.quantity ?? 0;
    const increment = product.is_bulk ? 0.5 : 1;
    const next = Math.max(0, Math.round((current + delta * increment) * 100) / 100);
    setQty(product, next);
  }

  async function handleSubmit() {
    if (itemCount === 0) return;
    setSubmitting(true);
    setFeedback(null);

    const clientUuid = crypto.randomUUID();
    const soldAt = new Date().toISOString();
    const items = Object.values(cart).map(({ product_id, product_name, unit_price, quantity }) => ({
      product_id,
      product_name,
      unit_price,
      quantity,
    }));
    const payload = {
      customer_id: customerId || null,
      items,
      payment_method: paymentMethod,
      client_uuid: clientUuid,
      sold_at: soldAt,
      notes: null as string | null,
    };

    const isOnline = typeof navigator === "undefined" || navigator.onLine;

    if (isOnline) {
      try {
        const supabase = createClient();
        const { error } = await supabase.rpc("create_sale", {
          p_customer_id: payload.customer_id,
          p_items: payload.items,
          p_payment_method: payload.payment_method,
          p_client_uuid: payload.client_uuid,
          p_sold_at: payload.sold_at,
          p_notes: payload.notes,
        });

        if (error) throw error;

        setFeedback({ type: "success", message: `Venta registrada por ${formatCurrency(total, currency)}.` });
        setLocalSales((prev) => [
          {
            id: clientUuid,
            business_id: "",
            vendedor_id: currentUserId,
            customer_id: payload.customer_id,
            total,
            payment_method: paymentMethod,
            status: "completada",
            client_uuid: clientUuid,
            sold_at: soldAt,
            notes: null,
            created_at: soldAt,
            sale_items: items.map((i, idx) => ({
              id: `${clientUuid}-${idx}`,
              sale_id: clientUuid,
              business_id: "",
              product_id: i.product_id,
              product_name_snapshot: i.product_name,
              unit_price: i.unit_price,
              quantity: i.quantity,
              subtotal: i.unit_price * i.quantity,
            })),
          },
          ...prev,
        ]);
        resetForm();
        setSubmitting(false);
        return;
      } catch (err) {
        // Sólo se cae al guardado offline si el problema fue la red. Un
        // rechazo del servidor se muestra tal cual: reintentarlo en
        // segundo plano no lo va a resolver.
        if (!isNetworkError(err)) {
          setFeedback({
            type: "error",
            message:
              (err as { message?: string })?.message ??
              "No se pudo registrar la venta. Revisa los datos e intenta de nuevo.",
          });
          setSubmitting(false);
          return;
        }
      }
    }

    // Sin conexión (o falló el intento online): encolar localmente.
    const db = getOfflineDB();
    if (db) {
      await db.pendingSales.put({
        client_uuid: clientUuid,
        business_id: "",
        customer_id: payload.customer_id,
        items,
        payment_method: paymentMethod,
        sold_at: soldAt,
        notes: null,
        created_at: soldAt,
        status: "pending",
        attempts: 0,
      });
      setFeedback({
        type: "offline",
        message: "Sin conexión: la venta se guardó en este dispositivo y se enviará automáticamente al reconectar.",
      });
      resetForm();
      syncPendingSales();
    } else {
      setFeedback({ type: "error", message: "No se pudo registrar la venta. Intenta de nuevo." });
    }
    setSubmitting(false);
  }

  function resetForm() {
    setCart({});
    setCustomerId("");
    setPaymentMethod("efectivo");
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => {
            const qty = cart[p.id]?.quantity ?? 0;
            return (
              <div key={p.id} className="card flex flex-col gap-2 p-3.5">
                <p className="text-sm font-semibold leading-tight">{p.name}</p>
                <p className="text-lg font-bold text-sky-500">
                  {formatCurrency(p.price, currency)}
                  {p.is_bulk && <span className="text-xs font-medium text-[var(--foreground-muted)]">/{p.unit}</span>}
                </p>
                <div className="mt-1 flex items-center justify-between rounded-lg bg-[var(--surface-muted)] p-1">
                  <button
                    onClick={() => step(p, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface)] shadow-sm active:scale-95"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold tabular-nums">
                    {p.is_bulk ? formatNumber(qty) : qty}
                  </span>
                  <button
                    onClick={() => step(p, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface)] shadow-sm active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <p className="col-span-full text-sm text-[var(--foreground-muted)]">
              Todavía no hay presentaciones de hielo configuradas. Ve a Precios para agregarlas.
            </p>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground-muted)]">
            {role === "admin" ? "Ventas recientes del negocio" : "Tus ventas recientes"}
          </h2>
          <div className="flex flex-col gap-2">
            {localSales.slice(0, 8).map((s) => (
              <div key={s.id} className="card flex items-center justify-between p-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock3 className="h-4 w-4 shrink-0 text-[var(--foreground-muted)]" />
                  <span className="truncate text-[var(--foreground-muted)]">{formatDateTime(s.sold_at)}</span>
                  <span className="truncate">
                    {s.sale_items.map((i) => i.product_name_snapshot).join(", ")}
                  </span>
                </div>
                <span className="shrink-0 font-semibold">{formatCurrency(s.total, currency)}</span>
              </div>
            ))}
            {localSales.length === 0 && (
              <p className="text-sm text-[var(--foreground-muted)]">Aún no hay ventas registradas.</p>
            )}
          </div>
        </div>
      </div>

      {/* Resumen del carrito */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="card flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4.5 w-4.5 text-sky-500" />
            <h2 className="font-semibold">Venta actual</h2>
            {itemCount > 0 && <Badge tone="brand">{itemCount} producto(s)</Badge>}
          </div>

          <Field label="Cliente (opcional)">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Venta de mostrador</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Forma de pago">
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="credito">Crédito</option>
            </Select>
          </Field>

          <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
            {Object.values(cart).length === 0 && (
              <p className="text-sm text-[var(--foreground-muted)]">Agrega productos con los botones + de la izquierda.</p>
            )}
            {Object.values(cart).map((line) => (
              <div key={line.product_id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground-muted)]">
                  {line.is_bulk ? formatNumber(line.quantity) : line.quantity} × {line.product_name}
                </span>
                <span className="font-medium">{formatCurrency(line.unit_price * line.quantity, currency)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="text-sm font-medium text-[var(--foreground-muted)]">Total</span>
            <span className="text-2xl font-bold">{formatCurrency(total, currency)}</span>
          </div>

          {feedback && (
            <div
              className={
                feedback.type === "success"
                  ? "flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
                  : feedback.type === "offline"
                    ? "flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400"
                    : "flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500"
              }
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{feedback.message}</span>
            </div>
          )}

          <Button size="lg" className="justify-center" disabled={itemCount === 0} loading={submitting} onClick={handleSubmit}>
            Registrar venta
          </Button>

          {customerId && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
              <User className="h-3.5 w-3.5" /> Se actualizará la fecha de reabasto de este cliente.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
