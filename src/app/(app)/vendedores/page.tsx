import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { VendedoresClient } from "@/components/vendedores/vendedores-client";
import type { Profile } from "@/types/db";

export default async function VendedoresPage() {
  const ctx = await requireAdmin();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("created_at", { ascending: true });

  return (
    <div>
      <PageHeader
        title="Vendedores"
        subtitle="Crea cuentas para tu equipo de venta y administra su acceso."
      />
      <VendedoresClient initialProfiles={(profiles ?? []) as Profile[]} currentUserId={ctx.userId} />
    </div>
  );
}
