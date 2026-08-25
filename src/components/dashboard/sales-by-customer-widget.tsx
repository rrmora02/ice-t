"use client";

import { useEffect, useState, useTransition } from "react";
import { Users, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { shiftISODate } from "@/lib/business-date";
import type { SalesByCustomerRow } from "@/types/db";

/**
 * Detalle de ventas por cliente en un día concreto.
 *
 * El dashboard sólo agregaba por día, producto y vendedor, así que no
 * había forma de responder "¿cuánto me compró cada cliente hoy?". El día
 * es consultable porque en la práctica se revisa tanto el corte de hoy
 * como el de ayer al cerrar cuentas.
 *
 * La consulta va contra `v_sales_by_customer`, que hereda RLS de `sales`:
 * un admin ve todo el negocio y un vendedor sólo sus propias ventas.
 */
export function SalesByCustomerWidget({
  initialRows,
  initialDate,
  today,
  businessId,
  currency,
}: {
  initialRows: SalesByCustomerRow[];
  initialDate: string;
  /** Hoy en la zona horaria del negocio; tope del selector de fecha. */
  today: string;
  businessId: string;
  currency: string;
}) {
  const [date, setDate] = useState(initialDate);
  // Caché por día: el servidor ya mandó el de hoy, y navegar con las
  // flechas entre días ya vistos no vuelve a consultar.
  const [porDia, setPorDia] = useState<Record<string, SalesByCustomerRow[]>>({
    [initialDate]: initialRows,
  });
  const [diaConError, setDiaConError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows = porDia[date];
  const cargando = rows === undefined && diaConError !== date;

  useEffect(() => {
    // Ya está en caché (o falló y no vale la pena reintentar solo).
    if (rows !== undefined || diaConError === date) return;

    let cancelado = false;
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("v_sales_by_customer")
        .select("*")
        .eq("business_id", businessId)
        .eq("sale_date", date)
        .order("total_amount", { ascending: false });

      // Si mientras viajaba la respuesta el usuario cambió de día otra
      // vez, se descarta para no pintar datos que no corresponden.
      if (cancelado) return;

      if (error) {
        setDiaConError(date);
        return;
      }
      setPorDia((prev) => ({
        ...prev,
        [date]: (data ?? []) as SalesByCustomerRow[],
      }));
    });

    return () => {
      cancelado = true;
    };
  }, [date, rows, diaConError, businessId]);

  const filas = rows ?? [];
  const totalDia = filas.reduce((s, r) => s + Number(r.total_amount), 0);
  const ventasDia = filas.reduce((s, r) => s + Number(r.sales_count), 0);
  const esHoy = date === today;

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4.5 w-4.5 text-sky-500" />
          <p className="text-sm font-semibold">Ventas por cliente</p>
          {esHoy && <Badge tone="brand">Hoy</Badge>}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => setDate((d) => shiftISODate(d, -1))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--foreground-muted)] hover:text-sky-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Input
            type="date"
            aria-label="Día a consultar"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 w-[10.5rem]"
          />
          <button
            type="button"
            aria-label="Día siguiente"
            disabled={esHoy}
            onClick={() => setDate((d) => shiftISODate(d, 1))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--foreground-muted)] hover:text-sky-500 disabled:opacity-40 disabled:hover:text-[var(--foreground-muted)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--foreground-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : diaConError === date ? (
        <p className="py-4 text-sm font-medium text-rose-500">
          No se pudieron cargar las ventas de ese día.
        </p>
      ) : filas.length === 0 ? (
        <p className="py-4 text-sm text-[var(--foreground-muted)]">
          {esHoy
            ? "Todavía no hay ventas registradas hoy."
            : `No hubo ventas el ${formatDate(date)}.`}
        </p>
      ) : (
        <>
          <div className="flex flex-col">
            {filas.map((r) => (
              <div
                key={r.customer_id ?? "mostrador"}
                className="border-b border-[var(--border)] py-2.5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {r.customer_name}
                    </span>
                    <Badge tone="neutral" className="shrink-0">
                      {r.sales_count} {r.sales_count === 1 ? "venta" : "ventas"}
                    </Badge>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(Number(r.total_amount), currency)}
                  </span>
                </div>

                {/* Desglose de lo que se llevó: "14 × Bolsa 1 kg". Las
                    cantidades pasan por formatNumber porque el hielo a
                    granel se vende en decimales (2.5 kg). */}
                {r.products.length > 0 && (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
                    {r.products
                      .map(
                        (p) =>
                          `${formatNumber(Number(p.quantity))} × ${p.name}`,
                      )
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="text-xs text-[var(--foreground-muted)]">
              {filas.length} {filas.length === 1 ? "cliente" : "clientes"} ·{" "}
              {ventasDia} {ventasDia === 1 ? "venta" : "ventas"}
            </span>
            <span className="text-base font-bold tabular-nums">
              {formatCurrency(totalDia, currency)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
