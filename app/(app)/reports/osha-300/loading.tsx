import { Skeleton } from "@/components/ui/skeleton";

export default function Osha300Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="ml-auto h-8 w-32" />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Skeleton className="h-10 w-full rounded-t-md" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full border-t" />
        ))}
      </div>
    </div>
  );
}
