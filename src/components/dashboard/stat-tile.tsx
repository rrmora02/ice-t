import { clsx } from "clsx";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatTile({
  label,
  value,
  deltaPct,
  deltaGoodDirection = "up",
  hint,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  deltaGoodDirection?: "up" | "down";
  hint?: string;
}) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const isUp = (deltaPct ?? 0) >= 0;
  const isGood = hasDelta && (deltaGoodDirection === "up" ? isUp : !isUp);

  return (
    <div className="card flex flex-col gap-1.5 p-4">
      <p className="text-xs font-medium text-[var(--foreground-muted)]">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {hasDelta ? (
        <span
          className={clsx(
            "inline-flex w-fit items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
            isGood ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
          )}
        >
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(deltaPct!).toFixed(0)}% vs periodo anterior
        </span>
      ) : (
        hint && <p className="text-[11px] text-[var(--foreground-muted)]">{hint}</p>
      )}
    </div>
  );
}
