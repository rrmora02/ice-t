"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { clearLocalBusinessData } from "@/lib/offline/clear-local-data";

export default function CuentaDesactivadaPage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearLocalBusinessData();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] p-6">
      <div className="card max-w-sm p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">Tu cuenta está desactivada</h1>
        <p className="mt-1.5 text-sm text-[var(--foreground-muted)]">
          Pide al administrador de tu negocio que reactive tu acceso desde la sección de Vendedores.
        </p>
        <Button className="mt-4 w-full justify-center" variant="outline" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
