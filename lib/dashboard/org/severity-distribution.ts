import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type SeverityDistributionRow = {
  severity: "S1" | "S2" | "S3" | "S4";
  count: number;
};

export async function getSeverityDistributionYtd(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<SeverityDistributionRow[]> {
  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  let q = supabase
    .from("incidents")
    .select("severity")
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .not("severity", "is", null);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);

  const { data } = await q;
  const counts: Record<"S1" | "S2" | "S3" | "S4", number> = { S1: 0, S2: 0, S3: 0, S4: 0 };
  (data ?? []).forEach((r) => {
    if (r.severity === "S1" || r.severity === "S2" || r.severity === "S3" || r.severity === "S4") {
      counts[r.severity] += 1;
    }
  });
  return (["S1", "S2", "S3", "S4"] as const).map((s) => ({ severity: s, count: counts[s] }));
}
