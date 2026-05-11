import { requireUser } from "@/lib/supabase/auth";
import { ArgusPrefsCard } from "@/components/settings/argus-prefs-card";

export default async function SettingsArgusPage() {
  const { supabase, profile } = await requireUser();

  const { data: org } = await supabase
    .from("orgs")
    .select("argus_enabled, argus_daily_token_budget")
    .eq("id", profile.org_id)
    .maybeSingle();

  // Sum today's token consumption (UTC day). cache_tokens are billed, so we
  // include all four counters in the display "used today" total.
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  const { data: suggestions } = await supabase
    .from("argus_suggestions")
    .select("prompt_tokens, completion_tokens, cache_create_tokens, cache_read_tokens")
    .eq("org_id", profile.org_id)
    .gte("created_at", startOfDayUtc.toISOString());

  const tokensUsedToday = (suggestions ?? []).reduce((sum, s) => {
    return (
      sum +
      (s.prompt_tokens ?? 0) +
      (s.completion_tokens ?? 0) +
      (s.cache_create_tokens ?? 0) +
      (s.cache_read_tokens ?? 0)
    );
  }, 0);

  return (
    <ArgusPrefsCard
      orgEnabled={Boolean(org?.argus_enabled)}
      tokensUsedToday={tokensUsedToday}
      tokensBudget={Number(org?.argus_daily_token_budget ?? 0)}
      initialPanelDefault={profile.argus_panel_default}
    />
  );
}
