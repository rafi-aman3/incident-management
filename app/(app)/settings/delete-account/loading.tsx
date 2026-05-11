import { Skeleton } from "@/components/ui/skeleton";

export default function DeleteAccountLoading() {
  return (
    <div className="space-y-5 rounded-lg border border-destructive/40 bg-card p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>

      {/* Info box */}
      <div className="space-y-2 rounded-md bg-muted/30 p-3">
        <Skeleton className="h-3 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>

      <Skeleton className="h-9 w-44" />
    </div>
  );
}
