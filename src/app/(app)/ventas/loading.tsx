import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/** Esqueleto de Ventas: rejilla de productos y resumen del carrito. */
export default function VentasLoading() {
  return (
    <SkeletonScreen label="Cargando la pantalla de ventas…">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="card flex flex-col gap-2 p-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="mt-1 h-10 w-full" />
            </div>
          ))}
        </div>

        <div className="card flex flex-col gap-4 p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-8 w-40 self-end" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
