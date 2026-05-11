import { Skeleton } from "@/components/ui/skeleton";

export default function ArgusLoading() {
  return (
    <div className="space-y-5 rounded-lg border bg-card p-5">
      {/* Header with icon */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>

      {/* Status block */}
      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-72" />
      </div>

      {/* Toggle row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-80" />
        </div>
        <Skeleton className="h-5 w-9 rounded-full" />
      </div>
    </div>
  );
}
