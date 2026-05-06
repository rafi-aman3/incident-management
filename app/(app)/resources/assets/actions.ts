"use server";

/**
 * Route-local actions for /resources/assets — thin form-action wrappers
 * around the lib/actions/assets.ts server actions.
 */

import { redirect } from "next/navigation";
import type { z } from "zod";
import {
  AssetUpdateSchema,
  updateAsset,
} from "@/lib/actions/assets";
import type { ActionResult } from "@/lib/incidents/schemas";

/** Form-action wrapper for the asset edit page. Reads `id` from the
 *  hidden field, builds the patch from the FormData, and routes back to
 *  the detail on success. */
export async function updateAssetForForm(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing asset id" };

  const raw: Record<string, unknown> = {
    name:              fd.get("name") ?? undefined,
    kind:              fd.get("kind") ?? undefined,
    site_id:           fd.get("site_id") ?? undefined,
    location:          fd.get("location") ?? undefined,
    condition:         fd.get("condition") ?? undefined,
    status:            fd.get("status") ?? undefined,
    last_inspected_at: fd.get("last_inspected_at") || null,
    next_pm_at:        fd.get("next_pm_at") || null,
    sds_document_id:   fd.get("sds_document_id") || null,
    notes:             fd.get("notes") ?? undefined,
  };

  const res = await updateAsset(id, raw as z.input<typeof AssetUpdateSchema>);
  if (res.ok) {
    redirect(`/resources/assets/${id}`);
  }
  return res;
}
