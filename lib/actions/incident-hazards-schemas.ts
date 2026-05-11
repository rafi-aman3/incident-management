import { z } from "zod";

export const LinkTypeEnum = z.enum([
  "causal",
  "contributing",
  "exposed_but_not_causal",
]);
export type LinkType = z.infer<typeof LinkTypeEnum>;

export const LinkIncidentToHazardSchema = z.object({
  incident_id: z.string().uuid(),
  hazard_id: z.string().uuid(),
  link_type: LinkTypeEnum,
  notes: z.string().max(2000).optional().nullable(),
});
export type LinkIncidentToHazardInput = z.input<typeof LinkIncidentToHazardSchema>;

export const TriggerReassessmentSchema = z.object({
  hazard_id: z.string().uuid(),
  from_incident_id: z.string().uuid(),
  rationale: z.string().min(3).max(2000),
});
export type TriggerReassessmentInput = z.input<typeof TriggerReassessmentSchema>;
