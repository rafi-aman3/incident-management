import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section} className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, card) => (
                <Skeleton key={card} className="h-32 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
