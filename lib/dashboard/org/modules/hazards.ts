import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

// residual_risk_score lives on hazard_risk_assessments, not hazards. Mirror
// the join pattern from app/(app)/hazards/page.tsx for the High-residual count.
export async function getHazardsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const baseTotal = supabase
    .from("hazards")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", "(closed,superseded)");
  const baseHigh = supabase
    .from("hazard_risk_assessments")
    .select("hazard_id, hazards!inner(id, deleted_at, status, site_id, org_id)", {
      count: "exact",
      head: true,
    })
    .in("residual_risk_score", ["S1", "S2"])
    .is("superseded_at", null)
    .is("hazards.deleted_at", null)
    .not("hazards.status", "in", "(closed,superseded)");

  const total = siteId ? baseTotal.eq("site_id", siteId) : baseTotal.eq("org_id", orgId!);
  const high = siteId
    ? baseHigh.eq("hazards.site_id", siteId)
    : baseHigh.eq("hazards.org_id", orgId!);

  const [totalRes, highRes] = await Promise.all([total, high]);
  const highCount = highRes.count ?? 0;
  return {
    primary: { label: "Open", value: totalRes.count ?? 0 },
    secondary: {
      label: "High residual",
      value: highCount,
      tone: highCount > 0 ? "warn" : "neutral",
    },
  };
}
