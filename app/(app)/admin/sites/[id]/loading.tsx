import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSiteDetailLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex gap-1 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-none" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
