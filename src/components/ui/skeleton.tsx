import { clsx } from "clsx";

/**
 * Bloque gris con pulso, para ocupar el hueco de un dato que todavía no
 * llegó.
 *
 * La animación se apaga sola con `prefers-reduced-motion` (ver la regla
 * global en `globals.css`), así que no hace falta condicionarla aquí.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx("animate-pulse rounded-lg bg-[var(--surface-muted)]", className)}
    />
  );
}

/**
 * Envoltorio para una pantalla que está cargando.
 *
 * Lleva el `role="status"` y el texto para lectores de pantalla una sola
 * vez, en lugar de repetirlo en cada bloque: quien navega con lector oye
 * "Cargando…" y no una ristra de elementos vacíos.
 */
export function SkeletonScreen({
  children,
  label = "Cargando…",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
