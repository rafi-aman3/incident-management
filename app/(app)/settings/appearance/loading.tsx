import { Skeleton } from "@/components/ui/skeleton";

export default function AppearanceLoading() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-80" />
      </div>
      {/* 3-button radiogroup pill */}
      <div className="inline-flex gap-1 rounded-md border bg-muted/30 p-1">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-24" />
      </div>
    </div>
  );
}
