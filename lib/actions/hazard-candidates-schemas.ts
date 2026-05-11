import { z } from "zod";
import {
  HazardCategoryEnum,
  CreateHazardSchema,
  CreateRiskAssessmentSchema,
  AddControlSchema,
} from "./hazards-schemas";

const SOURCE_TYPES = [
  "sds_import",
  "worker_report",
  "inspection",
  "incident_review",
  "management_of_change",
  "audit_finding",
  "external_advisory",
  "jsa",
] as const;

export const CandidateSourceTypeEnum = z.enum(SOURCE_TYPES);

export const CreateCandidateSchema = z.object({
  source_type: CandidateSourceTypeEnum,
  source_reference_id: z.string().max(160).optional().nullable(),
  site_id: z.string().uuid().optional().nullable(),
  area: z.string().max(120).optional().nullable(),
  proposed_title: z.string().min(3).max(160),
  proposed_category: HazardCategoryEnum,
  proposed_description: z.string().max(4000).optional().nullable(),
  proposed_metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CreateCandidateInput = z.input<typeof CreateCandidateSchema>;

// Convert turns a candidate row into a hazard + initial RA + (0..n) controls.
// hazard_source is forced from the candidate's source_type by the server
// action so it doesn't appear in the input shape.
export const ConvertCandidateSchema = z.object({
  hazard: CreateHazardSchema.omit({ hazard_source: true, source_candidate_id: true }),
  initial_assessment: CreateRiskAssessmentSchema.extend({
    // Convert always uses 'initial' trigger; force it.
    trigger_type: z.literal("initial").default("initial"),
  }),
  initial_controls: z
    .array(AddControlSchema.omit({ origin: true, origin_capa_id: true }))
    .max(10)
    .default([]),
});
export type ConvertCandidateInput = z.input<typeof ConvertCandidateSchema>;

export const DismissCandidateSchema = z.object({
  reason: z.string().min(3).max(1000),
});
export type DismissCandidateInput = z.input<typeof DismissCandidateSchema>;

export const MergeCandidateSchema = z.object({
  into_hazard_id: z.string().uuid(),
  note: z.string().max(1000).optional().nullable(),
});
export type MergeCandidateInput = z.input<typeof MergeCandidateSchema>;
