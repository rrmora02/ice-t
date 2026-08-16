import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PreciosClient } from "@/components/precios/precios-client";
import type { IceProduct } from "@/types/db";

export default async function PreciosPage() {
  const ctx = await requireAdmin();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("ice_products")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("sort_order", { ascending: true });

  return (
    <div>
      <PageHeader
        title="Precios"
        subtitle="Configura el precio de cada presentación de hielo. Los cambios aplican a partir de la siguiente venta."
      />
      <PreciosClient initialProducts={(products ?? []) as IceProduct[]} currency={ctx.business.currency} />
    </div>
  );
}
