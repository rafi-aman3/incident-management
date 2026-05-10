import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TileAggregatorPayload } from "./index";

/**
 * In-progress + recently-failed inspections at the caller's current site.
 * The plan reads this tile as "due in the next 7 days" but `template_assignments`
 * uses cron strings rather than fixed dates — for v1 we pivot to the closest
 * proxy: count of in_progress runs (visibly behind the inspector) plus failed
 * runs from the last 14 days that still have unresolved findings.
 *
 * Recompute the cron-derived "due in 7d" lift in 9.1 if the proxy underdrives
 * the dashboard signal.
 */
export async function getInspectionsDueSummaryTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  if (!siteId) return null;

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [inProgressRes, failedRes, assignmentsRes] = await Promise.all([
    supabase
      .from("inspections")
      .select("id, ref_code, status, updated_at, started_at")
      .eq("site_id", siteId)
      .is("deleted_at", null)
      .in("status", ["draft", "in_progress"])
      .order("started_at", { ascending: true })
      .limit(20),
    supabase
      .from("inspections")
      .select("id, ref_code, status, updated_at, conducted_at")
      .eq("site_id", siteId)
      .eq("status", "completed")
      .eq("is_failed", true)
      .gte("conducted_at", cutoff)
      .order("conducted_at", { ascending: false })
      .limit(20),
    supabase
      .from("template_assignments")
      .select("id, schedule_kind")
      .eq("site_id", siteId)
      .is("unassigned_at", null),
  ]);

  if (
    inProgressRes.error ||
    failedRes.error ||
    assignmentsRes.error ||
    !inProgressRes.data ||
    !failedRes.data ||
    !assignmentsRes.data
  ) {
    return null;
  }

  const inProgressRows = inProgressRes.data;
  const failedRows = failedRes.data;
  const assignmentRows = assignmentsRes.data;

  const inProgressCount = inProgressRows.length;
  const recentFailedCount = failedRows.length;
  const scheduledAssignments = assignmentRows.filter(
    (a) => a.schedule_kind !== "on_demand",
  ).length;

  const refs: string[] = [];
  for (const r of inProgressRows.slice(0, 3)) {
    if (r.ref_code) refs.push(r.ref_code);
  }
  for (const r of failedRows.slice(0, 5 - refs.length)) {
    if (r.ref_code) refs.push(r.ref_code);
  }

  const maxUpdated = [...inProgressRows, ...failedRows].reduce(
    (acc, r) => (r.updated_at > acc ? r.updated_at : acc),
    "1970-01-01T00:00:00Z",
  );

  return {
    aggregates: {
      in_progress: inProgressCount,
      recent_failed: recentFailedCount,
      scheduled_assignments: scheduledAssignments,
    },
    recordRefs: refs,
    freshnessKey: `${today}|${inProgressCount}|${recentFailedCount}|${maxUpdated}`,
  };
}
