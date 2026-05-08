import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Cards-shape skeleton (default view) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
