import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { ClientesClient } from "@/components/clientes/clientes-client";
import type { Customer, Profile } from "@/types/db";

export default async function ClientesPage() {
  const ctx = await requireSession();
  const supabase = await createClient();

  const [{ data: customers }, { data: vendedores }] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("business_id", ctx.business.id)
      .eq("active", true)
      .order("next_restock_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("profiles")
      .select("*")
      .eq("business_id", ctx.business.id)
      .eq("active", true),
  ]);

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Tiendas, negocios y personas a las que les vendes hielo, con recordatorios de reabasto."
      />
      <ClientesClient
        initialCustomers={(customers ?? []) as Customer[]}
        vendedores={(vendedores ?? []) as Profile[]}
        currentUserId={ctx.userId}
        role={ctx.profile.role}
      />
    </div>
  );
}
