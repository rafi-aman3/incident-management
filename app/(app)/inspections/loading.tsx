import { Skeleton } from "@/components/ui/skeleton";

export default function InspectionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="rounded-md border">
        <Skeleton className="h-10 w-full rounded-none rounded-t-md" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-12 w-full rounded-none border-t border-border/40 last:rounded-b-md"
          />
        ))}
      </div>
    </div>
  );
}
