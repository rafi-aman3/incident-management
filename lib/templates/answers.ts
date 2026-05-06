/**
 * Inspection-answer helpers — shared between the runner (interactive),
 * the report view (read-only), and the validation wizards.
 */

import type {
  TemplateNodeItem,
  TemplateData,
  InspectionAnswer,
} from "@/lib/templates/types";
import { walkAnswerable } from "@/lib/templates/items";

export type AnswerMap = Record<string, InspectionAnswer>;

/**
 * Has the user given any meaningful answer to this item?
 * Mirrors the SafetyCulture reference's `hasAnswer` validation.
 */
export function hasAnswer(answer: InspectionAnswer | undefined): boolean {
  if (!answer) return false;
  if (answer.selected_option_id) return true;
  if (answer.response_text && answer.response_text.trim().length > 0)
    return true;
  if (answer.response_value !== undefined && answer.response_value !== null)
    return true;
  if (answer.uploads && answer.uploads.length > 0) return true;
  return false;
}

/**
 * Walk every answerable body item and yield the ones that are
 * required AND don't yet have an answer. Used by the Submit
 * confirmation modal.
 */
export function findRequiredUnanswered(
  items: TemplateNodeItem[],
  answers: AnswerMap
): TemplateNodeItem[] {
  const out: TemplateNodeItem[] = [];
  for (const it of walkAnswerable(items)) {
    const required = (it.options?.is_mandatory as boolean) ?? false;
    if (!required) continue;
    if (!hasAnswer(answers[it.item_id])) out.push(it);
  }
  return out;
}

/**
 * Walk every answer and find the ones marked failed (per the
 * answer_set's `failed` flag, which the runner denormalizes onto each
 * answer at save time).
 */
export function findFailedAnswers(
  items: TemplateNodeItem[],
  answers: AnswerMap
): Array<{ item: TemplateNodeItem; answer: InspectionAnswer }> {
  const out: Array<{ item: TemplateNodeItem; answer: InspectionAnswer }> = [];
  for (const it of walkAnswerable(items)) {
    const a = answers[it.item_id];
    if (a?.selected_option_failed) out.push({ item: it, answer: a });
  }
  return out;
}

/**
 * Progress: (# answered / # answerable). Returns 0..1.
 */
export function computeProgress(
  items: TemplateNodeItem[],
  answers: AnswerMap
): { answered: number; total: number; pct: number } {
  let total = 0;
  let answered = 0;
  for (const it of walkAnswerable(items)) {
    total++;
    if (hasAnswer(answers[it.item_id])) answered++;
  }
  return {
    answered,
    total,
    pct: total === 0 ? 0 : answered / total,
  };
}

/**
 * Build a denormalized answer payload for a question response. The
 * runner stores label / score / max / failed inline so
 * complete_inspection_v1 can compute scores without re-walking the
 * answer_sets.
 */
export function buildQuestionAnswer(
  templateData: TemplateData,
  answerSetId: string | undefined,
  responseId: string,
  prevNotes?: string
): InspectionAnswer {
  const set = answerSetId ? templateData.answer_sets?.[answerSetId] : undefined;
  const resp = set?.responses.find((r) => r.id === responseId);
  const max = set?.responses.reduce(
    (m, r) => Math.max(m, r.enable_score && typeof r.score === "number" ? r.score : 0),
    0
  );
  return {
    selected_option_id: responseId,
    selected_option_failed: resp?.failed ?? false,
    selected_option_score:
      resp?.enable_score && typeof resp.score === "number" ? resp.score : 0,
    selected_option_max: max ?? 0,
    selected_option_label: resp?.label ?? "",
    notes: prevNotes,
    updated_at: new Date().toISOString(),
  };
}

export function buildTextAnswer(text: string): InspectionAnswer {
  return {
    response_text: text,
    updated_at: new Date().toISOString(),
  };
}

export function buildDateTimeAnswer(iso: string): InspectionAnswer {
  return {
    response_value: { value: iso },
    updated_at: new Date().toISOString(),
  };
}

export function buildSignatureAnswer(payload: {
  name: string;
  upload_id: string;
  storage_path: string;
}): InspectionAnswer {
  return {
    response_value: { value: payload.name, signed_at: new Date().toISOString() },
    uploads: [
      {
        id: payload.upload_id,
        name: `signature-${payload.name}`,
        storage_path: payload.storage_path,
      },
    ],
    updated_at: new Date().toISOString(),
  };
}

export function appendUpload(
  prev: InspectionAnswer | undefined,
  upload: { id: string; name: string; storage_path: string }
): InspectionAnswer {
  return {
    ...(prev ?? {}),
    uploads: [...(prev?.uploads ?? []), upload],
    updated_at: new Date().toISOString(),
  };
}

export function removeUploadFromAnswer(
  prev: InspectionAnswer | undefined,
  uploadId: string
): InspectionAnswer {
  return {
    ...(prev ?? {}),
    uploads: (prev?.uploads ?? []).filter((u) => u.id !== uploadId),
    updated_at: new Date().toISOString(),
  };
}
