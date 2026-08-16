"use client";

import { createClient } from "@/lib/supabase/client";
import { getOfflineDB, type PendingSale } from "@/lib/offline/db";

export type SyncListener = (state: { syncing: boolean; pendingCount: number }) => void;

const listeners = new Set<SyncListener>();
let syncing = false;

export function onSyncStateChange(listener: SyncListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function notify() {
  const db = getOfflineDB();
  const pendingCount = db ? await db.pendingSales.where("status").notEqual("error").count() : 0;
  listeners.forEach((l) => l({ syncing, pendingCount }));
}

/**
 * Intenta sincronizar todas las ventas pendientes guardadas offline. Es
 * segura de llamar varias veces seguidas (p. ej. al reconectar y también
 * por un intervalo): cada venta usa `client_uuid` como clave de
 * idempotencia en el RPC `create_sale`, así que reintentar una que ya se
 * sincronizó simplemente devuelve el mismo id sin duplicar la venta.
 */
export async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  const db = getOfflineDB();
  if (!db || syncing) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0 };

  syncing = true;
  await notify();

  let synced = 0;
  let failed = 0;

  try {
    const pending: PendingSale[] = await db.pendingSales
      .where("status")
      .anyOf(["pending", "error"])
      .toArray();

    if (pending.length === 0) return { synced: 0, failed: 0 };

    const supabase = createClient();

    for (const sale of pending) {
      await db.pendingSales.update(sale.client_uuid, { status: "syncing" });

      const { error } = await supabase.rpc("create_sale", {
        p_customer_id: sale.customer_id,
        p_items: sale.items,
        p_payment_method: sale.payment_method,
        p_client_uuid: sale.client_uuid,
        p_sold_at: sale.sold_at,
        p_notes: sale.notes,
      });

      if (error) {
        failed += 1;
        await db.pendingSales.update(sale.client_uuid, {
          status: "error",
          last_error: error.message,
          attempts: sale.attempts + 1,
        });
      } else {
        synced += 1;
        await db.pendingSales.delete(sale.client_uuid);
      }
    }
  } finally {
    syncing = false;
    await notify();
  }

  return { synced, failed };
}

let watchersInstalled = false;

/** Registra listeners globales (online / visibilidad) una sola vez por sesión de página. */
export function ensureSyncWatchers() {
  if (watchersInstalled || typeof window === "undefined") return;
  watchersInstalled = true;

  window.addEventListener("online", () => {
    syncPendingSales();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncPendingSales();
  });

  // Reintento periódico silencioso por si el navegador no dispara "online"
  // de forma confiable (pasa en algunos Android/WebView).
  setInterval(() => {
    syncPendingSales();
  }, 30_000);

  syncPendingSales();
}
