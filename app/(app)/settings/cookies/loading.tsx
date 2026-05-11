import { Skeleton } from "@/components/ui/skeleton";

export default function CookiesLoading() {
  return (
    <div className="space-y-5 rounded-lg border bg-card p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}
