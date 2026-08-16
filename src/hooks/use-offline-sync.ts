"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getOfflineDB } from "@/lib/offline/db";
import { ensureSyncWatchers, onSyncStateChange, syncPendingSales } from "@/lib/offline/sync";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

export function useOfflineSync() {
  const [syncing, setSyncing] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);

  const pendingCount = useLiveQuery(async () => {
    const db = getOfflineDB();
    if (!db) return 0;
    return db.pendingSales.where("status").notEqual("error").count();
  }, [], 0);

  const errorCount = useLiveQuery(async () => {
    const db = getOfflineDB();
    if (!db) return 0;
    return db.pendingSales.where("status").equals("error").count();
  }, [], 0);

  useEffect(() => {
    ensureSyncWatchers();
    const unsubscribe = onSyncStateChange((s) => setSyncing(s.syncing));
    return unsubscribe;
  }, []);

  return {
    online,
    syncing,
    pendingCount: pendingCount ?? 0,
    errorCount: errorCount ?? 0,
    syncNow: syncPendingSales,
  };
}
