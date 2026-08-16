"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, X, Check, TrendingUp, PiggyBank, Wallet, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, todayLocalISODate } from "@/lib/format";
import { gastoSchema } from "@/lib/validation";
import { crearGasto, eliminarGasto } from "@/app/(app)/gastos/actions";
import type { BusinessRoiSummary, Expense, ExpenseCategory, ExpenseType } from "@/types/db";
import type { z } from "zod";

type FormValues = z.infer<typeof gastoSchema>;
type FormInput = z.input<typeof gastoSchema>;

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  equipo: "Equipo",
  insumo: "Insumo",
  transporte: "Transporte",
  servicios: "Servicios",
  otro: "Otro",
};

export function GastosClient({
  initialExpenses,
  roi,
  currency,
}: {
  initialExpenses: Expense[];
  roi: BusinessRoiSummary | null;
  currency: string;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"todos" | ExpenseType>("todos");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === "todos" ? expenses : expenses.filter((e) => e.expense_type === filter)),
    [expenses, filter]
  );

  const capital = roi?.capital_invested ?? 0;
  const netProfit = roi?.net_profit ?? 0;
  const progress = capital > 0 ? Math.min(100, Math.max(0, (netProfit / capital) * 100)) : 0;

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    eliminarGasto(id).then((res) => {
      if (!res.ok) {
        setError(res.error ?? "No se pudo eliminar");
        return;
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</div>}

      {/* Resumen de inversión / ROI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={PiggyBank}
          label="Inversión (capital)"
          value={formatCurrency(capital, currency)}
          tone="brand"
        />
        <SummaryCard
          icon={Wallet}
          label="Gastos operativos"
          value={formatCurrency(roi?.total_operational_expenses ?? 0, currency)}
          tone="warning"
        />
        <SummaryCard icon={TrendingUp} label="Ingresos totales" value={formatCurrency(roi?.total_income ?? 0, currency)} tone="success" />
        <SummaryCard
          icon={Trophy}
          label="Ganancia neta"
          value={formatCurrency(netProfit, currency)}
          tone={netProfit >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Recuperación de la inversión</p>
          {roi?.investment_recovered ? (
            <Badge tone="success">Inversión recuperada 🎉</Badge>
          ) : (
            <Badge tone="warning">
              Faltan {formatCurrency(roi?.remaining_to_recover ?? 0, currency)}
            </Badge>
          )}
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div
            className="h-full rounded-full brand-gradient transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--foreground-muted)]">
          Ganancia neta (ingresos − gastos operativos) vs. lo invertido en equipo. No incluye el
          gasto operativo del propio hielo vendido, sólo compara flujo neto contra inversión de capital.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["todos", "capital", "operativo"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                filter === f ? "brand-gradient text-white" : "bg-[var(--surface-muted)] text-[var(--foreground-muted)]"
              }`}
            >
              {f === "todos" ? "Todos" : f === "capital" ? "Inversión" : "Operativos"}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Nuevo gasto
        </Button>
      </div>

      {showForm && (
        <GastoForm
          currency={currency}
          onCancel={() => setShowForm(false)}
          onCreated={(gasto) => {
            setExpenses((prev) => [gasto, ...prev]);
            setShowForm(false);
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="card p-8 text-center text-sm text-[var(--foreground-muted)]">Sin gastos registrados.</div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="card flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{e.description}</p>
                <Badge tone={e.expense_type === "capital" ? "brand" : "neutral"}>
                  {e.expense_type === "capital" ? "Inversión" : "Operativo"}
                </Badge>
                <Badge tone="neutral">{CATEGORY_LABEL[e.category]}</Badge>
              </div>
              <p className="text-xs text-[var(--foreground-muted)]">
                {formatDate(e.expense_date)} · {e.quantity} × {formatCurrency(e.unit_cost, currency)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-semibold">{formatCurrency(e.amount, currency)}</span>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "brand" | "success" | "warning" | "danger";
}) {
  const toneBg: Record<string, string> = {
    brand: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneBg[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-[var(--foreground-muted)]">{label}</p>
        <p className="truncate text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function GastoForm({
  currency,
  onCancel,
  onCreated,
}: {
  currency: string;
  onCancel: () => void;
  onCreated: (gasto: Expense) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      expense_type: "operativo",
      category: "insumo",
      description: "",
      unit_cost: 0,
      quantity: 1,
      expense_date: todayLocalISODate(),
    },
  });

  // `watch` devuelve lo que hay escrito en el campo (una cadena), no el
  // valor ya parseado por zod, así que la vista previa del total normaliza
  // la coma decimal y trata lo no numérico como 0 en vez de mostrar NaN.
  const aNumero = (v: unknown) => {
    const n = Number(String(v ?? "").trim().replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const unitCost = aNumero(watch("unit_cost"));
  const quantity = aNumero(watch("quantity"));

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setSaving(true);
        setServerError(null);
        const res = await crearGasto(values);
        setSaving(false);
        if (!res.ok) {
          setServerError(res.error ?? "No se pudo guardar");
          return;
        }
        onCreated({
          ...values,
          id: `tmp-${Date.now()}`,
          business_id: "",
          created_by: null,
          created_at: "",
          // A partir de los valores ya validados por zod, no de la vista
          // previa: es lo mismo que acaba de guardar el servidor.
          amount: Number((values.unit_cost * values.quantity).toFixed(2)),
        } as Expense);
      })}
      className="card flex flex-col gap-3 p-4"
    >
      {serverError && <p className="text-xs font-medium text-rose-500">{serverError}</p>}

      <Field label="Descripción" htmlFor="g-desc" error={errors.description?.message}>
        <Input id="g-desc" placeholder="Máquina de hielo, bolsas, gasolina…" {...register("description")} />
      </Field>

      {/* Los textos de estas opciones son largos ("Operativo (recurrente)"),
          así que en móvil van apilados: a media pantalla se cortaban. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <Select {...register("expense_type")}>
            <option value="operativo">Operativo (recurrente)</option>
            <option value="capital">Inversión (equipo)</option>
          </Select>
        </Field>
        <Field label="Categoría">
          <Select {...register("category")}>
            <option value="equipo">Equipo</option>
            <option value="insumo">Insumo</option>
            <option value="transporte">Transporte</option>
            <option value="servicios">Servicios</option>
            <option value="otro">Otro</option>
          </Select>
        </Field>
      </div>

      {/* En un teléfono de 360px, tres columnas dejaban ~100px por campo y
          el selector de fecha nativo no cabía. Costo y cantidad caben de a
          dos; la fecha ocupa el ancho completo hasta sm. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Costo unitario" htmlFor="g-cost" error={errors.unit_cost?.message}>
          <NumberInput id="g-cost" placeholder="0.00" {...register("unit_cost")} />
        </Field>
        <Field label="Cantidad" htmlFor="g-qty" error={errors.quantity?.message}>
          <NumberInput id="g-qty" placeholder="1" {...register("quantity")} />
        </Field>
        <Field
          label="Fecha"
          htmlFor="g-date"
          error={errors.expense_date?.message}
          className="col-span-2 sm:col-span-1"
        >
          <Input id="g-date" type="date" {...register("expense_date")} />
        </Field>
      </div>

      <p className="text-sm text-[var(--foreground-muted)]">
        Total: <span className="font-semibold text-[var(--foreground)]">{formatCurrency(unitCost * quantity, currency)}</span>
      </p>

      <div className="mt-1 flex gap-2">
        <Button type="submit" size="sm" loading={saving} className="flex-1 sm:flex-none">
          <Check className="h-3.5 w-3.5" /> Guardar gasto
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </form>
  );
}
