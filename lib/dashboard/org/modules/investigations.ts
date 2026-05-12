import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

export async function getInvestigationsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const today = new Date().toISOString().slice(0, 10);

  const baseOpen = supabase
    .from("investigations")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .neq("status", "closed");
  const baseOverdue = supabase
    .from("investigations")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .neq("status", "closed")
    .lt("due_date", today);

  const open = siteId ? baseOpen.eq("site_id", siteId) : baseOpen.eq("org_id", orgId!);
  const overdue = siteId ? baseOverdue.eq("site_id", siteId) : baseOverdue.eq("org_id", orgId!);

  const [openRes, overdueRes] = await Promise.all([open, overdue]);
  const overdueCount = overdueRes.count ?? 0;
  return {
    primary: { label: "Open", value: openRes.count ?? 0 },
    secondary: {
      label: "Overdue",
      value: overdueCount,
      tone: overdueCount > 0 ? "alert" : "neutral",
    },
  };
}
