/**
 * Phase 3 — Templates + Inspections shared types.
 *
 * The data shape mirrors the SafetyCulture-shaped JSONB stored on
 * `template_versions.{header, items, template_data}` (see SPEC §15
 * 2026-05-06 entry "Phase 3 data model").
 */

import type { Database } from "@/lib/supabase/types";

export type TemplateStatus = Database["public"]["Enums"]["template_status"];
export type TemplateScheduleKind =
  Database["public"]["Enums"]["template_schedule_kind"];
export type InspectionStatus = Database["public"]["Enums"]["inspection_status"];
export type FindingStatus = Database["public"]["Enums"]["finding_status"];

/**
 * MVP item types editable + renderable end-to-end in v1. Items the seed
 * payloads contain that aren't in this list render as a read-only
 * "Unsupported in v1" placeholder in the runner; the editor's "+ Add"
 * picker only shows the MVP set.
 */
export const MVP_ITEM_TYPES = [
  "section",
  "category",
  "information",
  "question",
  "text",
  "datetime",
  "signature",
  "media",
] as const;

export type MvpItemType = (typeof MVP_ITEM_TYPES)[number];

/**
 * Container types — children are themselves items. Excluded from
 * "answerable" walks (validation, score, completion checks).
 */
export const NON_ANSWERABLE_TYPES = [
  "section",
  "category",
  "information",
] as const;

export function isNonAnswerable(type: string): boolean {
  return (NON_ANSWERABLE_TYPES as readonly string[]).includes(type);
}

export function isMvpType(type: string): type is MvpItemType {
  return (MVP_ITEM_TYPES as readonly string[]).includes(type);
}

/**
 * Canonical TemplateNodeItem — flat array element with optional parent_id
 * linkage. Matches the SafetyCulture API payload shape verbatim.
 */
export type TemplateNodeItem = {
  item_id: string;
  parent_id?: string;
  type: string;
  label: string | null;
  options?: Record<string, unknown> & {
    sort_order?: number;
    is_mandatory?: boolean;
    answer_set?: string;
    weighting?: number;
    enable_signature_timestamp?: boolean;
    visible_in_audit?: boolean;
    visible_in_report?: boolean;
  };
};

/**
 * Reusable answer set referenced by question items via options.answer_set.
 */
export type AnswerSetResponse = {
  id: string;
  label: string;
  score?: number;
  colour?: string;
  enable_score?: boolean;
  failed?: boolean;
};

export type AnswerSet = {
  id: string;
  type: "question" | "list";
  responses: AnswerSetResponse[];
};

export type TemplateData = {
  answer_sets: Record<string, AnswerSet>;
  condition_sets?: Array<{ id: string; type: string }>;
};

/**
 * Inspection answer payload (one per item_id in `inspections.answers`).
 * The runner denormalizes the answer-set lookup (label / score / max /
 * failed) into the answer at save time so complete_inspection_v1 can
 * compute scores in O(N) without re-walking the items tree.
 */
export type InspectionAnswerUpload = {
  id: string;
  name: string;
  storage_path: string;
};

export type InspectionAnswer = {
  selected_option_id?: string;
  selected_option_failed?: boolean;
  selected_option_score?: number;
  selected_option_max?: number;
  selected_option_label?: string;
  response_text?: string;
  response_value?: unknown;
  notes?: string;
  uploads?: InspectionAnswerUpload[];
  updated_at: string;
};
