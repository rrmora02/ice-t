"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Client Components. Usa las claves públicas
 * (anon key), que son seguras de exponer porque toda la protección real
 * vive en las políticas RLS de la base de datos.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa tu archivo .env.local"
    );
  }

  return createBrowserClient(url, anonKey);
}
