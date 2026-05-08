import { Skeleton } from "@/components/ui/skeleton";

export default function TemplateEditorLoading() {
  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-64" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* 3-column shell */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
          <div className="border-b p-2">
            <Skeleton className="h-7 w-full" />
          </div>
          <div className="flex-1 space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
          <div className="border-t p-2">
            <Skeleton className="h-8 w-full" />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </main>

        <aside className="w-80 shrink-0 border-l bg-card p-4">
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </aside>
      </div>
    </div>
  );
}
