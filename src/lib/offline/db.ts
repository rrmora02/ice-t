"use client";

import Dexie, { type Table } from "dexie";
import type { SaleCartItem, PaymentMethod, IceProduct, Customer } from "@/types/db";

export interface PendingSale {
  client_uuid: string; // clave primaria — coincide con sales.client_uuid (idempotencia)
  business_id: string;
  customer_id: string | null;
  items: SaleCartItem[];
  payment_method: PaymentMethod;
  sold_at: string; // ISO
  notes: string | null;
  created_at: string; // ISO, cuándo se guardó localmente
  status: "pending" | "syncing" | "error";
  last_error?: string;
  attempts: number;
}

export interface CachedProduct extends IceProduct {
  business_id: string;
}

export interface CachedCustomer extends Customer {
  business_id: string;
}

/**
 * Base de datos local (IndexedDB vía Dexie) para que un vendedor pueda
 * registrar ventas sin conexión. `pendingSales` es la cola de sincronización;
 * `cachedProducts`/`cachedCustomers` son una copia de lectura para poder
 * armar el carrito aunque no haya red.
 */
class IceTOfflineDB extends Dexie {
  pendingSales!: Table<PendingSale, string>;
  cachedProducts!: Table<CachedProduct, string>;
  cachedCustomers!: Table<CachedCustomer, string>;

  constructor() {
    super("ice-t-offline");
    this.version(1).stores({
      pendingSales: "client_uuid, status, created_at",
      cachedProducts: "id, business_id",
      cachedCustomers: "id, business_id, name",
    });
  }
}

let dbInstance: IceTOfflineDB | null = null;

/** Sólo existe en el navegador; en el servidor (SSR) siempre devuelve null. */
export function getOfflineDB(): IceTOfflineDB | null {
  if (typeof window === "undefined") return null;
  if (!dbInstance) dbInstance = new IceTOfflineDB();
  return dbInstance;
}
