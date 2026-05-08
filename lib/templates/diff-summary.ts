import type { TemplateNodeItem } from "@/lib/templates/types";

export type DiffCounts = {
  added: number;
  removed: number;
  renamed: number;
  typeChanged: number;
  optionsChanged: number;
};

/**
 * Compute a structural diff between two flat item arrays. Items are matched
 * by `item_id`. Returns counters that the publish dialog turns into a
 * one-line suggestion the author can edit.
 *
 * - `added`: in `next` but not in `prev`
 * - `removed`: in `prev` but not in `next`
 * - `renamed`: same id, different `label`
 * - `typeChanged`: same id, different `type` (rare, flagged separately
 *   because it's potentially data-corrupting against in-flight inspections)
 * - `optionsChanged`: same id, same type, same label, but `options` JSON
 *   differs — covers `is_mandatory` toggles, answer-set swaps, etc.
 */
export function diffItems(
  prev: TemplateNodeItem[],
  next: TemplateNodeItem[]
): DiffCounts {
  const prevById = new Map(prev.map((it) => [it.item_id, it]));
  const nextById = new Map(next.map((it) => [it.item_id, it]));

  let added = 0;
  let removed = 0;
  let renamed = 0;
  let typeChanged = 0;
  let optionsChanged = 0;

  for (const [id, b] of nextById) {
    const a = prevById.get(id);
    if (!a) {
      added++;
      continue;
    }
    if (a.type !== b.type) {
      typeChanged++;
      continue;
    }
    if ((a.label ?? "") !== (b.label ?? "")) {
      renamed++;
      continue;
    }
    if (JSON.stringify(a.options ?? {}) !== JSON.stringify(b.options ?? {})) {
      optionsChanged++;
    }
  }
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) removed++;
  }

  return { added, removed, renamed, typeChanged, optionsChanged };
}

/**
 * Render diff counters as a one-sentence summary. Empty string when the
 * draft is identical to the baseline (so the dialog opens to a blank
 * placeholder rather than a misleading "no changes" copy).
 *
 * For first-publish (no baseline), pass `null` as `prev` upstream and
 * fall back to a fixed "Initial version of <template name>" string in
 * the caller — this helper only handles the diff case.
 */
export function summarizeDiff(d: DiffCounts): string {
  const parts: string[] = [];
  if (d.added > 0) parts.push(`Added ${d.added} item${d.added === 1 ? "" : "s"}`);
  if (d.removed > 0)
    parts.push(`removed ${d.removed} item${d.removed === 1 ? "" : "s"}`);
  if (d.renamed > 0) parts.push(`renamed ${d.renamed}`);
  if (d.typeChanged > 0)
    parts.push(`changed type on ${d.typeChanged} item${d.typeChanged === 1 ? "" : "s"}`);
  if (d.optionsChanged > 0)
    parts.push(`updated options on ${d.optionsChanged}`);
  if (parts.length === 0) return "";
  // Capitalize first letter of the joined sentence.
  const joined = parts.join(", ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

/**
 * One-shot helper that combines diff + summarize for the body items list
 * (header items are intentionally excluded from the auto-summary — they
 * change so rarely that mentioning them adds noise).
 */
export function suggestChangeSummary(
  prev: TemplateNodeItem[],
  next: TemplateNodeItem[],
  fallbackTemplateName: string
): string {
  if (prev.length === 0) return `Initial version of ${fallbackTemplateName}.`;
  return summarizeDiff(diffItems(prev, next));
}
