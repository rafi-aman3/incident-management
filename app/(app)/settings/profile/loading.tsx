import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-80" />
      </div>
      {/* Display name + Department + Email rows */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
          {i === 2 && <Skeleton className="h-3 w-72" />}
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
