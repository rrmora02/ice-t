import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ConfiguracionClient } from "@/components/configuracion/configuracion-client";

export default async function ConfiguracionPage() {
  const ctx = await requireSession();

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Tu perfil, seguridad y notificaciones." />
      <ConfiguracionClient profile={ctx.profile} business={ctx.business} />
    </div>
  );
}
