import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { ProductMixChart } from "@/components/dashboard/product-mix-chart";
import { VendedorChart } from "@/components/dashboard/vendedor-chart";
import { UpcomingRestocksWidget } from "@/components/dashboard/upcoming-restocks-widget";
import { RoiWidget } from "@/components/dashboard/roi-widget";
import { SalesByCustomerWidget } from "@/components/dashboard/sales-by-customer-widget";
import { formatCurrency } from "@/lib/format";
import { todayInTimeZone, shiftISODate } from "@/lib/business-date";
import type {
  BusinessRoiSummary,
  SalesByCustomerRow,
  SalesDailyRow,
  UpcomingRestockRow,
} from "@/types/db";

export default async function DashboardPage() {
  const ctx = await requireSession();
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  // Todas las fechas se resuelven en la zona horaria del NEGOCIO. El
  // servidor corre en UTC: usar su fecha hacía que a las 18:00 en México
  // el corte de "Ventas de hoy" se fuera a cero, porque para el servidor
  // ya era el día siguiente y ninguna venta coincidía.
  const today = todayInTimeZone(ctx.business.timezone);
  const since90 = shiftISODate(today, -90);
  const since30 = shiftISODate(today, -30);

  const [
    { data: dailyRows },
    { data: productRows },
    upcomingRes,
    vendedorRes,
    roiRes,
    porClienteRes,
  ] = await Promise.all([
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
      .lte("next_restock_date", shiftISODate(today, 14))
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
      ? supabase
          .from("v_business_roi_summary")
          .select("*")
          .eq("business_id", ctx.business.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("v_sales_by_customer")
      .select("*")
      .eq("business_id", ctx.business.id)
      .eq("sale_date", today)
      .order("total_amount", { ascending: false }),
  ]);

  const daily = (dailyRows ?? []) as SalesDailyRow[];
  const weekAgo = shiftISODate(today, -6);
  const monthAgo = shiftISODate(today, -29);
  const prevWeekStart = shiftISODate(today, -13);
  const prevMonthStart = shiftISODate(today, -29 - 30);

  const sum = (rows: SalesDailyRow[], from: string, to: string) =>
    rows
      .filter((r) => r.sale_date >= from && r.sale_date <= to)
      .reduce((s, r) => s + Number(r.total_amount), 0);

  const totalToday = sum(daily, today, today);
  const totalWeek = sum(daily, weekAgo, today);
  const totalMonth = sum(daily, monthAgo, today);
  const totalPrevWeek = sum(daily, prevWeekStart, weekAgo);
  const totalPrevMonth = sum(daily, prevMonthStart, monthAgo);

  const pctChange = (curr: number, prev: number) =>
    prev > 0 ? ((curr - prev) / prev) * 100 : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hola, ${ctx.profile.full_name.split(" ")[0] || ""}`}
        subtitle={
          isAdmin ? "Resumen general del negocio." : "Tu resumen de ventas."
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Ventas de hoy"
          value={formatCurrency(totalToday, ctx.business.currency)}
          hint="Corte a la fecha"
        />
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

      <SalesByCustomerWidget
        initialRows={(porClienteRes.data ?? []) as SalesByCustomerRow[]}
        initialDate={today}
        today={today}
        businessId={ctx.business.id}
        currency={ctx.business.currency}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductMixChart
          data={productRows ?? []}
          currency={ctx.business.currency}
        />
        <div className="flex flex-col gap-4">
          <UpcomingRestocksWidget
            rows={(upcomingRes.data ?? []) as UpcomingRestockRow[]}
          />
          {isAdmin && (
            <RoiWidget
              roi={roiRes.data as BusinessRoiSummary | null}
              currency={ctx.business.currency}
            />
          )}
        </div>
      </div>

      {isAdmin && (
        <VendedorChart
          data={vendedorRes.data ?? []}
          currency={ctx.business.currency}
        />
      )}
    </div>
  );
}
