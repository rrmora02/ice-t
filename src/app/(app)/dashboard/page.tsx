import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { ProductMixChart } from "@/components/dashboard/product-mix-chart";
import { VendedorChart } from "@/components/dashboard/vendedor-chart";
import { UpcomingRestocksWidget } from "@/components/dashboard/upcoming-restocks-widget";
import { RoiWidget } from "@/components/dashboard/roi-widget";
import { formatCurrency } from "@/lib/format";
import type { BusinessRoiSummary, SalesDailyRow, UpcomingRestockRow } from "@/types/db";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const ctx = await requireSession();
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  const since90 = isoDaysAgo(90);
  const since30 = isoDaysAgo(30);

  const [{ data: dailyRows }, { data: productRows }, upcomingRes, vendedorRes, roiRes] = await Promise.all([
    supabase
      .from("v_sales_daily")
      .select("*")
      .eq("business_id", ctx.business.id)
      .gte("sale_date", since90),
    supabase
      .from("v_sales_by_product")
      .select("*")
      .eq("business_id", ctx.business.id)
      .gte("sale_date", since30),
    supabase
      .from("v_upcoming_restocks")
      .select("*")
      .eq("business_id", ctx.business.id)
      .lte("next_restock_date", isoDaysAgo(-14))
      .order("next_restock_date", { ascending: true })
      .limit(6),
    isAdmin
      ? supabase
          .from("v_sales_by_vendedor")
          .select("*")
          .eq("business_id", ctx.business.id)
          .gte("sale_date", since30)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("v_business_roi_summary").select("*").eq("business_id", ctx.business.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const daily = (dailyRows ?? []) as SalesDailyRow[];
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = isoDaysAgo(6);
  const monthAgo = isoDaysAgo(29);
  const prevWeekStart = isoDaysAgo(13);
  const prevMonthStart = isoDaysAgo(59);

  const sum = (rows: SalesDailyRow[], from: string, to: string) =>
    rows.filter((r) => r.sale_date >= from && r.sale_date <= to).reduce((s, r) => s + Number(r.total_amount), 0);

  const totalToday = sum(daily, today, today);
  const totalWeek = sum(daily, weekAgo, today);
  const totalMonth = sum(daily, monthAgo, today);
  const totalPrevWeek = sum(daily, prevWeekStart, weekAgo);
  const totalPrevMonth = sum(daily, prevMonthStart, monthAgo);

  const pctChange = (curr: number, prev: number) => (prev > 0 ? ((curr - prev) / prev) * 100 : null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hola, ${ctx.profile.full_name.split(" ")[0] || ""}`}
        subtitle={isAdmin ? "Resumen general del negocio." : "Tu resumen de ventas."}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Ventas de hoy" value={formatCurrency(totalToday, ctx.business.currency)} hint="Corte a la fecha" />
        <StatTile
          label="Últimos 7 días"
          value={formatCurrency(totalWeek, ctx.business.currency)}
          deltaPct={pctChange(totalWeek, totalPrevWeek)}
        />
        <StatTile
          label="Últimos 30 días"
          value={formatCurrency(totalMonth, ctx.business.currency)}
          deltaPct={pctChange(totalMonth, totalPrevMonth)}
        />
      </div>

      <SalesTrendChart data={daily} currency={ctx.business.currency} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductMixChart data={productRows ?? []} currency={ctx.business.currency} />
        <div className="flex flex-col gap-4">
          <UpcomingRestocksWidget rows={(upcomingRes.data ?? []) as UpcomingRestockRow[]} />
          {isAdmin && <RoiWidget roi={roiRes.data as BusinessRoiSummary | null} currency={ctx.business.currency} />}
        </div>
      </div>

      {isAdmin && <VendedorChart data={vendedorRes.data ?? []} currency={ctx.business.currency} />}
    </div>
  );
}
