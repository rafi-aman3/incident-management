import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TileAggregatorPayload } from "./index";

/**
 * Regulatory-paperwork pulse for the `/reports` index tile. Counts open
 * exposure on each of the four reports surfaces:
 *   - OSHA-recordable cases YTD (drive 300/300A)
 *   - OSHA-301 due in next 7d (recordable in last 7d)
 *   - RIDDOR-reportable YTD (GB sites only)
 *
 * `freshnessKey` includes `today` so the "7 days" window slides correctly
 * each morning even when no underlying row changed.
 */
export async function getReportsPendingSummaryTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  if (!siteId) return null;

  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [recordableRes, osha301PendingRes, riddorRes, recentRecordableRefs] =
    await Promise.all([
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("osha_recordable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte("occurred_at", yearStart)
        .lt("occurred_at", yearEnd),
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("osha_recordable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte("occurred_at", sevenDaysAgo),
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId)
        .eq("riddor_reportable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte("occurred_at", yearStart)
        .lt("occurred_at", yearEnd),
      supabase
        .from("incidents")
        .select("ref_code, updated_at, occurred_at")
        .eq("site_id", siteId)
        .eq("osha_recordable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte("occurred_at", sevenDaysAgo)
        .order("occurred_at", { ascending: false })
        .limit(5),
    ]);

  if (
    recordableRes.error ||
    osha301PendingRes.error ||
    riddorRes.error ||
    recentRecordableRefs.error
  ) {
    return null;
  }

  const oshaRecordableYtd = recordableRes.count ?? 0;
  const osha301Pending = osha301PendingRes.count ?? 0;
  const riddorYtd = riddorRes.count ?? 0;
  const refs = (recentRecordableRefs.data ?? [])
    .map((r) => r.ref_code)
    .filter((r): r is string => Boolean(r));

  const maxUpdated = (recentRecordableRefs.data ?? []).reduce(
    (acc, r) => (r.updated_at && r.updated_at > acc ? r.updated_at : acc),
    "1970-01-01T00:00:00Z",
  );

  return {
    aggregates: {
      osha_recordable_ytd: oshaRecordableYtd,
      osha_301_pending: osha301Pending,
      riddor_ytd: riddorYtd,
    },
    recordRefs: refs,
    freshnessKey: `${today}|${oshaRecordableYtd}|${osha301Pending}|${riddorYtd}|${maxUpdated}`,
  };
}
