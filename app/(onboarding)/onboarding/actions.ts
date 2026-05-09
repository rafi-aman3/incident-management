"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { Database } from "@/lib/supabase/types";

type IndustryType = Database["public"]["Enums"]["industry_type"];
const INDUSTRY_VALUES: ReadonlyArray<IndustryType> = [
  "healthcare",
  "education",
  "manufacturing",
  "warehouse",
  "office",
  "construction",
  "lab",
];

const bootstrapSchema = z.object({
  org_name: z
    .string()
    .trim()
    .min(1, "Organization name is required")
    .max(120, "Organization name is too long"),
  industry: z.enum(INDUSTRY_VALUES as unknown as [IndustryType, ...IndustryType[]]),
  site_name: z
    .string()
    .trim()
    .min(1, "Site name is required")
    .max(120, "Site name is too long"),
  country: z.enum(["US", "GB"]),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .max(60, "Timezone is too long"),
});

/**
 * Phase 12 — Onboarding Step 1+2 commit.
 *
 * Calls bootstrap_org_v1 RPC to atomically create org + profile + first
 * site + first membership + default roles. Returns the new {org_id,
 * site_id} so the page can advance to Step 3 (invite teammates).
 */
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
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
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

  // The new profile row is now visible to RLS. Refresh layout caches so
  // the topbar / sidebar pick up the org + first site.
  revalidatePath("/", "layout");

  return { ok: true, data: { siteId: String(row.site_id) } };
}

const invitesSchema = z.object({
  site_id: z.string().uuid(),
  emails: z.string().trim(),
});

/**
 * Phase 12 — Onboarding Step 3 commit (optional).
 *
 * Parses up to 5 comma- or newline-separated emails and fires
 * invite_member_to_site_v1 (Phase 11c RPC) for each. Default role = worker;
 * include_children = true. Partial success is allowed — failures collected
 * and surfaced inline; the user moves on either way.
 */
export async function inviteOnOnboarding(
  _prev: ActionResult<{ sent: number; failed: string[] }> | null,
  fd: FormData
): Promise<ActionResult<{ sent: number; failed: string[] }>> {
  const parsed = invitesSchema.safeParse({
    site_id: fd.get("site_id"),
    emails: fd.get("emails"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const emails = parsed.data.emails
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
    .slice(0, 5);

  if (emails.length === 0) {
    return { ok: true, data: { sent: 0, failed: [] } };
  }

  const supabase = await createClient();

  // Look up the worker role id for the new org. The site row resolves the
  // org via the RLS-bound select.
  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("org_id")
    .eq("id", parsed.data.site_id)
    .single();
  if (siteErr || !site) {
    return { ok: false, error: siteErr?.message ?? "Site not found" };
  }

  const { data: workerRole, error: roleErr } = await supabase
    .from("roles")
    .select("id")
    .eq("org_id", site.org_id)
    .eq("key", "worker")
    .eq("is_default", true)
    .single();
  if (roleErr || !workerRole) {
    return {
      ok: false,
      error: "Default worker role not found — was the org seeded?",
    };
  }

  const failed: string[] = [];
  let sent = 0;
  for (const email of emails) {
    const { error } = await supabase.rpc("invite_member_to_site_v1", {
      p_site_id: parsed.data.site_id,
      p_email: email,
      p_role_id: workerRole.id,
      p_include_children: true,
    });
    if (error) {
      failed.push(`${email}: ${error.message}`);
    } else {
      sent += 1;
    }
  }

  return { ok: true, data: { sent, failed } };
}

/**
 * Phase 12 — Onboarding finish.
 *
 * Flips profiles.onboarded_at = now() so the (app) layout's
 * tab-crash-recovery gate stops routing the user back to /onboarding.
 * Redirects to /dashboard?welcome=1 so the dashboard's welcome cards
 * render.
 *
 * Accepts a FormData arg (always passed by Next when wired via
 * `<form action={finishOnboarding}>`) but doesn't read it — the action
 * needs no inputs beyond the auth session.
 */
export async function finishOnboarding(formData: FormData): Promise<never> {
  void formData;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/dashboard?welcome=1");
}
