import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TileAggregatorPayload } from "./index";

/**
 * Aggregates active stop-work events that have not yet been lifted.
 * When `siteId` is null the query fans org-wide; when set it scopes to
 * that site. RLS bounds visibility to sites the user can access in
 * either case. Returns `null` only on DB error.
 *
 * `freshnessKey` mixes count + max(raised_at) so a lift action or a new
 * stop-work invalidates the cache immediately. Highest-priority signal on
 * the platform. The 1h TTL on `tile_stop_work_active` is a backstop; freshness
 * does the real work.
 */
export async function getStopWorkActiveTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  let q = supabase
    .from("incidents")
    .select("id, ref_code, stop_work_raised_at")
    .eq("stop_work", true)
    .is("stop_work_acknowledged_at", null)
    .is("deleted_at", null)
    .order("stop_work_raised_at", { ascending: false })
    .limit(10);
  if (siteId) q = q.eq("site_id", siteId);

  const { data, error } = await q;

  if (error || !data) return null;

  const rows = data;
  const count = rows.length;
  const refs = rows
    .slice(0, 5)
    .map((r) => r.ref_code)
    .filter((r): r is string => Boolean(r));

  const latestRaised = rows.reduce(
    (acc, r) => {
      if (!r.stop_work_raised_at) return acc;
      return r.stop_work_raised_at > acc ? r.stop_work_raised_at : acc;
    },
    "1970-01-01T00:00:00Z",
  );

  return {
    aggregates: { count },
    recordRefs: refs,
    freshnessKey: `${count}|${latestRaised}`,
  };
}
