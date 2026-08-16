import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { GastosClient } from "@/components/gastos/gastos-client";
import type { BusinessRoiSummary, Expense } from "@/types/db";

export default async function GastosPage() {
  const ctx = await requireAdmin();
  const supabase = await createClient();

  const [{ data: expenses }, { data: roi }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("business_id", ctx.business.id)
      .order("expense_date", { ascending: false })
      .limit(200),
    supabase.from("v_business_roi_summary").select("*").eq("business_id", ctx.business.id).maybeSingle(),
  ]);

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle="Registra inversión (equipo) y gastos operativos, y compáralos contra tus ingresos."
      />
      <GastosClient
        initialExpenses={(expenses ?? []) as Expense[]}
        roi={roi as BusinessRoiSummary | null}
        currency={ctx.business.currency}
      />
    </div>
  );
}
