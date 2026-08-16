"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import type { SalesDailyRow } from "@/types/db";

const RANGES = [
  { key: "7", label: "7 días", days: 7 },
  { key: "30", label: "30 días", days: 30 },
  { key: "90", label: "90 días", days: 90 },
] as const;

export function SalesTrendChart({ data, currency }: { data: SalesDailyRow[]; currency: string }) {
  const { chrome, sequential } = useChartTheme();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");

  const chartData = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byDate = new Map(data.map((d) => [d.sale_date, d.total_amount]));

    const out: { date: string; label: string; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, label: formatDate(iso, { day: "numeric", month: "short", year: undefined }), total: byDate.get(iso) ?? 0 });
    }
    return out;
  }, [data, range]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Ventas por día</p>
          <p className="text-xs text-[var(--foreground-muted)]">Ingreso total registrado por día</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-[var(--surface-muted)] p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                range === r.key ? "bg-[var(--surface)] shadow-sm" : "text-[var(--foreground-muted)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sequential} stopOpacity={0.22} />
                <stop offset="100%" stopColor={sequential} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={chrome.gridline} strokeWidth={1} />
            <XAxis
              dataKey="label"
              tick={{ fill: chrome.mutedInk, fontSize: 11 }}
              axisLine={{ stroke: chrome.baseline }}
              tickLine={false}
              interval={range === "7" ? 0 : "preserveStartEnd"}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: chrome.mutedInk, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <Tooltip
              cursor={{ stroke: chrome.baseline, strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="card px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-medium text-[var(--foreground-muted)]">{label}</p>
                    <p className="font-semibold">{formatCurrency(Number(payload[0].value), currency)}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={sequential}
              strokeWidth={2}
              fill="url(#salesFill)"
              dot={false}
              activeDot={{ r: 4, fill: sequential, stroke: chrome.surface, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
