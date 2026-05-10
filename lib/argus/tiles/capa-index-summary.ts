import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TileAggregatorPayload } from "./index";

/**
 * Cluster heuristic for the `/capa` index tile. Counts active CAPAs by
 * `type` over the last 60 days and surfaces the dominant category — the
 * model uses this to spot a category-level control opportunity.
 *
 * `aggregates` carries one entry per CAPA type seen in the window plus
 * `total` and `dominant_share` (0..100). The model never sees free-text
 * titles — type-level counts only.
 */
export async function getCapaIndexSummaryTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  if (!siteId) return null;

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("capas")
    .select("id, ref_code, type, status, updated_at")
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .not("status", "in", "(closed,rejected)")
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error || !data) return null;

  const rows = data;
  const total = rows.length;
  if (total === 0) {
    return {
      aggregates: { total: 0 },
      recordRefs: [],
      freshnessKey: `${today}|0`,
    };
  }

  const byType = new Map<string, number>();
  for (const r of rows) {
    const k = String(r.type ?? "unknown");
    byType.set(k, (byType.get(k) ?? 0) + 1);
  }

  let dominantType = "unknown";
  let dominantCount = 0;
  for (const [k, v] of byType) {
    if (v > dominantCount) {
      dominantType = k;
      dominantCount = v;
    }
  }

  const aggregates: Record<string, number> = {
    total,
    dominant_share: Math.round((dominantCount / total) * 100),
    dominant_count: dominantCount,
  };
  for (const [k, v] of byType) {
    aggregates[`type_${k}`] = v;
  }

  const refs = rows
    .filter((r) => String(r.type) === dominantType)
    .slice(0, 5)
    .map((r) => r.ref_code)
    .filter((r): r is string => Boolean(r));

  const maxUpdated = rows.reduce(
    (acc, r) => (r.updated_at > acc ? r.updated_at : acc),
    "1970-01-01T00:00:00Z",
  );

  return {
    aggregates,
    recordRefs: refs,
    freshnessKey: `${today}|${total}|${dominantType}|${maxUpdated}`,
  };
}
