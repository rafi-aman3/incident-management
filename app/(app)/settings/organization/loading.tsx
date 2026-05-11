import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationLoading() {
  return (
    <div className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-72" />
      </div>

      {/* Logo uploader */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-12" />
        <div className="flex items-start gap-4">
          <Skeleton className="h-24 w-24 rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-9 w-full" />
      </div>

      {/* Industry */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-full" />
      </div>

      {/* Workspace ID + copy */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>

      <div className="flex justify-end pt-1">
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
