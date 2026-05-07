import { Skeleton } from "@/components/ui/skeleton";

export default function AdminInvitationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-12 rounded-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-md" />
    </div>
  );
}
