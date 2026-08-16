"use client";

import { useEffect } from "react";

/**
 * Registra el Service Worker de la PWA. Se monta una sola vez en el
 * layout raíz. Silencioso si el navegador no soporta Service Workers
 * (por ejemplo, en pruebas dentro de un iframe sin HTTPS).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("No se pudo registrar el service worker", err);
    });
  }, []);

  return null;
}
