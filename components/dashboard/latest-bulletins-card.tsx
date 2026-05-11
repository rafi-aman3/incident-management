import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard widget — top-3 published bulletins org-wide. Self-fetching
 * async server component (same pattern as the existing ArgusInsightTile
 * mounts). Renders nothing when there are zero published rows so it
 * doesn't take up real estate on a fresh org.
 */
export async function LatestBulletinsCard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("safety_bulletins")
    .select("id, title, summary, published_at")
    .eq("status", "published")
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(3);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Latest safety bulletins</h2>
        </div>
        <Link
          href="/bulletins"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id as string}>
            <Link
              href={`/bulletins/${r.id}`}
              className="flex items-start gap-3 p-3 transition hover:bg-accent/30"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.title as string}</div>
                {r.summary && (
                  <div className="line-clamp-1 text-xs text-muted-foreground">
                    {r.summary as string}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {r.published_at
                  ? formatDistanceToNow(new Date(r.published_at as string), { addSuffix: true })
                  : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
