"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { completarRegistroSchema } from "@/lib/validation";
import { clearPendingRegistration, readPendingRegistration } from "@/lib/pending-registration";
import type { z } from "zod";

type FormValues = z.infer<typeof completarRegistroSchema>;

/**
 * Página a la que el middleware/redirects mandan a un usuario autenticado
 * en Supabase que todavía no tiene fila en `profiles` (o sea, no completó
 * la creación de su negocio, típicamente porque tuvo que confirmar su
 * correo antes). Si detecta datos guardados en localStorage del registro
 * original, autocompleta el formulario.
 */
export default function CompletarRegistroPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(completarRegistroSchema) });

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        router.replace("/dashboard");
        return;
      }

      const pending = readPendingRegistration();
      if (pending) {
        setValue("businessName", pending.businessName);
        setValue("fullName", pending.fullName);
      } else if (user.user_metadata?.full_name) {
        setValue("fullName", String(user.user_metadata.full_name));
      }

      setChecking(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.rpc("create_business_and_admin", {
      p_business_name: values.businessName,
      p_full_name: values.fullName,
    });

    setLoading(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    clearPendingRegistration();
    router.replace("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <AuthShell title="Un momento…" subtitle="Estamos verificando tu cuenta.">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Completa tu registro" subtitle="Solo falta darle nombre a tu negocio.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {serverError && (
          <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <Field label="Nombre del negocio" htmlFor="businessName" error={errors.businessName?.message}>
          <Input id="businessName" placeholder="Hielo El Polar" {...register("businessName")} />
        </Field>

        <Field label="Tu nombre completo" htmlFor="fullName" error={errors.fullName?.message}>
          <Input id="fullName" placeholder="Juan Pérez" {...register("fullName")} />
        </Field>

        <Button type="submit" size="lg" loading={loading} className="mt-2 justify-center">
          Continuar
        </Button>
      </form>
    </AuthShell>
  );
}
