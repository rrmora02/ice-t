"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  X,
  Check,
  PackageCheck,
  Store,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, todayLocalISODate } from "@/lib/format";
import { clienteSchema } from "@/lib/validation";
import { crearCliente, actualizarCliente, desactivarCliente, registrarEntrega } from "@/app/(app)/clientes/actions";
import type { Customer, Profile, Role } from "@/types/db";
import type { z } from "zod";

type FormValues = z.infer<typeof clienteSchema>;
type FormInput = z.input<typeof clienteSchema>;

const TYPE_LABEL: Record<Customer["customer_type"], string> = {
  tienda: "Tienda",
  restaurante: "Restaurante",
  particular: "Particular",
  otro: "Otro",
};

const QUICK_DAYS = [1, 3, 5, 7, 15, 30];

function urgencyTone(daysUntil: number | null): { tone: "danger" | "warning" | "success" | "neutral"; label: string } {
  if (daysUntil === null) return { tone: "neutral", label: "Sin recordatorio" };
  if (daysUntil < 0) return { tone: "danger", label: `Vencido hace ${Math.abs(daysUntil)}d` };
  if (daysUntil === 0) return { tone: "warning", label: "Hoy" };
  if (daysUntil <= 3) return { tone: "warning", label: `En ${daysUntil}d` };
  return { tone: "success", label: `En ${daysUntil}d` };
}

