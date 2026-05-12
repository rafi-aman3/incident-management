import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

// capa_status enum has no 'abandoned' value — only ('created','in_progress',
// 'completed','pending_verification','verified','closed'). "Open" = anything
// not yet verified or closed.
export async function getCapaModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const today = new Date().toISOString().slice(0, 10);

  const baseOpen = supabase
    .from("capas")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", "(verified,closed)");
  const baseOverdue = supabase
    .from("capas")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", "(verified,closed)")
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
