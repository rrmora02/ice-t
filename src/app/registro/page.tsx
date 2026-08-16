"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { registroNegocioSchema } from "@/lib/validation";
import { savePendingRegistration } from "@/lib/pending-registration";
import type { z } from "zod";

type FormValues = z.infer<typeof registroNegocioSchema>;

export default function RegistroPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(registroNegocioSchema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });

    if (error) {
      setLoading(false);
      setServerError(
        error.message.includes("already registered")
          ? "Ese correo ya está registrado. Intenta iniciar sesión."
          : error.message
      );
      return;
    }

    savePendingRegistration({ businessName: values.businessName, fullName: values.fullName });

    if (!data.session) {
      // El proyecto requiere confirmar el correo antes de crear sesión.
      setLoading(false);
      setNeedsConfirmation(true);
      return;
    }

    const { error: rpcError } = await supabase.rpc("create_business_and_admin", {
      p_business_name: values.businessName,
      p_full_name: values.fullName,
    });

    setLoading(false);

    if (rpcError) {
      setServerError(rpcError.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <AuthShell title="Confirma tu correo" subtitle="Estás a un paso de comenzar.">
        <div className="card flex flex-col gap-3 p-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="text-sm text-[var(--foreground)]">
            Te enviamos un correo de confirmación. Ábrelo, confirma tu cuenta y luego{" "}
            <Link href="/login" className="font-medium text-sky-500 hover:underline">
              inicia sesión aquí
            </Link>
            . Tu negocio se terminará de crear automáticamente en tu primer inicio de sesión.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Registra tu negocio"
      subtitle="Crea la cuenta de administrador de tu negocio de hielo."
      footer={
        <p className="text-[var(--foreground-muted)]">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-sky-500 hover:underline">
            Inicia sesión
          </Link>
        </p>
      }
    >
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

        <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="tu@negocio.com" {...register("email")} />
        </Field>

        <Field label="Contraseña" htmlFor="password" error={errors.password?.message} hint="Mínimo 8 caracteres">
          <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" {...register("password")} />
        </Field>

        <Button type="submit" size="lg" loading={loading} className="mt-2 justify-center">
          Crear negocio
        </Button>
      </form>
    </AuthShell>
  );
}
