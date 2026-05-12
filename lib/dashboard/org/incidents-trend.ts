import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type TrendRow = {
  month: string;
  monthLabel: string;
  S1: number;
  S2: number;
  S3: number;
  S4: number;
};

const SEV_KEYS = ["S1", "S2", "S3", "S4"] as const;
type SevKey = (typeof SEV_KEYS)[number];

export async function getIncidentsTrend(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<TrendRow[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startIso = start.toISOString();

  let q = supabase
    .from("incidents")
    .select("occurred_at, severity")
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .gte("occurred_at", startIso)
    .not("severity", "is", null);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);

  const { data } = await q;
  const rows = data ?? [];

  const buckets = new Map<string, TrendRow>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    buckets.set(month, { month, monthLabel, S1: 0, S2: 0, S3: 0, S4: 0 });
  }

  for (const r of rows) {
    if (!r.occurred_at || !r.severity) continue;
    const d = new Date(r.occurred_at);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(month);
    if (!bucket) continue;
    if ((SEV_KEYS as readonly string[]).includes(r.severity)) {
      bucket[r.severity as SevKey] += 1;
    }
  }

  return Array.from(buckets.values());
}
