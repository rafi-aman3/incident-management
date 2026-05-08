import { Skeleton } from "@/components/ui/skeleton";

export default function TemplateAssignLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-3 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-full" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex justify-end pt-2">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  );
}
