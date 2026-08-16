import { Snowflake } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-[var(--background)]">
      <div className="brand-gradient relative hidden flex-1 flex-col justify-between overflow-hidden p-10 text-white md:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Snowflake className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold">Ice-T</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            Controla la venta de hielo de tu negocio desde cualquier lugar
          </h1>
          <p className="mt-3 text-white/85">
            Precios, clientes, recordatorios de reabasto, ventas y gastos en una sola app
            instalable, incluso sin conexión.
          </p>
        </div>
        <p className="text-sm text-white/70">© {new Date().getFullYear()} Ice-T</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-white/10" />
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white">
              <Snowflake className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Ice-T</span>
          </div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
