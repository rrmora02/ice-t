import { clsx } from "clsx";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--foreground-muted)]",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  brand: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        // `whitespace-nowrap`: una insignia es una pastilla de una sola línea.
        // Sin esto, "5 ventas" o "Vencido hace 3d" se parten en dos renglones
        // en cuanto el contenedor se estrecha en móvil.
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
