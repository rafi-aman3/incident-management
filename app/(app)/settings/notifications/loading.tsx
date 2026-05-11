import { Skeleton } from "@/components/ui/skeleton";

const GROUP_ROW_COUNTS = [6, 1, 2, 2, 2] as const;

export default function NotificationsLoading() {
  return (
    <div className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-80" />
      </div>

      <div className="space-y-6">
        {GROUP_ROW_COUNTS.map((rowCount, g) => (
          <div key={g} className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                {g < 2 && <Skeleton className="h-4 w-14 rounded-full" />}
              </div>
              {g < 2 && <Skeleton className="h-3 w-64" />}
            </div>
            <ul className="divide-y rounded-md border">
              {Array.from({ length: rowCount }).map((_, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
