import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { BusinessRoiSummary } from "@/types/db";

export function RoiWidget({ roi, currency }: { roi: BusinessRoiSummary | null; currency: string }) {
  const capital = roi?.capital_invested ?? 0;
  const netProfit = roi?.net_profit ?? 0;
  const progress = capital > 0 ? Math.min(100, Math.max(0, (netProfit / capital) * 100)) : 0;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4.5 w-4.5 text-sky-500" />
          <p className="text-sm font-semibold">Inversión</p>
        </div>
        <Link href="/gastos" className="text-xs font-medium text-sky-500 hover:underline">
          Ver gastos
        </Link>
      </div>
      {capital === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">
          Registra tu inversión inicial (ej. máquina de hielo) en Gastos para ver tu progreso aquí.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--foreground-muted)]">
              {formatCurrency(netProfit, currency)} de {formatCurrency(capital, currency)}
            </span>
            {roi?.investment_recovered ? (
              <Badge tone="success">Recuperada</Badge>
            ) : (
              <Badge tone="warning">{progress.toFixed(0)}%</Badge>
            )}
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full rounded-full brand-gradient transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
