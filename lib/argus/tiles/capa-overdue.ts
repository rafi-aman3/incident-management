import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TileAggregatorPayload } from "./index";

/**
 * Open CAPAs (any status that isn't `verified` / `closed` / `rejected`)
 * whose `due_date` is in the past for the caller's current site.
 *
 * `freshnessKey` mixes `today | count | max(updated_at)` so a CAPA flipping
 * to `verified` or a due-date push invalidates the cache immediately, and
 * the trailing `today` makes "5 days overdue" become "6 days overdue" the
 * next morning without serving a stale summary.
 */
export async function getCapaOverdueTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  if (!siteId) return null;

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("capas")
    .select("id, ref_code, due_date, status, updated_at")
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .not("status", "in", "(verified,closed,rejected)")
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);

  if (error || !data) return null;

  const rows = data;
  const count = rows.length;
  const refs = rows
    .slice(0, 5)
    .map((r) => r.ref_code)
    .filter((r): r is string => Boolean(r));

  const maxUpdated = rows.reduce(
    (acc, r) => (r.updated_at > acc ? r.updated_at : acc),
    "1970-01-01T00:00:00Z",
  );

  const today0 = new Date(today + "T00:00:00Z").getTime();
  const oldestOverdueDays =
    rows.reduce((max, r) => {
      if (!r.due_date) return max;
      const d = Math.floor(
        (today0 - new Date(r.due_date + "T00:00:00Z").getTime()) /
          (24 * 60 * 60 * 1000),
      );
      return d > max ? d : max;
    }, 0) | 0;

  return {
    aggregates: {
      count,
      oldest_overdue_days: oldestOverdueDays,
    },
    recordRefs: refs,
    freshnessKey: `${today}|${count}|${maxUpdated}`,
  };
}
