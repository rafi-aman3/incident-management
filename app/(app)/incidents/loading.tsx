import { Skeleton } from "@/components/ui/skeleton";

export default function IncidentsLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* KPI row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>

      {/* Trend chart */}
      <Skeleton className="h-[340px] w-full rounded-xl" />

      {/* Breakdown row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>

      {/* Status pipeline */}
      <Skeleton className="h-32 w-full rounded-xl" />

      {/* List */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-12 rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-3 h-72 w-full rounded-md" />
      </div>
    </div>
  );
}
