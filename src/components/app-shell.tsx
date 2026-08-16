"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Tags,
  Receipt,
  UserCog,
  Settings,
  Menu,
  X,
  LogOut,
  Snowflake,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearLocalBusinessData } from "@/lib/offline/clear-local-data";
import { OfflineIndicator } from "@/components/offline-indicator";
import type { Role } from "@/types/db";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/precios", label: "Precios", icon: Tags, adminOnly: true },
  { href: "/gastos", label: "Gastos", icon: Receipt, adminOnly: true },
  { href: "/vendedores", label: "Vendedores", icon: UserCog, adminOnly: true },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

const MOBILE_PRIMARY = ["/dashboard", "/ventas", "/clientes"];

export function AppShell({
  role,
  businessName,
  userName,
  children,
}: {
  role: Role;
  businessName: string;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === "admin");
  const primaryItems = items.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const moreItems = items.filter((i) => !MOBILE_PRIMARY.includes(i.href));

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Deja el dispositivo limpio: la caché de páginas y el catálogo local
    // son por origen, no por usuario (ver clearLocalBusinessData).
    await clearLocalBusinessData();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-[var(--background)]">
      {/* Sidebar de escritorio */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-[var(--border)] md:bg-[var(--surface)] md:py-6 md:px-4 md:gap-6">
        <div className="flex items-center gap-2 px-2">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[var(--shadow-pop)]">
            <Snowflake className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{businessName}</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              {role === "admin" ? "Administrador" : "Vendedor"}
            </p>
          </div>
        </div>

        <div className="px-2">
          <OfflineIndicator />
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active
                    ? "brand-gradient text-white shadow-[var(--shadow-pop)]"
                    : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-rose-500"
        >
          <LogOut className="h-4.5 w-4.5" />
          Cerrar sesión
        </button>
      </aside>

      {/* Topbar móvil */}
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white">
            <Snowflake className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{businessName}</p>
            <p className="text-[11px] leading-tight text-[var(--foreground-muted)]">{userName}</p>
          </div>
        </div>
        <OfflineIndicator compact />
        <button
          aria-label="Más opciones"
          onClick={() => setMoreOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-muted)]"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
      </header>

      {/* Contenido */}
      <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8 max-w-6xl w-full mx-auto">
        {children}
      </main>

      {/* Bottom nav móvil */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur md:hidden">
        {primaryItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-sky-500" : "text-[var(--foreground-muted)]"
              )}
            >
              <Icon className={clsx("h-5 w-5", active && "scale-110")} />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-[var(--foreground-muted)]"
        >
          <Menu className="h-5 w-5" />
          Más
        </button>
      </nav>

      {/* Sheet "Más" (móvil) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/40 animate-fade-in-up"
            onClick={() => setMoreOpen(false)}
          />
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-2xl bg-[var(--surface)] p-4 shadow-2xl animate-fade-in-up">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Más opciones</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-rose-500 hover:bg-rose-500/10"
              >
                <LogOut className="h-4.5 w-4.5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
