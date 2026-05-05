"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import {
  Step1Schema,
  Step2Schema,
  Step3Schema,
  Step4Schema,
  Step6Schema,
  type ActionResult,
} from "@/lib/site-setup/schemas";
import { SETUP_STEPS, type SetupProgress } from "@/lib/site-setup/steps";

/**
 * Fetch current progress + site row for the user's selected site, gated on
 * `site:configure`. Centralizes the auth + RLS boilerplate.
 */
async function loadSiteForSetup() {
  const { supabase, currentSiteId } = await requireUser();
  if (!currentSiteId) throw new Error("No site selected");
  await requirePermission("site:configure", currentSiteId);

  const { data: site, error } = await supabase
    .from("sites")
    .select("id, name, country, timezone, address, osha_establishment_id, naics_code, setup_progress, setup_completed_at")
    .eq("id", currentSiteId)
    .single();
  if (error || !site) throw new Error(error?.message ?? "Site not found");

  const progress = (site.setup_progress ?? {}) as SetupProgress;
  return { supabase, site, progress };
}

async function saveProgress(siteId: string, patch: Partial<SetupProgress>) {
  const { supabase } = await requireUser();
  const { data: current, error: readErr } = await supabase
    .from("sites")
    .select("setup_progress")
    .eq("id", siteId)
    .single();
  if (readErr) throw readErr;
  const merged = { ...((current?.setup_progress ?? {}) as SetupProgress), ...patch };
  const { error } = await supabase
    .from("sites")
    .update({ setup_progress: merged })
    .eq("id", siteId);
  if (error) throw error;
}

function fieldErrorsFromZod(error: import("zod").ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (out[path] ??= []).push(issue.message);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 1 — Site basics
// ---------------------------------------------------------------------------
export async function saveStep1(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const parsed = Step1Schema.safeParse({
    name: fd.get("name"),
    address: fd.get("address") ?? "",
    country: fd.get("country"),
    timezone: fd.get("timezone"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sites")
    .update({
      name: parsed.data.name,
      address: parsed.data.address || null,
      country: parsed.data.country,
      timezone: parsed.data.timezone,
    })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  await saveProgress(site.id, { step1: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/2");
}

// ---------------------------------------------------------------------------
// Step 2 — Regulator
// ---------------------------------------------------------------------------
export async function saveStep2(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const parsed = Step2Schema.safeParse({ regulator: fd.get("regulator") });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  await saveProgress(site.id, { step2: true, regulator: parsed.data.regulator });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/3");
}

// ---------------------------------------------------------------------------
// Step 3 — Establishment IDs
// ---------------------------------------------------------------------------
export async function saveStep3(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const skipped = fd.get("skipped") === "true";
  const parsed = Step3Schema.safeParse({
    osha_establishment_id: fd.get("osha_establishment_id") ?? "",
    naics_code: fd.get("naics_code") ?? "",
    hse_establishment_number: fd.get("hse_establishment_number") ?? "",
    skipped,
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { supabase } = await requireUser();
  if (!skipped) {
    const isUS = site.country === "US";
    const { error } = await supabase
      .from("sites")
      .update({
        osha_establishment_id: isUS && parsed.data.osha_establishment_id ? parsed.data.osha_establishment_id : null,
        naics_code: isUS && parsed.data.naics_code ? parsed.data.naics_code : null,
      })
      .eq("id", site.id);
    if (error) return { ok: false, error: error.message };
  }

  const patch: Partial<SetupProgress> = { step3: true };
  if (site.country === "GB" && parsed.data.hse_establishment_number) {
    patch.hse_establishment_number = parsed.data.hse_establishment_number;
  }
  await saveProgress(site.id, patch);
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/4");
}

// ---------------------------------------------------------------------------
// Step 4 — Departments & areas (stored in setup_progress jsonb)
// ---------------------------------------------------------------------------
export async function saveStep4(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  // Form posts JSON in a single hidden field "departments_json"
  const raw = fd.get("departments_json");
  let parsedDepts: { name: string; areas: string[] }[] = [];
  try {
    parsedDepts = raw ? JSON.parse(raw as string) : [];
  } catch {
    return { ok: false, error: "Could not parse departments payload" };
  }
  const parsed = Step4Schema.safeParse({ departments: parsedDepts });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  await saveProgress(site.id, { step4: true, departments: parsed.data.departments });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/5");
}

// ---------------------------------------------------------------------------
// Step 5 — Users (read-only in v1; just marks the step complete)
// ---------------------------------------------------------------------------
export async function saveStep5(): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  await saveProgress(site.id, { step5: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/6");
}

// ---------------------------------------------------------------------------
// Step 6 — Notification recipients
// ---------------------------------------------------------------------------
export async function saveStep6(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const raw = fd.get("recipients_json");
  let parsedRows: { kind: string; list: { recipient_profile_id?: string; external_email?: string }[] }[] = [];
  try {
    parsedRows = raw ? JSON.parse(raw as string) : [];
  } catch {
    return { ok: false, error: "Could not parse recipients payload" };
  }
  const parsed = Step6Schema.safeParse({ recipients: parsedRows });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { supabase } = await requireUser();

  // Replace recipients for this site (simpler than diffing for v1 demo).
  const { error: delErr } = await supabase
    .from("notification_recipients")
    .delete()
    .eq("site_id", site.id);
  if (delErr) return { ok: false, error: delErr.message };

  const insertRows = parsed.data.recipients.flatMap((row) =>
    row.list
      .filter((r) => r.recipient_profile_id || r.external_email)
      .map((r) => ({
        site_id: site.id,
        notification_kind: row.kind,
        recipient_profile_id: r.recipient_profile_id || null,
        external_email: r.external_email || null,
      }))
  );

  if (insertRows.length > 0) {
    const { error: insErr } = await supabase.from("notification_recipients").insert(insertRows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  await saveProgress(site.id, { step6: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/7");
}

// ---------------------------------------------------------------------------
// Step 7 — Confirm & launch
// ---------------------------------------------------------------------------
export async function launchSite(): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();

  const { supabase } = await requireUser();
  // Mark all steps complete + setup_completed_at. Idempotent — re-runs are no-op.
  const allCompleted = SETUP_STEPS.reduce<Record<string, boolean>>((acc, s) => {
    acc[s.progressKey] = true;
    return acc;
  }, {});
  const { data: cur } = await supabase
    .from("sites")
    .select("setup_progress")
    .eq("id", site.id)
    .single();
  const merged = { ...((cur?.setup_progress ?? {}) as SetupProgress), ...allCompleted };
  const { error } = await supabase
    .from("sites")
    .update({ setup_progress: merged, setup_completed_at: new Date().toISOString() })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/site-setup", "layout");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
