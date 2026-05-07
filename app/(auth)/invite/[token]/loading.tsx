import { Skeleton } from "@/components/ui/skeleton";

export default function InviteAcceptLoading() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
