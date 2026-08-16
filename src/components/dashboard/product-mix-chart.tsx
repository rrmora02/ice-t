"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { formatCurrency } from "@/lib/format";

interface ProductRow {
  product_id: string | null;
  product_name_snapshot: string;
  total_amount: number;
}

export function ProductMixChart({ data, currency }: { data: ProductRow[]; currency: string }) {
  const { chrome, categorical } = useChartTheme();

  const chartData = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const row of data) {
      byProduct.set(row.product_name_snapshot, (byProduct.get(row.product_name_snapshot) ?? 0) + Number(row.total_amount));
    }
    return Array.from(byProduct.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-sm font-semibold">Ventas por producto</p>
        <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">Sin ventas en los últimos 30 días.</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="mb-3 text-sm font-semibold">Ventas por producto (últimos 30 días)</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke={chrome.gridline} strokeWidth={1} />
            <XAxis
              type="number"
              tick={{ fill: chrome.mutedInk, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: chrome.secondaryInk, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              cursor={{ fill: chrome.gridline, opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="card px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-medium text-[var(--foreground-muted)]">{payload[0].payload.name}</p>
                    <p className="font-semibold">{formatCurrency(Number(payload[0].value), currency)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={categorical[i % categorical.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
