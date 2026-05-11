import { Skeleton } from "@/components/ui/skeleton";

export default function SidebarLoading() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-80" />
      </div>
      <ul className="space-y-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <li key={i} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-4 rounded-sm" />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-3">
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-7 w-24" />
      </div>
    </div>
  );
}
