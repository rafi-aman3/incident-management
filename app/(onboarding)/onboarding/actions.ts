"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { Database } from "@/lib/supabase/types";
import { USE_CASE_KEYS, type UseCaseKey } from "@/lib/get-started/use-cases";

type IndustryType = Database["public"]["Enums"]["industry_type"];
const INDUSTRY_VALUES: ReadonlyArray<IndustryType> = [
  "healthcare", "education", "manufacturing", "warehouse",
  "office", "construction", "lab",
];

const bootstrapSchema = z.object({
  org_name: z.string().trim().min(1, "Organization name is required").max(120),
  industry: z.enum(INDUSTRY_VALUES as unknown as [IndustryType, ...IndustryType[]]),
  site_name: z.string().trim().min(1, "Site name is required").max(120),
  country: z.enum(["US", "GB"]),
  timezone: z.string().trim().min(1, "Timezone is required").max(60),
});

export async function bootstrapOrg(
  _prev: ActionResult<{ siteId: string }> | null,
  fd: FormData
): Promise<ActionResult<{ siteId: string }>> {
  const parsed = bootstrapSchema.safeParse({
    org_name: fd.get("org_name"),
    industry: fd.get("industry"),
    site_name: fd.get("site_name"),
    country: fd.get("country"),
    timezone: fd.get("timezone"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bootstrap_org_v1", {
    p_org_name: parsed.data.org_name,
    p_industry: parsed.data.industry,
    p_country: parsed.data.country,
    p_site_name: parsed.data.site_name,
    p_timezone: parsed.data.timezone,
  });
  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("site_id" in row)) {
    return { ok: false, error: "Bootstrap returned no site id" };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { siteId: String(row.site_id) } };
}

const finishSchema = z.object({
  use_cases: z.array(z.enum(USE_CASE_KEYS as unknown as [UseCaseKey, ...UseCaseKey[]])).min(0).max(USE_CASE_KEYS.length),
});

/**
 * Phase 18 — finish onboarding with picked use-cases.
 *
 * Step 2 of the slim wizard submits the picked tiles (zero-or-more). Empty
 * array is allowed (= "show me everything" maps to picking all five on the
 * client side before submission). Writes orgs.onboarding_use_cases,
 * stamps profiles.onboarded_at, redirects to /dashboard?welcome=1.
 */
export async function finishOnboardingWithUseCases(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // FormData carries multi-value 'use_cases' entries.
  const raw = fd.getAll("use_cases").map(String);
  const parsed = finishSchema.safeParse({ use_cases: raw });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (profErr || !profile) return { ok: false, error: profErr?.message ?? "Profile missing" };

  const { error: updErr } = await supabase
    .from("orgs")
    .update({ onboarding_use_cases: parsed.data.use_cases })
    .eq("id", profile.org_id);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/dashboard?welcome=1");
}