function daysUntil(next: string | null): number | null {
  if (!next) return null;
  const today = new Date(todayLocalISODate());
  const target = new Date(next);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ClientesClient({
  initialCustomers,
  vendedores,
  currentUserId,
  role,
}: {
  initialCustomers: Customer[];
  vendedores: Profile[];
  currentUserId: string;
  role: Role;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [entregaFor, setEntregaFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [customers, query]);

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    startTransition(async () => {
      const res = await desactivarCliente(id);
      if (!res.ok) {
        setError(res.error ?? "No se pudo eliminar");
        return;
      }
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function handleRegistrarEntrega(id: string, nextRestockDate: string | null) {
    startTransition(async () => {
      const hoy = todayLocalISODate();
      const res = await registrarEntrega(id, hoy, nextRestockDate);
      if (!res.ok) {
        setError(res.error ?? "No se pudo registrar la entrega");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, last_restock_date: hoy, next_restock_date: nextRestockDate } : c))
      );
      setEntregaFor(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
          <Input
            placeholder="Buscar por nombre, dirección o teléfono…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => { setShowForm(true); setEditing(null); }} className="shrink-0">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      {(showForm || editing) && (
        <ClienteForm
          key={editing?.id ?? "new"}
          defaultValues={editing ?? undefined}
          vendedores={vendedores}
          currentUserId={currentUserId}
          role={role}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            if (editing) {
              const res = await actualizarCliente(editing.id, values);
              if (!res.ok) return res.error;
              setCustomers((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...values } : c)));
            } else {
              const res = await crearCliente(values);
              if (!res.ok) return res.error;
              setCustomers((prev) => [
                { ...values, id: `tmp-${Date.now()}`, business_id: "", created_at: "", updated_at: "" } as Customer,
                ...prev,
              ]);
            }
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 && (
          <div className="card p-8 text-center text-sm text-[var(--foreground-muted)]">
            No hay clientes que coincidan.
          </div>
        )}

        {filtered.map((c) => {
          const du = daysUntil(c.next_restock_date);
          const urgency = urgencyTone(du);
          return (
            <div key={c.id} className="card flex flex-col gap-3 p-4 animate-fade-in-up">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]">
                    <Store className="h-5 w-5 text-[var(--foreground-muted)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{c.name}</p>
                      <Badge tone="neutral">{TYPE_LABEL[c.customer_type]}</Badge>
                      {c.next_restock_date && <Badge tone={urgency.tone}>{urgency.label}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--foreground-muted)]">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {c.address}
                        </span>
                      )}
                      {c.last_restock_date && <span>Última entrega: {formatDate(c.last_restock_date)}</span>}
                      {c.next_restock_date && <span>Próximo recordatorio: {formatDate(c.next_restock_date)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEntregaFor(entregaFor === c.id ? null : c.id)}
                  >
                    <PackageCheck className="h-3.5 w-3.5" /> Registrar entrega
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {role === "admin" && (
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  )}
                </div>
              </div>

              {entregaFor === c.id && (
                <EntregaPrompt onCancel={() => setEntregaFor(null)} onConfirm={(next) => handleRegistrarEntrega(c.id, next)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Prompt inline para capturar, en el momento de la entrega, cuándo pidió
 * el cliente que se le vuelva a surtir ("en 3 días", "en 7 días"...). Es
 * manual cada vez a propósito: no asume un ciclo fijo.
 */
function EntregaPrompt({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (nextRestockDate: string | null) => void;
}) {
  const [days, setDays] = useState<string>("");
  const today = todayLocalISODate();
  const previewDate = days ? addDays(today, Number(days)) : null;

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] p-3">
      <p className="mb-2 text-sm font-medium">¿En cuántos días necesita más hielo este cliente?</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(String(d))}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              days === String(d) ? "brand-gradient text-white" : "bg-[var(--surface-muted)] text-[var(--foreground-muted)]"
            }`}
          >
            {d}d
          </button>
        ))}
        <Input
          type="number"
          min="1"
          placeholder="Otro #"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="h-9 w-24"
        />
      </div>
      {previewDate && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
          <CalendarPlus className="h-3.5 w-3.5" /> Se le recordará el {formatDate(previewDate)}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={() => onConfirm(previewDate)}
          disabled={!days}
        >
          <Check className="h-3.5 w-3.5" /> Guardar entrega
        </Button>
        <Button size="sm" variant="outline" onClick={() => onConfirm(null)}>
          Sin recordatorio
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

function ClienteForm({
  defaultValues,
  vendedores,
  currentUserId,
  role,
  onCancel,
  onSubmit,
}: {
  defaultValues?: Customer;
  vendedores: Profile[];
  currentUserId: string;
  role: Role;
  onCancel: () => void;
  onSubmit: (values: FormValues) => Promise<string | undefined | void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      customer_type: defaultValues?.customer_type ?? "tienda",
      phone: defaultValues?.phone ?? "",
      address: defaultValues?.address ?? "",
      notes: defaultValues?.notes ?? "",
      last_restock_date: defaultValues?.last_restock_date ?? "",
      next_restock_date: defaultValues?.next_restock_date ?? "",
      assigned_vendedor_id: defaultValues?.assigned_vendedor_id ?? (role === "vendedor" ? currentUserId : null),
      active: true,
    },
  });

  const nextRestockDate = watch("next_restock_date");

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="c-name" error={errors.name?.message}>
          <Input id="c-name" placeholder="Abarrotes Lupita" {...register("name")} />
        </Field>
        <Field label="Tipo">
          <Select {...register("customer_type")}>
            <option value="tienda">Tienda</option>
            <option value="restaurante">Restaurante</option>
            <option value="particular">Particular</option>
            <option value="otro">Otro</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Teléfono" htmlFor="c-phone" error={errors.phone?.message}>
          <Input id="c-phone" placeholder="55 1234 5678" {...register("phone")} />
        </Field>
        <Field label="Dirección" htmlFor="c-address" error={errors.address?.message}>
          <Input id="c-address" placeholder="Calle, número, colonia" {...register("address")} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Último reabasto" htmlFor="c-last">
          <Input id="c-last" type="date" {...register("last_restock_date")} />
        </Field>
        <Field
          label="Próximo recordatorio"
          htmlFor="c-next"
          hint="Lo que te haya dicho el cliente — no se repite solo"
          error={errors.next_restock_date?.message}
        >
          <Input id="c-next" type="date" {...register("next_restock_date")} />
        </Field>
        {role === "admin" && (
          <Field label="Vendedor asignado">
            <Select {...register("assigned_vendedor_id")}>
              <option value="">Sin asignar</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-[var(--foreground-muted)]">Atajo:</span>
        {QUICK_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setValue("next_restock_date", addDays(todayLocalISODate(), d), { shouldDirty: true })}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              nextRestockDate === addDays(todayLocalISODate(), d)
                ? "brand-gradient text-white"
                : "bg-[var(--surface-muted)] text-[var(--foreground-muted)]"
            }`}
          >
            en {d}d
          </button>
        ))}
      </div>

      <Field label="Notas" htmlFor="c-notes">
        <Textarea id="c-notes" placeholder="Referencias, preferencias, etc." {...register("notes")} />
      </Field>

      <div className="mt-1 flex gap-2">
        <Button type="submit" size="sm" loading={saving} className="flex-1 sm:flex-none">
          <Check className="h-3.5 w-3.5" /> Guardar cliente
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </form>
  );
}
