import { createClient } from "@/lib/supabase/server";
import { CHECKLIST_ITEMS, type ChecklistItem } from "./items";
import { SECTIONS, type SectionKey } from "./sections";
import { isUseCaseKey, type UseCaseKey } from "./use-cases";

export type ChecklistRowState = {
  item: ChecklistItem;
  done: boolean;
  dismissed: boolean;
  /** done OR dismissed — what the counter uses. */
  counted: boolean;
};

export type ChecklistSection = {
  key: SectionKey;
  label: string;
  rows: ChecklistRowState[];
};

export type ChecklistState = {
  sections: ChecklistSection[];
  doneCount: number;       // counted (done OR dismissed)
  totalCount: number;      // visible items
  rawDoneCount: number;    // done only (no dismissals)
  dismissedCount: number;
  useCases: UseCaseKey[];
  argusEnabled: boolean;
};

/**
 * Phase 18 — getChecklistState.
 *
 * Reads orgs.onboarding_use_cases + onboarding_dismissed + argus_enabled
 * with one query, runs every applicable predicate via Promise.all, and
 * returns the assembled sectioned structure. The dashboard widget and
 * /get-started page both call this directly from a server component.
 */
export async function getChecklistState(args: {
  orgId: string;
  userId: string;
}): Promise<ChecklistState> {
  const supabase = await createClient();

  const { data: orgRow, error: orgErr } = await supabase
    .from("orgs")
    .select("onboarding_use_cases, onboarding_dismissed, argus_enabled")
    .eq("id", args.orgId)
    .single();
  if (orgErr || !orgRow) {
    throw new Error(`getChecklistState: orgs row not found (${orgErr?.message})`);
  }

  const useCases = ((orgRow.onboarding_use_cases as string[] | null) ?? []).filter(
    isUseCaseKey
  );
  const dismissed = new Set<string>(
    (orgRow.onboarding_dismissed as string[] | null) ?? []
  );
  const argusEnabled = Boolean(orgRow.argus_enabled);

  // Filter the catalog to applicable items.
  const applicable = CHECKLIST_ITEMS.filter((item) => {
    if (item.requiresArgus && !argusEnabled) return false;
    if (item.useCase && !useCases.includes(item.useCase)) return false;
    return true;
  });

  // Run every predicate in parallel.
  const predicateResults = await Promise.all(
    applicable.map((item) =>
      item.predicate({ supabase, orgId: args.orgId, userId: args.userId }).catch(() => false)
    )
  );

  // Assemble row states.
  const rows: ChecklistRowState[] = applicable.map((item, idx) => {
    const done = predicateResults[idx];
    const isDismissed = dismissed.has(item.id);
    return { item, done, dismissed: isDismissed, counted: done || isDismissed };
  });

  // Group into sections (skipping any section that ended up empty).
  const sections: ChecklistSection[] = [];
  for (const sectionDef of SECTIONS) {
    const sectionRows = rows.filter((r) => r.item.section === sectionDef.key);
    if (sectionRows.length === 0) continue;
    sections.push({ key: sectionDef.key, label: sectionDef.label, rows: sectionRows });
  }

  const doneCount = rows.filter((r) => r.counted).length;
  const rawDoneCount = rows.filter((r) => r.done).length;
  const dismissedCount = rows.filter((r) => r.dismissed).length;

  return {
    sections,
    doneCount,
    totalCount: rows.length,
    rawDoneCount,
    dismissedCount,
    useCases,
    argusEnabled,
  };
}

/** Convenience for the dashboard widget — the next N not-done, not-dismissed
 *  items in display order. Excludes info-only rows (ctaHref === null). */
export function pickNextItems(
  state: ChecklistState,
  limit: number
): ChecklistRowState[] {
  const out: ChecklistRowState[] = [];
  for (const section of state.sections) {
    for (const row of section.rows) {
      if (out.length >= limit) return out;
      if (row.counted) continue;
      if (row.item.ctaHref === null) continue;
      out.push(row);
    }
  }
  return out;
}
