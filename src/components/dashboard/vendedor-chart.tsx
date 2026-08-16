"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { formatCurrency } from "@/lib/format";

interface VendedorRow {
  vendedor_id: string;
  vendedor_name: string;
  total_amount: number;
}

export function VendedorChart({ data, currency }: { data: VendedorRow[]; currency: string }) {
  const { chrome, categorical } = useChartTheme();

  const chartData = useMemo(() => {
    const byVendedor = new Map<string, number>();
    for (const row of data) {
      byVendedor.set(row.vendedor_name, (byVendedor.get(row.vendedor_name) ?? 0) + Number(row.total_amount));
    }
    return Array.from(byVendedor.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-sm font-semibold">Ventas por vendedor</p>
        <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">Sin ventas en los últimos 30 días.</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="mb-3 text-sm font-semibold">Ventas por vendedor (últimos 30 días)</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={18}>
            <CartesianGrid vertical={false} stroke={chrome.gridline} strokeWidth={1} />
            <XAxis dataKey="name" tick={{ fill: chrome.secondaryInk, fontSize: 12 }} axisLine={{ stroke: chrome.baseline }} tickLine={false} />
            <YAxis
              tick={{ fill: chrome.mutedInk, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
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
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
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
