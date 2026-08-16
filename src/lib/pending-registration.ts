"use client";

// Si el proyecto de Supabase tiene activada la confirmación de correo, el
// usuario no obtiene sesión inmediatamente tras `signUp`, por lo que no se
// puede llamar aún al RPC `create_business_and_admin` (requiere
// auth.uid()). Guardamos el nombre del negocio temporalmente para
// completarlo automáticamente en /registro/completar tras confirmar el
// correo e iniciar sesión.

const KEY = "ice-t:pending-business";

export interface PendingRegistration {
  businessName: string;
  fullName: string;
}

export function savePendingRegistration(data: PendingRegistration) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // localStorage puede no estar disponible (modo privado); no es crítico.
  }
}

export function readPendingRegistration(): PendingRegistration | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingRegistration) : null;
  } catch {
    return null;
  }
}

export function clearPendingRegistration() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
