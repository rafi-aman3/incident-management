import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar rail */}
        <aside className="hidden lg:block lg:w-56 lg:shrink-0">
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, g) => (
              <div key={g} className="space-y-1.5 px-3">
                <Skeleton className="h-3 w-20" />
                {Array.from({ length: 2 + (g % 2) }).map((_, t) => (
                  <Skeleton key={t} className="h-7 w-full" />
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile select */}
        <div className="mb-4 lg:hidden">
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Content area */}
        <section className="flex-1 min-w-0 space-y-4">
          <div className="space-y-4 rounded-lg border bg-card p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-72" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <div className="flex justify-end">
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
