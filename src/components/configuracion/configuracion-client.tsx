"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { Bell, BellOff, Check, KeyRound, User2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFeedback } from "@/components/ui/feedback";
import { createClient } from "@/lib/supabase/client";
import { isPushSupported, getExistingPushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { actualizarPerfil, actualizarNegocio } from "@/app/(app)/configuracion/actions";
import type { Business, Profile } from "@/types/db";

export function ConfiguracionClient({ profile, business }: { profile: Profile; business: Business }) {
  return (
    <div className="flex flex-col gap-4">
      <PerfilSection profile={profile} />
      <NotificacionesSection />
      <SeguridadSection />
      {profile.role === "admin" && <NegocioSection business={business} />}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-sky-500" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PerfilSection({ profile }: { profile: Profile }) {
  const [saved, setSaved] = useState(false);
  const { success, error: toastError } = useFeedback();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { fullName: profile.full_name, phone: profile.phone ?? "" },
  });

  return (
    <SectionCard icon={User2} title="Tu perfil">
      <form
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(async (values) => {
          const res = await actualizarPerfil(values);
          if (!res.ok) {
            toastError("No se pudo guardar tu perfil", res.error);
            return;
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          success("Perfil actualizado");
        })}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre completo">
            <Input {...register("fullName")} />
          </Field>
          <Field label="Teléfono">
            <Input {...register("phone")} />
          </Field>
        </div>
        <p className="text-xs text-[var(--foreground-muted)]">Correo: {profile.email} (no editable)</p>
        <Button type="submit" size="sm" className="w-fit" loading={isSubmitting}>
          <Check className="h-3.5 w-3.5" /> {saved ? "Guardado" : "Guardar cambios"}
        </Button>
      </form>
    </SectionCard>
  );
}

function noopSubscribe() {
  return () => {};
}

function useIsPushSupported() {
  return useSyncExternalStore(noopSubscribe, isPushSupported, () => false);
}

function NotificacionesSection() {
  const supported = useIsPushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error: toastError } = useFeedback();

  useEffect(() => {
    getExistingPushSubscription().then((sub) => setSubscribed(!!sub));
  }, []);

  async function handleToggle() {
    setLoading(true);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
      success("Notificaciones desactivadas");
    } else {
      const res = await subscribeToPush();
      if (!res.ok) {
        toastError("No se pudieron activar las notificaciones", res.error);
      } else {
        setSubscribed(true);
        success("Notificaciones activadas", "Te avisaremos cuando un cliente esté por necesitar reabasto.");
      }
    }
    setLoading(false);
  }

  return (
    <SectionCard icon={Bell} title="Notificaciones de reabasto">
      <p className="text-sm text-[var(--foreground-muted)]">
        Recibe un aviso push cuando un cliente esté por vencer su fecha de reabasto de hielo.
      </p>
      {!supported ? (
        <Badge tone="neutral">No disponible en este navegador</Badge>
      ) : (
        <>
            <Button
            size="sm"
            variant={subscribed ? "outline" : "primary"}
            className="w-fit"
            loading={loading}
            onClick={handleToggle}
          >
            {subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {subscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
          </Button>
        </>
      )}
    </SectionCard>
  );
}

function SeguridadSection() {
  const [saved, setSaved] = useState(false);
  const { success, error: toastError } = useFeedback();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{ password: string; confirm: string }>();

  return (
    <SectionCard icon={KeyRound} title="Seguridad">
      <form
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(async (values) => {
          if (values.password.length < 8) {
            toastError("La contraseña debe tener al menos 8 caracteres.");
            return;
          }
          if (values.password !== values.confirm) {
            toastError("Las contraseñas no coinciden.");
            return;
          }
          const supabase = createClient();
          const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
          if (updateError) {
            toastError("No se pudo cambiar la contraseña", updateError.message);
            return;
          }
          reset();
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          success("Contraseña actualizada", "Úsala la próxima vez que inicies sesión.");
        })}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nueva contraseña">
            <Input type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field label="Confirmar contraseña">
            <Input type="password" autoComplete="new-password" {...register("confirm")} />
          </Field>
        </div>
        <Button type="submit" size="sm" className="w-fit" loading={isSubmitting}>
          <Check className="h-3.5 w-3.5" /> {saved ? "Actualizada" : "Cambiar contraseña"}
        </Button>
      </form>
    </SectionCard>
  );
}

function NegocioSection({ business }: { business: Business }) {
  const [saved, setSaved] = useState(false);
  const { success, error: toastError } = useFeedback();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: { name: business.name } });

  return (
    <SectionCard icon={Store} title="Negocio">
      <form
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(async (values) => {
          const res = await actualizarNegocio(values);
          if (!res.ok) {
            toastError("No se pudo guardar el negocio", res.error);
            return;
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          success("Negocio actualizado", values.name);
        })}
      >
        <Field label="Nombre del negocio">
          <Input {...register("name")} />
        </Field>
        <Button type="submit" size="sm" className="w-fit" loading={isSubmitting}>
          <Check className="h-3.5 w-3.5" /> {saved ? "Guardado" : "Guardar cambios"}
        </Button>
      </form>
    </SectionCard>
  );
}
