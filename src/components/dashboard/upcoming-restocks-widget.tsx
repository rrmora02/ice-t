import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { UpcomingRestockRow } from "@/types/db";

export function UpcomingRestocksWidget({ rows }: { rows: UpcomingRestockRow[] }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4.5 w-4.5 text-sky-500" />
          <p className="text-sm font-semibold">Próximos reabastos</p>
        </div>
        <Link href="/clientes" className="text-xs font-medium text-sky-500 hover:underline">
          Ver todos
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">
          No hay reabastos próximos. Configura la frecuencia en cada cliente para activar recordatorios.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => {
            const tone = r.days_until < 0 ? "danger" : r.days_until <= 1 ? "warning" : "neutral";
            const label =
              r.days_until < 0
                ? `Vencido hace ${Math.abs(r.days_until)}d`
                : r.days_until === 0
                  ? "Hoy"
                  : r.days_until === 1
                    ? "Mañana"
                    : `En ${r.days_until}d`;
            return (
              <div key={r.customer_id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-xs text-[var(--foreground-muted)]">{formatDate(r.next_restock_date)}</p>
                </div>
                <Badge tone={tone}>{label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
