import { Skeleton } from "@/components/ui/skeleton";

export default function NewTemplateLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  );
}
