"use client";

import { getOfflineDB } from "@/lib/offline/db";

/**
 * Borra los datos del negocio que quedan guardados en el dispositivo al
 * cerrar sesión.
 *
 * Hace falta porque tanto la Cache Storage del Service Worker como
 * IndexedDB son por ORIGEN, no por usuario: en un teléfono compartido
 * entre vendedores —el escenario normal en un reparto— el siguiente en
 * entrar podía ver el catálogo, la cartera de clientes y hasta la última
 * página renderizada del anterior.
 *
 * Lo que NO se borra: la cola `pendingSales`. Son ventas reales que aún no
 * llegaron al servidor; borrarlas al cerrar sesión sería perder dinero
 * registrado. Se quedan y se sincronizan cuando ese mismo vendedor vuelva
 * a entrar (el RPC valida que la venta corresponda a su negocio).
 */
export async function clearLocalBusinessData(): Promise<void> {
  const db = getOfflineDB();
  if (db) {
    try {
      await Promise.all([db.cachedProducts.clear(), db.cachedCustomers.clear()]);
    } catch (err) {
      console.error("No se pudo limpiar la caché local", err);
    }
  }

  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.active?.postMessage({ type: "CLEAR_CACHES" });
  } catch (err) {
    console.error("No se pudo avisar al service worker", err);
  }
}
