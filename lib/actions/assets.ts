"use server";

/**
 * Server actions for the Phase 4 asset registry.
 *
 * Per plans/04-resources.md §E11. The site-scoped permission gates use
 * `can()` from lib/auth/can.ts; tenancy is enforced by RLS on the
 * `assets` table. ref_code is generated server-side via a DEFAULT on the
 * column that calls `next_ref_code('AST', 'ref_asset_seq')`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { Database } from "@/lib/supabase/types";
import { type AssetCondition } from "@/lib/documents/types";
import type { ActionResult } from "@/lib/incidents/schemas";
import {
  AssetCreateSchema,
  AssetUpdateSchema,
  type AssetCreateInput,
  type AssetUpdateInput,
} from "./assets-schemas";

type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];

// Re-export the input types so existing consumers that imported them from
// "@/lib/actions/assets" keep working. Type-only re-exports are erased at
// compile time and don't violate the "use server" export rule.
export type { AssetCreateInput, AssetUpdateInput };

// ---------------------------------------------------------------------------
// createAsset
// ---------------------------------------------------------------------------
export async function createAsset(
  input: z.input<typeof AssetCreateSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AssetCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid asset",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile, user } = await requireUser();

  if (!(await can("asset:create", parsed.data.site_id))) {
    return { ok: false, error: "Forbidden: missing asset:create" };
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({
      org_id:            profile.org_id,
      site_id:           parsed.data.site_id,
      name:              parsed.data.name,
      kind:              parsed.data.kind,
      location:          parsed.data.location || null,
      condition:         parsed.data.condition,
      status:            parsed.data.status,
      last_inspected_at: parsed.data.last_inspected_at ?? null,
      next_pm_at:        parsed.data.next_pm_at ?? null,
      sds_document_id:   parsed.data.sds_document_id ?? null,
      notes:             parsed.data.notes || null,
      created_by:        user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  await supabase.from("activity_events").insert({
    asset_id: data.id,
    actor_id: user.id,
    verb: "asset.created",
    payload: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      site_id: parsed.data.site_id,
    },
  });

  revalidatePath("/resources/assets");
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// updateAsset
// ---------------------------------------------------------------------------
export async function updateAsset(
  assetId: string,
  input: z.input<typeof AssetUpdateSchema>,
): Promise<ActionResult<void>> {
  const parsed = AssetUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid asset",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  // Look up current site for the perm check
  const { data: existing, error: readErr } = await supabase
    .from("assets")
    .select("site_id, name")
    .eq("id", assetId)
    .is("deleted_at", null)
    .single();
  if (readErr || !existing) {
    return { ok: false, error: readErr?.message ?? "Asset not found" };
  }
  if (!(await can("asset:edit", existing.site_id))) {
    return { ok: false, error: "Forbidden: missing asset:edit" };
  }
  // If the site is changing, require asset:edit on the new site too.
  if (parsed.data.site_id && parsed.data.site_id !== existing.site_id) {
    if (!(await can("asset:edit", parsed.data.site_id))) {
      return { ok: false, error: "Forbidden on target site" };
    }
  }

  // Build the patch — only assigned fields go into the update so we
  // don't overwrite null defaults from omitted columns.
  const patch: AssetUpdate = {};
  if (parsed.data.name              !== undefined) patch.name = parsed.data.name;
  if (parsed.data.kind              !== undefined) patch.kind = parsed.data.kind;
  if (parsed.data.site_id           !== undefined) patch.site_id = parsed.data.site_id;
  if (parsed.data.location          !== undefined) patch.location = parsed.data.location || null;
  if (parsed.data.condition         !== undefined) patch.condition = parsed.data.condition;
  if (parsed.data.status            !== undefined) patch.status = parsed.data.status;
  if (parsed.data.last_inspected_at !== undefined) patch.last_inspected_at = parsed.data.last_inspected_at ?? null;
  if (parsed.data.next_pm_at        !== undefined) patch.next_pm_at = parsed.data.next_pm_at ?? null;
  if (parsed.data.sds_document_id   !== undefined) patch.sds_document_id = parsed.data.sds_document_id ?? null;
  if (parsed.data.notes             !== undefined) patch.notes = parsed.data.notes || null;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("assets").update(patch).eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    asset_id: assetId,
    actor_id: user.id,
    verb: "asset.updated",
    payload: { fields: Object.keys(patch), name: existing.name },
  });

  revalidatePath("/resources/assets");
  revalidatePath(`/resources/assets/${assetId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// markAssetInspected
// ---------------------------------------------------------------------------
export async function markAssetInspected(
  assetId: string,
): Promise<ActionResult<void>> {
  const { supabase, user } = await requireUser();
  const { data: existing, error: readErr } = await supabase
    .from("assets")
    .select("site_id")
    .eq("id", assetId)
    .is("deleted_at", null)
    .single();
  if (readErr || !existing) return { ok: false, error: readErr?.message ?? "Asset not found" };
  if (!(await can("asset:edit", existing.site_id))) {
    return { ok: false, error: "Forbidden: missing asset:edit" };
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assets")
    .update({ last_inspected_at: now })
    .eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    asset_id: assetId,
    actor_id: user.id,
    verb: "asset.inspected",
    payload: { last_inspected_at: now },
  });

  revalidatePath(`/resources/assets/${assetId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// updateAssetCondition — separate from updateAsset because the worker
// flow (downgrade → unsafe → suggest report) is its own surface.
//
// On transition INTO `unsafe`, returns `data.unsafe_transition = true`
// so the caller can offer a "Report unsafe condition" CTA pre-filled
// with this asset.
// ---------------------------------------------------------------------------
export async function updateAssetCondition(
  assetId: string,
  condition: AssetCondition,
): Promise<ActionResult<{ unsafe_transition: boolean }>> {
  const { supabase, user } = await requireUser();
  const { data: existing, error: readErr } = await supabase
    .from("assets")
    .select("site_id, condition")
    .eq("id", assetId)
    .is("deleted_at", null)
    .single();
  if (readErr || !existing) return { ok: false, error: readErr?.message ?? "Asset not found" };
  if (!(await can("asset:edit", existing.site_id))) {
    return { ok: false, error: "Forbidden: missing asset:edit" };
  }
  if (existing.condition === condition) {
    return { ok: true, data: { unsafe_transition: false } };
  }

  const { error } = await supabase
    .from("assets")
    .update({ condition })
    .eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    asset_id: assetId,
    actor_id: user.id,
    verb: "asset.condition_updated",
    payload: { from: existing.condition, to: condition },
  });

  revalidatePath(`/resources/assets/${assetId}`);
  revalidatePath("/resources/assets");
  return {
    ok: true,
    data: { unsafe_transition: condition === "unsafe" && existing.condition !== "unsafe" },
  };
}

// ---------------------------------------------------------------------------
// deleteAsset — soft-delete (deleted_at)
// ---------------------------------------------------------------------------
export async function deleteAsset(assetId: string): Promise<ActionResult<void>> {
  const { supabase, user } = await requireUser();
  const { data: existing, error: readErr } = await supabase
    .from("assets")
    .select("site_id, name")
    .eq("id", assetId)
    .is("deleted_at", null)
    .single();
  if (readErr || !existing) return { ok: false, error: readErr?.message ?? "Asset not found" };
  if (!(await can("asset:delete", existing.site_id))) {
    return { ok: false, error: "Forbidden: missing asset:delete" };
  }

  const { error } = await supabase
    .from("assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    asset_id: assetId,
    actor_id: user.id,
    verb: "asset.deleted",
    payload: { name: existing.name },
  });

  revalidatePath("/resources/assets");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// createAssetAndRedirect — convenience for the new-asset form. Throws on
// permission so the form's useActionState can pick up the message.
// ---------------------------------------------------------------------------
export async function createAssetAction(
  _prev: ActionResult<{ id: string }> | undefined,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  const raw: Record<string, unknown> = {
    name:              fd.get("name"),
    kind:              fd.get("kind"),
    site_id:           fd.get("site_id"),
    location:          fd.get("location") ?? "",
    condition:         fd.get("condition") ?? "good",
    status:            fd.get("status") ?? "active",
    last_inspected_at: fd.get("last_inspected_at") || null,
    next_pm_at:        fd.get("next_pm_at") || null,
    sds_document_id:   fd.get("sds_document_id") || null,
    notes:             fd.get("notes") ?? "",
  };
  const res = await createAsset(raw as z.input<typeof AssetCreateSchema>);
  if (res.ok) {
    redirect(`/resources/assets/${res.data!.id}`);
  }
  return res;
}

// ---------------------------------------------------------------------------
// searchAssets — typeahead lookup for the wizard's equipment_asset_id field.
// Returns active assets at the named site (or accessible-by-RLS subset)
// matching the query against name / ref_code / location.
// ---------------------------------------------------------------------------
export type AssetSearchResult = {
  id: string;
  ref_code: string;
  name: string;
  kind: string;
  condition: string;
  location: string | null;
};

export async function searchAssets(input: {
  site_id?: string | null;
  q?: string;
  limit?: number;
}): Promise<ActionResult<AssetSearchResult[]>> {
  const { supabase, profile } = await requireUser();
  let query = supabase
    .from("assets")
    .select("id, ref_code, name, kind, condition, location")
    .eq("org_id", profile.org_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(input.limit ?? 20);

  if (input.site_id) query = query.eq("site_id", input.site_id);
  if (input.q && input.q.trim()) {
    const safe = input.q.replace(/[%_]/g, "");
    query = query.or(
      `name.ilike.%${safe}%,ref_code.ilike.%${safe}%,location.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as AssetSearchResult[] };
}

// ---------------------------------------------------------------------------
// guardCanCreateAsset — page-side helper for the new-asset route.
// Throws if the user has no asset:create grant on ANY of their sites.
// ---------------------------------------------------------------------------
export async function guardAtLeastOneCreateSite(): Promise<void> {
  const { memberships } = await requireUser();
  let allowed = false;
  for (const m of memberships) {
    if (await can("asset:create", m.site_id)) {
      allowed = true;
      break;
    }
  }
  if (!allowed) {
    throw new Error("Forbidden: missing asset:create on every site");
  }
}

