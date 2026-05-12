import Link from "next/link";
import { Boxes, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RecentAssetRow } from "@/lib/dashboard/org/recent-assets";

export function RecentAssetsCard({ rows }: { rows: RecentAssetRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Recent assets</h2>
        <Link
          href="/resources/assets"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No assets yet.</div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
              <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[r.kind, r.site_name].filter(Boolean).join(" · ")}
                  {" · "}
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
              </div>
              <Link
                href={`/resources/assets/${r.id}`}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
