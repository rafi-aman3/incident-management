import { Skeleton } from "@/components/ui/skeleton";

export default function SecurityLoading() {
  return (
    <div className="space-y-4">
      {/* Security card: header + 3 password fields + sign-out-everywhere */}
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-80" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-full" />
            {i === 1 && <Skeleton className="h-3 w-72" />}
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>

      {/* Sign-out section */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-80" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}
