"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

const NAME_MIN = 1;
const NAME_MAX = 120;

/**
 * Edit a site's mutable metadata. Country is intentionally NOT in scope —
 * mutating country mutates the regulatory engine end-to-end (OSHA vs RIDDOR).
 * Logged in SPEC §15 as v2.
 */
const UpdateSiteSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().trim().min(NAME_MIN, "Site name is required").max(NAME_MAX),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  timezone: z.string().trim().min(1, "Time zone is required").max(80),
  osha_establishment_id: z.string().trim().max(40).optional().or(z.literal("")),
  naics_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "NAICS must be exactly 6 digits")
    .optional()
    .or(z.literal("")),
  // Sentinel "__none__" maps to "clear the parent". Empty string = leave unchanged.
  parent_site_id: z.string().optional().or(z.literal("")),
});

export async function updateSite(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = UpdateSiteSchema.safeParse({
    site_id: fd.get("site_id"),
    name: fd.get("name"),
    address: fd.get("address") ?? "",
    region: fd.get("region") ?? "",
    timezone: fd.get("timezone"),
    osha_establishment_id: fd.get("osha_establishment_id") ?? "",
    naics_code: fd.get("naics_code") ?? "",
    parent_site_id: fd.get("parent_site_id") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const { supabase } = await requireUser();
  await requirePermission("site:configure", parsed.data.site_id);

  const parentRaw = parsed.data.parent_site_id ?? "";
  const clearParent = parentRaw === "__none__";
  const parentId =
    !clearParent && parentRaw.length > 0 && parentRaw !== "__keep__"
      ? parentRaw
      : null;

  const { error } = await supabase.rpc("update_site_v1", {
    p_site_id: parsed.data.site_id,
    p_name: parsed.data.name,
    p_address: parsed.data.address || undefined,
    p_region: parsed.data.region || undefined,
    p_timezone: parsed.data.timezone,
    p_osha_establishment_id: parsed.data.osha_establishment_id || undefined,
    p_naics_code: parsed.data.naics_code || undefined,
    p_parent_site_id: parentId ?? undefined,
    p_clear_parent: clearParent,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  return { ok: true };
}

const ArchiveSiteSchema = z.object({
  site_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  /** Type-the-name-to-confirm guard, validated server-side too. */
  confirm_name: z.string().trim().optional(),
  expected_name: z.string().trim().min(1),
});

export async function archiveSite(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = ArchiveSiteSchema.safeParse({
    site_id: fd.get("site_id"),
    reason: fd.get("reason") ?? "",
    confirm_name: fd.get("confirm_name") ?? "",
    expected_name: fd.get("expected_name") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Type-name-confirm: the dialog requires the user to type the site name
  // verbatim. Keep this guard server-side too so a bypass via curl still
  // requires the name.
  if ((parsed.data.confirm_name ?? "") !== parsed.data.expected_name) {
    return {
      ok: false,
      error: "Type the site name exactly to confirm.",
      fieldErrors: { confirm_name: ["Doesn't match the site name."] },
    };
  }

  const { supabase } = await requireUser();
  await requirePermission("site:archive", parsed.data.site_id);

  const { error } = await supabase.rpc("archive_site_v1", {
    p_site_id: parsed.data.site_id,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  return { ok: true };
}

const UnarchiveSiteSchema = z.object({
  site_id: z.string().uuid(),
});

export async function unarchiveSite(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = UnarchiveSiteSchema.safeParse({
    site_id: fd.get("site_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requirePermission("site:archive", parsed.data.site_id);

  const { error } = await supabase.rpc("unarchive_site_v1", {
    p_site_id: parsed.data.site_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  return { ok: true };
}

/**
 * Used after a successful archive submit — redirects back to the sites list.
 * Separated so the `<form action={...}>` flow can `redirect()` cleanly.
 */
export async function archiveSiteAndRedirect(
  fd: FormData,
): Promise<ActionResult> {
  const result = await archiveSite(null, fd);
  if (result.ok) redirect("/admin/sites?status=archived");
  return result;
}
