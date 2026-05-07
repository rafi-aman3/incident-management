import { Skeleton } from "@/components/ui/skeleton";

export default function InvestigationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
        <Skeleton className="ml-auto h-8 w-32 rounded-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex min-h-[300px] flex-col rounded-lg border bg-muted/30">
            <div className="border-b px-3 py-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-40" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
