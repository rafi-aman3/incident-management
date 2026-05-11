"use server";

/**
 * Phase 16 — SDS Manager stub integration.
 *
 * Reads from lib/sds/dummy-catalog.ts and writes into hazard_candidates
 * (Phase 14 table) with proposed_metadata carrying GHS pictograms +
 * H-statement + suggested controls. The Phase 14 candidate-review form
 * pre-fills its controls section from proposed_metadata.suggested_controls
 * so the EHS Manager can convert with one click.
 *
 * Swap-out for the real SDS Manager API is a single function replacement:
 * keep this signature, change findSdsById() to fetch from the API.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import { findSdsById } from "@/lib/sds/dummy-catalog";

const ImportSchema = z.object({
  site_id: z.string().uuid(),
  sds_ids: z.array(z.string().min(1)).min(1).max(20),
});

export async function importSdsHazards(
  input: z.input<typeof ImportSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile, user } = await requireUser();

  if (!(await can("hazard:report", parsed.data.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:report" };
  }

  type CandidateInsert = {
    org_id: string;
    source_type: "sds_import";
    source_reference_id: string;
    site_id: string;
    proposed_title: string;
    proposed_category: string;
    proposed_description: string;
    proposed_metadata: Record<string, unknown>;
    status: "pending_review";
    proposed_by: string;
  };

  const rows: CandidateInsert[] = [];
  for (const sdsId of parsed.data.sds_ids) {
    const sds = findSdsById(sdsId);
    if (!sds) continue;
    for (const hazard of sds.hazards) {
      rows.push({
        org_id: profile.org_id,
        source_type: "sds_import",
        source_reference_id: sds.id,
        site_id: parsed.data.site_id,
        proposed_title: hazard.title,
        proposed_category: hazard.category,
        proposed_description: `${hazard.description}\n\n(${hazard.h_statement})`,
        proposed_metadata: {
          sds_id: sds.id,
          product_name: sds.product_name,
          manufacturer: sds.manufacturer,
          cas_number: sds.cas_number,
          h_statement: hazard.h_statement,
          pictograms: sds.ghs_pictograms,
          signal_word: sds.signal_word,
          suggested_controls: sds.suggested_controls,
        },
        status: "pending_review",
        proposed_by: user.id,
      });
    }
  }

  if (rows.length === 0) {
    return { ok: false, error: "No valid chemicals selected." };
  }

  const { error } = await supabase
    .from("hazard_candidates")
    .insert(rows as never);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard_candidate.sds_imported",
    payload: {
      sds_ids: parsed.data.sds_ids,
      site_id: parsed.data.site_id,
      created_rows: rows.length,
    },
  });

  revalidatePath("/hazards/candidates");
  return { ok: true, data: { count: rows.length } };
}
