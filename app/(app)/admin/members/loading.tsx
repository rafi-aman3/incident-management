import { Skeleton } from "@/components/ui/skeleton";

export default function AdminMembersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="ml-auto h-8 w-64 rounded-md" />
      </div>
      <Skeleton className="h-72 w-full rounded-md" />
    </div>
  );
}
