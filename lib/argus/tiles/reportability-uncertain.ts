import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TileAggregatorPayload } from "./index";

/**
 * Aggregates open incidents whose reportability classification (OSHA
 * recordable / RIDDOR reportable) is still uncertain. When `siteId` is
 * null the query fans org-wide; when set it scopes to that site. RLS
 * bounds visibility to sites the user can access in either case.
 * Returns `null` only on DB error.
 *
 * v1 proxy: flags high-severity incidents (S1 / S2) marked NOT
 * osha_recordable in the last 60 days. The full "latest argus_suggestion
 * confidence < 0.7" query requires a JSONB path filter that's awkward
 * over RLS — defer to 9.1 if the proxy misses real cases.
 *
 * `freshnessKey` is `today | count | max(updated_at)` so a re-classify or
 * a recordability flip invalidates the cache immediately.
 */
export async function getReportabilityUncertainTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString();

  let q = supabase
    .from("incidents")
    .select("id, ref_code, severity, osha_recordable, updated_at, occurred_at")
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .in("severity", ["S1", "S2"])
    .eq("osha_recordable", false)
    .gte("occurred_at", cutoff)
    .order("occurred_at", { ascending: false })
    .limit(20);
  if (siteId) q = q.eq("site_id", siteId);

  const { data, error } = await q;

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

  return {
    aggregates: { count },
    recordRefs: refs,
    freshnessKey: `${today}|${count}|${maxUpdated}`,
  };
}
