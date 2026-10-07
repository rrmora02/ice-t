import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * Esqueleto del dashboard.
 *
 * Next lo transmite en cuanto resuelve el layout, sin esperar a las
 * consultas de la página. Reproduce la forma real de la pantalla —tres
 * totales, la gráfica, ventas por cliente— para que al llegar los datos no
 * se note un salto de maquetación.
 */
export default function DashboardLoading() {
  return (
    <SkeletonScreen label="Cargando tu resumen…">
      <div className="flex flex-col gap-5">
        {/* Encabezado */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Tres totales */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card flex flex-col gap-2.5 p-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Gráfica de tendencia */}
        <div className="card flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>

        {/* Ventas por cliente */}
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-44" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5 border-b border-[var(--border)] pb-2.5 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-52" />
            </div>
          ))}
        </div>

        {/* Mezcla de producto + widgets laterales */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-44 w-full" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="card flex flex-col gap-2.5 p-4">
              <Skeleton className="h-4 w-40" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
            <div className="card flex flex-col gap-2.5 p-4">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}
