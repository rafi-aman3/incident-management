import { Skeleton } from "@/components/ui/skeleton";

export default function Osha301Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-md" />
      <div className="rounded-md border">
        <Skeleton className="h-16 w-full rounded-t-md" />
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full border-t" />
        ))}
      </div>
    </div>
  );
}
