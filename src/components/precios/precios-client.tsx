"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Snowflake, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { productoSchema } from "@/lib/validation";
import { crearProducto, actualizarProducto, eliminarProducto } from "@/app/(app)/precios/actions";
import type { IceProduct } from "@/types/db";
import type { z } from "zod";

type FormValues = z.infer<typeof productoSchema>;
type FormInput = z.input<typeof productoSchema>;

const defaultValues: FormInput = {
  name: "",
  unit: "pieza",
  is_bulk: false,
  price: 0,
  sort_order: 0,
  active: true,
};

export function PreciosClient({
  initialProducts,
  currency,
}: {
  initialProducts: IceProduct[];
  currency: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activos = products.filter((p) => p.active);
  const inactivos = products.filter((p) => !p.active);

  function handleEdit(p: IceProduct) {
    setEditingId(p.id);
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm("¿Desactivar esta presentación? Ya no aparecerá al registrar ventas.")) return;
    startTransition(async () => {
      const res = await eliminarProducto(id);
      if (!res.ok) {
        setError(res.error ?? "No se pudo desactivar");
        return;
      }
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active: false } : p)));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activos.map((p) =>
          editingId === p.id ? (
            <ProductoForm
              key={p.id}
              defaultValues={p}
              currency={currency}
              onCancel={() => setEditingId(null)}
              onSubmit={async (values) => {
                const res = await actualizarProducto(p.id, values);
                if (!res.ok) return res.error;
                setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...values } : x)));
                setEditingId(null);
              }}
            />
          ) : (
            <div key={p.id} className="card flex flex-col gap-3 p-4 animate-fade-in-up">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white">
                    <Snowflake className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{p.name}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {p.is_bulk ? `Por ${p.unit}` : "Por pieza"}
                    </p>
                  </div>
                </div>
                {p.is_bulk && <Badge tone="brand">Granel</Badge>}
              </div>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(p.price, currency)}
                {p.is_bulk && <span className="text-sm font-medium text-[var(--foreground-muted)]"> /{p.unit}</span>}
              </p>
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(p)} className="flex-1">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} disabled={pending}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            </div>
          )
        )}

        {showForm ? (
          <ProductoForm
            currency={currency}
            onCancel={() => setShowForm(false)}
            onSubmit={async (values) => {
              const res = await crearProducto(values);
              if (!res.ok) return res.error;
              setShowForm(false);
              // Forzamos recarga de datos vía revalidatePath (server); para UX
              // instantánea agregamos un placeholder optimista.
              setProducts((prev) => [
                ...prev,
                { ...values, id: `tmp-${Date.now()}`, business_id: "", created_at: "", updated_at: "" } as IceProduct,
              ]);
            }}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="card flex min-h-[190px] flex-col items-center justify-center gap-2 border-dashed p-4 text-[var(--foreground-muted)] hover:text-sky-500"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Nueva presentación</span>
          </button>
        )}
      </div>

      {inactivos.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium text-[var(--foreground-muted)]">
            Presentaciones desactivadas ({inactivos.length})
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {inactivos.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await actualizarProducto(p.id, { active: true });
                      if (res.ok) setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: true } : x)));
                    })
                  }
                >
                  Reactivar
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ProductoForm({
  defaultValues: dv,
  currency,
  onCancel,
  onSubmit,
}: {
  defaultValues?: Partial<FormInput>;
  currency: string;
  onCancel: () => void;
  onSubmit: (values: FormValues) => Promise<string | undefined | void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: { ...defaultValues, ...dv },
  });

  const isBulk = watch("is_bulk");

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setSaving(true);
        setServerError(null);
        const err = await onSubmit(values);
        setSaving(false);
        if (err) setServerError(err);
      })}
      className="card flex flex-col gap-3 p-4"
    >
      {serverError && <p className="text-xs font-medium text-rose-500">{serverError}</p>}

      <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="Bolsa 1 kg" {...register("name")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio" htmlFor="price" error={errors.price?.message}>
          <Input id="price" type="number" step="0.01" min="0" {...register("price")} />
        </Field>
        <Field label="Unidad">
          <Select {...register("unit")}>
            <option value="pieza">Pieza</option>
            <option value="kg">Kilogramo</option>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 rounded" {...register("is_bulk")} />
        Es venta a granel (permite cantidades decimales, ej. {formatCurrency(1, currency)}/kg)
      </label>
      {isBulk && (
        <p className="text-xs text-[var(--foreground-muted)]">
          El precio a granel normalmente es un poco más bajo por unidad que las bolsas.
        </p>
      )}

      <div className="mt-1 flex gap-2">
        <Button type="submit" size="sm" loading={saving} className="flex-1">
          <Check className="h-3.5 w-3.5" /> Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </form>
  );
}
