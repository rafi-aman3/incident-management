import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Per-org daily token budget. Soft warn at 80%, hard cap at 100% of
 * `orgs.argus_daily_token_budget`. Both lookups in one query — admin client
 * because we sum across all users in the org regardless of site access.
 *
 * Budget consumes input + output + cache_create tokens. Cache reads are
 * effectively free (~0.1× input) and don't count toward the cap.
 */
export interface BudgetStatus {
  used: number;
  cap: number;
  pct: number;
  warn: boolean; // ≥80% consumed
  blocked: boolean; // ≥100% consumed
}

export async function checkArgusBudget(orgId: string): Promise<BudgetStatus> {
  const admin = createAdminClient();

  const [orgResult, sumResult] = await Promise.all([
    admin
      .from("orgs")
      .select("argus_daily_token_budget")
      .eq("id", orgId)
      .single(),
    admin
      .from("argus_suggestions")
      .select("prompt_tokens, completion_tokens, cache_create_tokens")
      .eq("org_id", orgId)
      .gte("created_at", startOfDayUtc()),
  ]);

  if (orgResult.error || !orgResult.data) {
    throw new Error(`org ${orgId} not found: ${orgResult.error?.message}`);
  }

  const cap = Number(orgResult.data.argus_daily_token_budget) || 0;
  const used = (sumResult.data ?? []).reduce(
    (acc, row) =>
      acc +
      (row.prompt_tokens ?? 0) +
      (row.completion_tokens ?? 0) +
      (row.cache_create_tokens ?? 0),
    0,
  );

  const pct = cap === 0 ? 0 : used / cap;
  return {
    used,
    cap,
    pct,
    warn: pct >= 0.8,
    blocked: pct >= 1.0,
  };
}

function startOfDayUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}
