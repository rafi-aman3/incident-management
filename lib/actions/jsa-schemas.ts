import { z } from "zod";
import {
  HAZARD_CATEGORY_VALUES,
  CONTROL_LEVEL_VALUES,
  LIKELIHOOD_VALUES,
  CONSEQUENCE_VALUES,
} from "@/lib/risk/types";

export const JSA_FREQUENCY_VALUES = [
  "daily",
  "weekly",
  "monthly",
  "as_needed",
  "one_off",
  "continuous",
] as const;
export type JsaFrequency = (typeof JSA_FREQUENCY_VALUES)[number];

export const JSA_STATUS_VALUES = [
  "draft",
  "under_review",
  "approved",
  "expired",
  "archived",
] as const;
export type JsaStatus = (typeof JSA_STATUS_VALUES)[number];

export const JSA_INCIDENT_LINK_TYPE_VALUES = [
  "causal",
  "contributing",
  "exposed_but_not_causal",
] as const;
export type JsaIncidentLinkType = (typeof JSA_INCIDENT_LINK_TYPE_VALUES)[number];

export const FrequencyEnum = z.enum(JSA_FREQUENCY_VALUES);
export const JsaStatusEnum = z.enum(JSA_STATUS_VALUES);
export const JsaLinkTypeEnum = z.enum(JSA_INCIDENT_LINK_TYPE_VALUES);
export const HazardCategoryEnum = z.enum(HAZARD_CATEGORY_VALUES);
export const ControlLevelEnum = z.enum(CONTROL_LEVEL_VALUES);
export const LikelihoodEnum = z.enum(LIKELIHOOD_VALUES);
export const ConsequenceEnum = z.enum(CONSEQUENCE_VALUES);

const TrimmedString = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

// ---------- Nested step / hazard / control building blocks ----------

export const StepControlInputSchema = z.object({
  control_level: ControlLevelEnum,
  control_description: TrimmedString(3, 600),
});
export type StepControlInput = z.input<typeof StepControlInputSchema>;

export const StepHazardInputSchema = z.object({
  hazard_description: TrimmedString(3, 600),
  hazard_category: HazardCategoryEnum,
  likelihood: LikelihoodEnum,
  consequence: ConsequenceEnum,
  controls: z.array(StepControlInputSchema).max(8).default([]),
});
export type StepHazardInput = z.input<typeof StepHazardInputSchema>;

export const StepInputSchema = z.object({
  step_description: TrimmedString(3, 600),
  hazards: z.array(StepHazardInputSchema).max(10).default([]),
});
export type StepInput = z.input<typeof StepInputSchema>;

// ---------- JSA-level CRUD payloads ----------

const PpePermitsList = z.array(z.string().trim().min(1).max(120)).max(20);

export const CreateJsaDraftSchema = z.object({
  site_id: z.string().uuid(),
  title: TrimmedString(3, 200),
  job_description: z.string().trim().max(4000).optional().nullable(),
  area: z.string().trim().max(120).optional().nullable(),
  performed_by_roles: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  performed_by_workgroups: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  frequency: FrequencyEnum.optional().nullable(),
  estimated_duration_minutes: z.number().int().positive().max(60 * 24 * 30).optional().nullable(),
  ppe_required: PpePermitsList.default([]),
  permits_required: PpePermitsList.default([]),
});
export type CreateJsaDraftInput = z.input<typeof CreateJsaDraftSchema>;

// updateJsa does a full replace per SPEC §JSA.7 — simpler than diffing and the
// cascade `on delete` on jsa_steps makes the storage cost negligible.
export const UpdateJsaSchema = CreateJsaDraftSchema.omit({ site_id: true }).extend({
  steps: z.array(StepInputSchema).max(30).default([]),
});
export type UpdateJsaInput = z.input<typeof UpdateJsaSchema>;

export const ApproveJsaSchema = z.object({
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .nullable(),
});
export type ApproveJsaInput = z.input<typeof ApproveJsaSchema>;

export const SignOffJsaSchema = z.object({
  signed_for_session: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export type SignOffJsaInput = z.input<typeof SignOffJsaSchema>;

export const LinkJsaIncidentSchema = z.object({
  incident_id: z.string().uuid(),
  link_type: JsaLinkTypeEnum,
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type LinkJsaIncidentInput = z.input<typeof LinkJsaIncidentSchema>;
