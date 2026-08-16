import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { VentasClient } from "@/components/ventas/ventas-client";
import type { Customer, IceProduct, Sale, SaleItem } from "@/types/db";

export default async function VentasPage() {
  const ctx = await requireSession();
  const supabase = await createClient();

  const [{ data: products }, { data: customers }, { data: recentSales }] = await Promise.all([
    supabase
      .from("ice_products")
      .select("*")
      .eq("business_id", ctx.business.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("customers")
      .select("*")
      .eq("business_id", ctx.business.id)
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("sales")
      .select("*, sale_items(*)")
      .eq("business_id", ctx.business.id)
      .order("sold_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <div>
      <PageHeader title="Ventas" subtitle="Registra una venta rápida, incluso sin conexión." />
      <VentasClient
        products={(products ?? []) as IceProduct[]}
        customers={(customers ?? []) as Customer[]}
        recentSales={(recentSales ?? []) as (Sale & { sale_items: SaleItem[] })[]}
        businessId={ctx.business.id}
        currency={ctx.business.currency}
        role={ctx.profile.role}
        currentUserId={ctx.userId}
      />
    </div>
  );
}
