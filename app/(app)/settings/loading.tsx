import { Skeleton } from "@/components/ui/skeleton";

/**
 * Top-level Settings loading skeleton. Fires while the layout's permission
 * resolution and the initial tab's data both stream in.
 *
 * Per-tab skeletons live in `<tab>/loading.tsx` and override this one as soon
 * as the layout settles — each matches the actual content of that tab so
 * the layout never jumps when the data arrives.
 */
export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-96" />
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Desktop sidebar rail */}
        <aside className="hidden lg:block lg:w-56 lg:shrink-0">
          <div className="space-y-5">
            {[3, 1, 2, 3].map((rows, g) => (
              <div key={g} className="space-y-1.5 px-3">
                <Skeleton className="h-3 w-20" />
                {Array.from({ length: rows }).map((_, t) => (
                  <Skeleton key={t} className="h-7 w-full" />
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile select trigger */}
        <div className="mb-4 lg:hidden">
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Generic content placeholder — replaced by per-tab loading.tsx
            as soon as the layout finishes resolving permissions. */}
        <section className="flex-1 min-w-0">
          <div className="space-y-4 rounded-lg border bg-card p-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        </section>
      </div>
    </div>
  );
}
