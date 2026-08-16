"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Check, X, Copy, KeyRound, UserX, UserCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useFeedback } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { vendedorInviteSchema } from "@/lib/validation";
import { crearVendedor, actualizarEstadoVendedor, resetPasswordVendedor } from "@/app/(app)/vendedores/actions";
import type { Profile } from "@/types/db";
import type { z } from "zod";

type FormValues = z.infer<typeof vendedorInviteSchema>;
type FormInput = z.input<typeof vendedorInviteSchema>;

export function VendedoresClient({
  initialProfiles,
  currentUserId,
}: {
  initialProfiles: Profile[];
  currentUserId: string;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [showForm, setShowForm] = useState(false);
  const { success, error: toastError, confirm } = useFeedback();
  const [credentialModal, setCredentialModal] = useState<{ email: string; password: string } | null>(null);

  async function handleToggleActive(p: Profile) {
    const nextActive = !p.active;

    if (!nextActive) {
      const confirmado = await confirm({
        title: `¿Desactivar a ${p.full_name}?`,
        description: "No podrá iniciar sesión ni registrar ventas. Puedes reactivarlo cuando quieras.",
        confirmLabel: "Desactivar",
        tone: "danger",
      });
      if (!confirmado) return;
    }

    const res = await actualizarEstadoVendedor(p.id, nextActive);
    if (!res.ok) {
      toastError("No se pudo actualizar el vendedor", res.error);
      return;
    }
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: nextActive } : x)));
    success(nextActive ? "Vendedor reactivado" : "Vendedor desactivado", p.full_name);
  }

  async function handleResetPassword(p: Profile) {
    const confirmado = await confirm({
      title: `¿Generar una nueva contraseña para ${p.full_name}?`,
      description: "La contraseña actual dejará de funcionar de inmediato y tendrás que compartirle la nueva.",
      confirmLabel: "Generar contraseña",
    });
    if (!confirmado) return;

    const res = await resetPasswordVendedor(p.id);
    if (!res.ok) {
      toastError("No se pudo regenerar la contraseña", res.error);
      return;
    }
    if (res.tempPassword) setCredentialModal({ email: p.email, password: res.tempPassword });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Nuevo vendedor
        </Button>
      </div>

      {showForm && (
        <VendedorForm
          onCancel={() => setShowForm(false)}
          onCreated={(profile, tempPassword) => {
            setProfiles((prev) => [...prev, profile]);
            setShowForm(false);
            setCredentialModal({ email: profile.email, password: tempPassword });
          }}
        />
      )}

      <div className="flex flex-col gap-2.5">
        {profiles.map((p) => (
          <div key={p.id} className="card flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{p.full_name}</p>
                <Badge tone={p.role === "admin" ? "brand" : "neutral"}>
                  {p.role === "admin" && <ShieldCheck className="h-3 w-3" />}
                  {p.role === "admin" ? "Administrador" : "Vendedor"}
                </Badge>
                {!p.active && <Badge tone="danger">Desactivado</Badge>}
                {p.id === currentUserId && <Badge tone="neutral">Tú</Badge>}
              </div>
              <p className="truncate text-xs text-[var(--foreground-muted)]">{p.email}</p>
            </div>
            {p.role !== "admin" && (
              <div className="flex shrink-0 gap-1.5">
                <Button size="icon" variant="ghost" title="Restablecer contraseña" onClick={() => handleResetPassword(p)}>
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title={p.active ? "Desactivar" : "Reactivar"} onClick={() => handleToggleActive(p)}>
                  {p.active ? <UserX className="h-4 w-4 text-rose-500" /> : <UserCheck className="h-4 w-4 text-emerald-500" />}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {credentialModal && (
        <CredentialModal
          email={credentialModal.email}
          password={credentialModal.password}
          onClose={() => setCredentialModal(null)}
        />
      )}
    </div>
  );
}

function VendedorForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (profile: Profile, tempPassword: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(vendedorInviteSchema) });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setSaving(true);
        setServerError(null);
        const res = await crearVendedor(values);
        setSaving(false);
        if (!res.ok || !res.tempPassword) {
          setServerError(res.error ?? "No se pudo crear");
          return;
        }
        const tempId = crypto.randomUUID();
        onCreated(
          {
            id: tempId,
            business_id: "",
            role: "vendedor",
            full_name: values.fullName,
            email: values.email,
            phone: values.phone,
            active: true,
            created_at: "",
            updated_at: "",
          },
          res.tempPassword
        );
      })}
      className="card flex flex-col gap-3 p-4"
    >
      {serverError && <p className="text-xs font-medium text-rose-500">{serverError}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre completo" htmlFor="v-name" error={errors.fullName?.message}>
          <Input id="v-name" placeholder="María López" {...register("fullName")} />
        </Field>
        <Field label="Correo electrónico" htmlFor="v-email" error={errors.email?.message}>
          <Input id="v-email" type="email" placeholder="maria@negocio.com" {...register("email")} />
        </Field>
      </div>
      <Field label="Teléfono (opcional)" htmlFor="v-phone">
        <Input id="v-phone" placeholder="55 1234 5678" {...register("phone")} />
      </Field>

      <div className="mt-1 flex gap-2">
        <Button type="submit" size="sm" loading={saving} className="flex-1 sm:flex-none">
          <Check className="h-3.5 w-3.5" /> Crear cuenta
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </form>
  );
}

function CredentialModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="card relative w-full max-w-sm p-5 animate-fade-in-up">
        <h3 className="font-semibold">Cuenta creada</h3>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Comparte estas credenciales de forma segura. Pide a la persona que cambie su contraseña
          al entrar por primera vez desde Configuración.
        </p>
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-[var(--surface-muted)] p-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--foreground-muted)]">Correo</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--foreground-muted)]">Contraseña temporal</span>
            <span className="font-mono font-medium">{password}</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1 justify-center"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(`Correo: ${email}\nContraseña: ${password}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="h-4 w-4" /> {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button className="flex-1 justify-center" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </div>
  );
}
