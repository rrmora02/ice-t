"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation";
import type { z } from "zod";

type FormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    setLoading(false);

    if (error) {
      setServerError(
        error.message.includes("Invalid login")
          ? "Correo o contraseña incorrectos."
          : error.message
      );
      return;
    }

    const next = searchParams.get("next") || "/dashboard";
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell
      title="Inicia sesión"
      subtitle="Entra con el correo y contraseña de tu negocio."
      footer={
        <p className="text-[var(--foreground-muted)]">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-sky-500 hover:underline">
            Registra tu negocio
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

        <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="tu@negocio.com" {...register("email")} />
        </Field>

        <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
        </Field>

        <Button type="submit" size="lg" loading={loading} className="mt-2 justify-center">
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
