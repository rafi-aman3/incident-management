import { z } from "zod";
import {
  HAZARD_CATEGORY_VALUES,
  CONTROL_LEVEL_VALUES,
  LIKELIHOOD_VALUES,
  CONSEQUENCE_VALUES,
  RISK_LEVEL_VALUES,
} from "@/lib/risk/types";

const HAZARD_SOURCE_VALUES = [
  "routine_activity",
  "non_routine_activity",
  "past_incident",
  "emergency_situation",
  "contractor_activity",
  "design",
  "change",
  "external_input",
  "inspection",
  "worker_report",
  "jsa",
  "sds_import",
] as const;

const HAZARD_STATUS_VALUES = [
  "identified",
  "under_assessment",
  "controlled",
  "monitoring",
  "closed",
  "superseded",
] as const;

const RA_TRIGGER_TYPES = [
  "initial",
  "periodic_review",
  "post_incident",
  "management_of_change",
  "regulatory_change",
  "worker_consultation",
  "audit_finding",
  "sds_revision",
] as const;

const CONTROL_EFFECTIVENESS = [
  "effective",
  "partially_effective",
  "not_yet_verified",
  "ineffective",
] as const;

const CONTROL_ORIGINS = [
  "pre_existing",
  "from_initial_assessment",
  "from_capa",
  "from_management_of_change",
  "from_jsa",
  "from_sds_section",
] as const;

export const HazardSourceEnum = z.enum(HAZARD_SOURCE_VALUES);
export const HazardCategoryEnum = z.enum(HAZARD_CATEGORY_VALUES);
export const HazardStatusEnum = z.enum(HAZARD_STATUS_VALUES);
export const LikelihoodEnum = z.enum(LIKELIHOOD_VALUES);
export const ConsequenceEnum = z.enum(CONSEQUENCE_VALUES);
export const RiskLevelEnum = z.enum(RISK_LEVEL_VALUES);
export const ControlLevelEnum = z.enum(CONTROL_LEVEL_VALUES);
export const RaTriggerEnum = z.enum(RA_TRIGGER_TYPES);
export const ControlEffectivenessEnum = z.enum(CONTROL_EFFECTIVENESS);
export const ControlOriginEnum = z.enum(CONTROL_ORIGINS);

export const CreateHazardSchema = z.object({
  site_id: z.string().uuid(),
  area: z.string().max(120).optional().nullable(),
  title: z.string().min(3).max(160),
  description: z.string().max(4000).optional().nullable(),
  hazard_category: HazardCategoryEnum,
  hazard_source: HazardSourceEnum,
  affects_workers: z.array(z.string().max(80)).max(20).default([]),
  affects_others: z.array(z.string().max(80)).max(20).default([]),
  identification_method: z.string().max(200).optional().nullable(),
  source_candidate_id: z.string().uuid().optional().nullable(),
  source_incident_id: z.string().uuid().optional().nullable(),
  source_sds_id: z.string().max(160).optional().nullable(),
  source_sds_section: z.string().max(120).optional().nullable(),
});
export type CreateHazardInput = z.input<typeof CreateHazardSchema>;

export const UpdateHazardSchema = z.object({
  area: z.string().max(120).optional().nullable(),
  title: z.string().min(3).max(160).optional(),
  description: z.string().max(4000).optional().nullable(),
  hazard_category: HazardCategoryEnum.optional(),
  affects_workers: z.array(z.string().max(80)).max(20).optional(),
  affects_others: z.array(z.string().max(80)).max(20).optional(),
});
export type UpdateHazardInput = z.input<typeof UpdateHazardSchema>;

export const CreateRiskAssessmentSchema = z.object({
  likelihood: LikelihoodEnum,
  consequence: ConsequenceEnum,
  trigger_type: RaTriggerEnum,
  triggered_by_incident_id: z.string().uuid().optional().nullable(),
  rationale: z.string().max(2000).optional().nullable(),
  consulted_worker_ids: z.array(z.string().uuid()).max(20).default([]),
  next_review_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  // Optional control set this assessment counts against — used for residual
  // computation when called from convertCandidate. Otherwise residual is
  // computed against the hazard's existing controls.
  control_levels: z.array(ControlLevelEnum).optional(),
});
export type CreateRiskAssessmentInput = z.input<typeof CreateRiskAssessmentSchema>;

export const AddControlSchema = z.object({
  control_level: ControlLevelEnum,
  control_description: z.string().min(3).max(600),
  effectiveness: ControlEffectivenessEnum.default("not_yet_verified"),
  responsible_party_id: z.string().uuid().optional().nullable(),
  implemented_at: z.string().datetime().optional().nullable(),
  next_verification_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  next_control_review_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  origin: ControlOriginEnum.default("from_initial_assessment"),
  origin_capa_id: z.string().uuid().optional().nullable(),
});
export type AddControlInput = z.input<typeof AddControlSchema>;

export const UpdateControlSchema = AddControlSchema.partial().omit({ origin: true });
export type UpdateControlInput = z.input<typeof UpdateControlSchema>;

export const VerifyControlSchema = z.object({
  effectiveness: ControlEffectivenessEnum,
  notes: z.string().max(2000).optional().nullable(),
  next_verification_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  next_control_review_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});
export type VerifyControlInput = z.input<typeof VerifyControlSchema>;

export const CloseHazardSchema = z.object({
  reason: z.string().min(3).max(2000),
  superseded_by_hazard_id: z.string().uuid().optional().nullable(),
});
export type CloseHazardInput = z.input<typeof CloseHazardSchema>;
