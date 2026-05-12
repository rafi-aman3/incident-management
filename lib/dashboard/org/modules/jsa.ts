import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

// JSAs use expires_at (date, set on approval to approved_at + 12mo by default)
// for the renewal clock; deleted_at for soft-delete (no retired_at on the table).
export async function getJsaModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Iso = in30.toISOString().slice(0, 10);

  const baseActive = supabase
    .from("jsas")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .is("deleted_at", null);
  const baseExpiring = supabase
    .from("jsas")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .is("deleted_at", null)
    .lte("expires_at", in30Iso)
    .gte("expires_at", today);

  const active = siteId ? baseActive.eq("site_id", siteId) : baseActive.eq("org_id", orgId!);
  const expiring = siteId ? baseExpiring.eq("site_id", siteId) : baseExpiring.eq("org_id", orgId!);

  const [activeRes, expiringRes] = await Promise.all([active, expiring]);
  const expiringCount = expiringRes.count ?? 0;
  return {
    primary: { label: "Approved", value: activeRes.count ?? 0 },
    secondary: {
      label: "Expiring 30d",
      value: expiringCount,
      tone: expiringCount > 0 ? "warn" : "neutral",
    },
  };
}
