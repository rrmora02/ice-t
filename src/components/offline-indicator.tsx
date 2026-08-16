"use client";

import { clsx } from "clsx";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/hooks/use-offline-sync";

export function OfflineIndicator({ compact = false }: { compact?: boolean }) {
  const { online, syncing, pendingCount, errorCount, syncNow } = useOfflineSync();

  if (online && pendingCount === 0 && errorCount === 0) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--foreground-muted)]">
        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
        En línea
      </div>
    );
  }

  const label = !online
    ? pendingCount > 0
      ? `Sin conexión · ${pendingCount} venta(s) pendiente(s)`
      : "Sin conexión"
    : syncing
      ? "Sincronizando…"
      : errorCount > 0
        ? `${errorCount} venta(s) con error de sync`
        : `${pendingCount} venta(s) por sincronizar`;

  return (
    <button
      onClick={() => syncNow()}
      className={clsx(
        "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium",
        !online || errorCount > 0
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-sky-500/15 text-sky-600 dark:text-sky-400",
        compact && "px-2"
      )}
      title="Tocar para sincronizar ahora"
    >
      {!online ? (
        <WifiOff className="h-3.5 w-3.5" />
      ) : (
        <RefreshCw className={clsx("h-3.5 w-3.5", syncing && "animate-spin")} />
      )}
      {!compact && <span>{label}</span>}
    </button>
  );
}
