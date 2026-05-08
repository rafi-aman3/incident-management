import { Skeleton } from "@/components/ui/skeleton";

export default function PlannerLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-6 w-72" />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="m-2 h-3 rounded" />
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[88px] space-y-1 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0"
            >
              <Skeleton className="h-3 w-5" />
              {i % 4 === 0 ? <Skeleton className="h-4 w-full" /> : null}
              {i % 7 === 0 ? <Skeleton className="h-4 w-2/3" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
