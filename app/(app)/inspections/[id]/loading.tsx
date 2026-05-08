import { Skeleton } from "@/components/ui/skeleton";

export default function InspectionDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />

      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
