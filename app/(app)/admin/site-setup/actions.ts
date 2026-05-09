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
  Step5Schema,
  Step6Schema,
  Step7Schema,
  Step8Schema,
  type ActionResult,
} from "@/lib/site-setup/schemas";
import { SETUP_STEPS, type SetupProgress } from "@/lib/site-setup/steps";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadSiteForSetup() {
  const { supabase, currentSiteId } = await requireUser();
  if (!currentSiteId) throw new Error("No site selected");
  await requirePermission("site:configure", currentSiteId);

  const { data: site, error } = await supabase
    .from("sites")
    .select("id, name, country, timezone, setup_progress, setup_completed_at")
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

const emptyToNull = (v: string | FormDataEntryValue | null | undefined): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
};

const numOrNull = (v: FormDataEntryValue | null): number | null => {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// Step 1 — Site basics
// ---------------------------------------------------------------------------
export async function saveStep1(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const parsed = Step1Schema.safeParse({
    name: fd.get("name"),
    street_1: fd.get("street_1") ?? "",
    street_2: fd.get("street_2") ?? "",
    city: fd.get("city") ?? "",
    state_or_region: fd.get("state_or_region") ?? "",
    postal_code: fd.get("postal_code") ?? "",
    latitude: numOrNull(fd.get("latitude")),
    longitude: numOrNull(fd.get("longitude")),
    country: fd.get("country"),
    timezone: fd.get("timezone"),
    site_type: fd.get("site_type"),
    operational_status: fd.get("operational_status"),
    opened_on: fd.get("opened_on") ?? "",
    closed_on: fd.get("closed_on") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sites")
    .update({
      name: parsed.data.name,
      street_1: emptyToNull(parsed.data.street_1) ?? null,
      street_2: emptyToNull(parsed.data.street_2) ?? null,
      city: emptyToNull(parsed.data.city) ?? null,
      state_or_region: emptyToNull(parsed.data.state_or_region) ?? null,
      postal_code: emptyToNull(parsed.data.postal_code) ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      timezone: parsed.data.timezone,
      site_type: parsed.data.site_type,
      operational_status: parsed.data.operational_status,
      opened_on: parsed.data.opened_on ? parsed.data.opened_on : null,
      closed_on: parsed.data.closed_on ? parsed.data.closed_on : null,
    })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  await saveProgress(site.id, { step1: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/jurisdiction");
}

// ---------------------------------------------------------------------------
// Step 2 — Jurisdiction
// ---------------------------------------------------------------------------
export async function saveStep2(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const parsed = Step2Schema.safeParse({
    country: fd.get("country"),
    osha_jurisdiction: fd.get("osha_jurisdiction") || null,
    state_plan_code: fd.get("state_plan_code") ?? "",
    gb_jurisdiction: fd.get("gb_jurisdiction") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sites")
    .update({
      osha_jurisdiction:
        parsed.data.country === "US" ? parsed.data.osha_jurisdiction ?? null : null,
      state_plan_code:
        parsed.data.country === "US" && parsed.data.osha_jurisdiction === "state_plan"
          ? parsed.data.state_plan_code || null
          : null,
      gb_jurisdiction:
        parsed.data.country === "GB" ? parsed.data.gb_jurisdiction ?? null : null,
    })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  await saveProgress(site.id, { step2: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/identifiers");
}

// ---------------------------------------------------------------------------
// Step 3 — Identifiers (country-branched)
// ---------------------------------------------------------------------------
export async function saveStep3(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const parsed = Step3Schema.safeParse({
    country: fd.get("country"),
    ein: fd.get("ein") ?? "",
    naics_code: fd.get("naics_code") ?? "",
    sic_code: fd.get("sic_code") ?? "",
    ita_establishment_id: fd.get("ita_establishment_id") ?? "",
    osha_establishment_id: fd.get("osha_establishment_id") ?? "",
    crn: fd.get("crn") ?? "",
    uk_sic_2007: fd.get("uk_sic_2007") ?? "",
    hse_establishment_number: fd.get("hse_establishment_number") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { supabase } = await requireUser();
  const isUS = parsed.data.country === "US";
  const { error } = await supabase
    .from("sites")
    .update({
      ein: isUS ? emptyToNull(parsed.data.ein) : null,
      naics_code: isUS ? emptyToNull(parsed.data.naics_code) : null,
      sic_code: isUS ? emptyToNull(parsed.data.sic_code) : null,
      ita_establishment_id: isUS ? emptyToNull(parsed.data.ita_establishment_id) : null,
      osha_establishment_id: isUS ? emptyToNull(parsed.data.osha_establishment_id) : null,
      crn: !isUS ? emptyToNull(parsed.data.crn) : null,
      uk_sic_2007: !isUS ? emptyToNull(parsed.data.uk_sic_2007) : null,
      hse_establishment_number: !isUS ? emptyToNull(parsed.data.hse_establishment_number) : null,
    })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  await saveProgress(site.id, { step3: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/workforce");
}

// ---------------------------------------------------------------------------
// Step 4 — Workforce
// ---------------------------------------------------------------------------
export async function saveStep4(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const parsed = Step4Schema.safeParse({
    peak_employees_year: numOrNull(fd.get("peak_employees_year")),
    avg_employees_year: numOrNull(fd.get("avg_employees_year")),
    partially_exempt_override: fd.get("partially_exempt_override") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sites")
    .update({
      peak_employees_year: parsed.data.peak_employees_year ?? null,
      avg_employees_year: parsed.data.avg_employees_year ?? null,
      partially_exempt_override: parsed.data.partially_exempt_override,
    })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  await saveProgress(site.id, { step4: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/hazards");
}

// ---------------------------------------------------------------------------
// Step 5 — Hazard profile
// ---------------------------------------------------------------------------
export async function saveStep5(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const standards = fd.getAll("applicable_standards").map((v) => String(v));
  const tags = fd.getAll("hazard_tags").map((v) => String(v));
  const parsed = Step5Schema.safeParse({
    applicable_standards: standards,
    psm_applicable: fd.get("psm_applicable") === "on",
    hazard_tags: tags,
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const isUS = (await loadSiteForSetup()).site.country === "US";
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sites")
    .update({
      applicable_standards: isUS ? parsed.data.applicable_standards : [],
      psm_applicable: isUS ? parsed.data.psm_applicable : false,
      hazard_tags: parsed.data.hazard_tags,
    })
    .eq("id", site.id);
  if (error) return { ok: false, error: error.message };

  await saveProgress(site.id, { step5: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/departments");
}

// ---------------------------------------------------------------------------
// Step 6 — Departments & areas (stored in setup_progress jsonb)
// ---------------------------------------------------------------------------
export async function saveStep6(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const raw = fd.get("departments_json");
  let parsedDepts: { name: string; areas: string[] }[] = [];
  try {
    parsedDepts = raw ? JSON.parse(raw as string) : [];
  } catch {
    return { ok: false, error: "Could not parse departments payload" };
  }
  const parsed = Step6Schema.safeParse({ departments: parsedDepts });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  await saveProgress(site.id, { step6: true, departments: parsed.data.departments });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/people");
}

// ---------------------------------------------------------------------------
// Step 7 — People (EHS lead + RIDDOR responsible person + emergency contacts)
// ---------------------------------------------------------------------------
export async function saveStep7(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const raw = fd.get("emergency_contacts_json");
  let contactsRaw: { name: string; role?: string; phone?: string; email?: string }[] = [];
  try {
    contactsRaw = raw ? JSON.parse(raw as string) : [];
  } catch {
    return { ok: false, error: "Could not parse emergency contacts payload" };
  }
  const parsed = Step7Schema.safeParse({
    country: fd.get("country"),
    site_ehs_lead_id: fd.get("site_ehs_lead_id"),
    riddor_responsible_person_name: fd.get("riddor_responsible_person_name") ?? "",
    riddor_responsible_person_role: fd.get("riddor_responsible_person_role") ?? "",
    emergency_contacts: contactsRaw,
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { supabase } = await requireUser();
  const isUS = parsed.data.country === "US";

  const { error: siteErr } = await supabase
    .from("sites")
    .update({
      site_ehs_lead_id: parsed.data.site_ehs_lead_id,
      riddor_responsible_person_name: !isUS
        ? emptyToNull(parsed.data.riddor_responsible_person_name)
        : null,
      riddor_responsible_person_role: !isUS
        ? emptyToNull(parsed.data.riddor_responsible_person_role)
        : null,
    })
    .eq("id", site.id);
  if (siteErr) return { ok: false, error: siteErr.message };

  // Replace emergency contacts (simpler than diffing for v1).
  const { error: delErr } = await supabase
    .from("site_emergency_contacts")
    .delete()
    .eq("site_id", site.id);
  if (delErr) return { ok: false, error: delErr.message };

  if (parsed.data.emergency_contacts.length > 0) {
    const insertRows = parsed.data.emergency_contacts.map((c, i) => ({
      site_id: site.id,
      name: c.name,
      role: c.role || null,
      phone: c.phone || null,
      email: c.email || null,
      sort_order: i,
    }));
    const { error: insErr } = await supabase.from("site_emergency_contacts").insert(insertRows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  await saveProgress(site.id, { step7: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/recipients");
}

// ---------------------------------------------------------------------------
// Step 8 — Notification recipients
// ---------------------------------------------------------------------------
export async function saveStep8(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();
  const raw = fd.get("recipients_json");
  let parsedRows: {
    kind: string;
    list: { recipient_profile_id?: string; external_email?: string }[];
  }[] = [];
  try {
    parsedRows = raw ? JSON.parse(raw as string) : [];
  } catch {
    return { ok: false, error: "Could not parse recipients payload" };
  }
  const parsed = Step8Schema.safeParse({ recipients: parsedRows });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { supabase } = await requireUser();

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

  await saveProgress(site.id, { step8: true });
  revalidatePath("/admin/site-setup", "layout");
  redirect("/admin/site-setup/confirm");
}

// ---------------------------------------------------------------------------
// Step 9 — Confirm & launch
// ---------------------------------------------------------------------------
export async function launchSite(): Promise<ActionResult> {
  const { site } = await loadSiteForSetup();

  const { supabase } = await requireUser();
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
