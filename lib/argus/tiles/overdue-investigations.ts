import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TileAggregatorPayload } from "./index";

/**
 * Aggregates open investigations whose `due_date` is in the past for the
 * caller's current site. Read-only — RLS bounds visibility to sites the
 * user can access. Returns `null` when there's no current site so the page
 * can hide the tile entirely.
 *
 * `freshnessKey` mixes `count` + max(updated_at) so a status flip (closed)
 * or a due-date push invalidates the cache immediately. The trailing date
 * stamp ensures "still 3 overdue" yesterday and today are distinct cache
 * rows — a 1-day-stalled summary stops being literally true overnight.
 */
export async function getOverdueInvestigationsTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  if (!siteId) return null;
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("investigations")
    .select("id, ref_code, due_date, updated_at, status")
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .neq("status", "closed")
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
