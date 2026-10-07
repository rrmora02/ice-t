import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/** Esqueleto de Clientes: buscador y lista de fichas. */
export default function ClientesLoading() {
  return (
    <SkeletonScreen label="Cargando tus clientes…">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 w-full sm:w-40" />
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card flex items-center justify-between gap-3 p-3.5">
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
