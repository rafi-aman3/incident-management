import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ModuleCardData = {
  primary: { label: string; value: number };
  secondary: { label: string; value: number; tone: "neutral" | "warn" | "alert" };
};

export async function getIncidentsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const baseOpen = supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .neq("status", "closed");
  const baseS1S2 = supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .in("severity", ["S1", "S2"])
    .neq("status", "closed");

  const open = siteId ? baseOpen.eq("site_id", siteId) : baseOpen.eq("org_id", orgId!);
  const s1s2 = siteId ? baseS1S2.eq("site_id", siteId) : baseS1S2.eq("org_id", orgId!);

  const [openRes, s1s2Res] = await Promise.all([open, s1s2]);

  const s1s2Count = s1s2Res.count ?? 0;
  return {
    primary: { label: "Open", value: openRes.count ?? 0 },
    secondary: {
      label: "S1/S2",
      value: s1s2Count,
      tone: s1s2Count > 0 ? "alert" : "neutral",
    },
  };
}
