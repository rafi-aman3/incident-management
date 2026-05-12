import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

// The inspections table has no scheduled-date column (schedules live on
// template_assignments.schedule_cron). Mirror the lib/argus/tiles/inspections-
// due-summary.ts proxy: surface "In progress" + "Failed (14d)" as the two
// dashboard signals.
export async function getInspectionsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const baseInProgress = supabase
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .in("status", ["draft", "in_progress"])
    .is("deleted_at", null);
  const baseFailed = supabase
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .eq("is_failed", true)
    .gte("conducted_at", cutoff)
    .is("deleted_at", null);

  const inProgress = siteId
    ? baseInProgress.eq("site_id", siteId)
    : baseInProgress.eq("org_id", orgId!);
  const failed = siteId
    ? baseFailed.eq("site_id", siteId)
    : baseFailed.eq("org_id", orgId!);

  const [inProgressRes, failedRes] = await Promise.all([inProgress, failed]);
  const failedCount = failedRes.count ?? 0;
  return {
    primary: { label: "In progress", value: inProgressRes.count ?? 0 },
    secondary: {
      label: "Failed (14d)",
      value: failedCount,
      tone: failedCount > 0 ? "alert" : "neutral",
    },
  };
}
