import { Skeleton } from "@/components/ui/skeleton";

export default function SiteSetupLoading() {
  return (
    <div className="space-y-6 py-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-12 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  );
}
