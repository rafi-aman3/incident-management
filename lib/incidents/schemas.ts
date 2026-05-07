import { z } from "zod";
import { INCIDENT_TYPES } from "./types";
import { RIDDOR_SPECIFIED_INJURIES } from "@/lib/constants/riddor";

export const Step1Schema = z.object({
  type: z.enum(INCIDENT_TYPES),
  title: z.string().trim().min(1, "Title is required").max(200),
  occurred_at: z
    .string()
    .min(1, "Date and time are required")
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Not a valid date" })
    .refine((v) => Date.parse(v) <= Date.now(), {
      message: "Occurred time can't be in the future",
    }),
  area: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  is_sandbox: z.coerce.boolean().optional(),
});
export type Step1Values = z.infer<typeof Step1Schema>;

const BODY_PARTS = [
  "head", "neck", "chest", "abdomen", "back",
  "left_arm", "right_arm", "left_hand", "right_hand",
  "left_leg", "right_leg", "left_foot", "right_foot",
  "left_eye", "right_eye", "other",
] as const;

const TREATMENTS = ["none", "first_aid", "medical", "hospitalization"] as const;

export const InjuredPersonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  body_parts: z.array(z.enum(BODY_PARTS)).default([]),
  treatment: z.enum(TREATMENTS).default("none"),
  fatality: z.coerce.boolean().default(false),
  hospitalized: z.coerce.boolean().default(false),
  riddor_specified_injury: z.enum(RIDDOR_SPECIFIED_INJURIES).optional().nullable(),
});
export type InjuredPerson = z.infer<typeof InjuredPersonSchema>;

export const WitnessSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().max(200).optional().or(z.literal("")),
  statement: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type Witness = z.infer<typeof WitnessSchema>;

const MatrixCoord = z.coerce.number().int().min(1).max(5);

export const Step2Schema = z.object({
  // 5×5 matrix selection (universal)
  likelihood: MatrixCoord,
  consequence: MatrixCoord,
  // PPE (injury / illness)
  ppe_worn: z.array(z.string()).default([]),
  // Substance/quantity (environmental release)
  substance: z.string().trim().max(200).optional().or(z.literal("")),
  quantity_value: z.coerce.number().nonnegative().optional().nullable(),
  quantity_unit: z.string().trim().max(20).optional().or(z.literal("")),
  // Equipment (property damage / dangerous occurrence)
  equipment: z.string().trim().max(200).optional().or(z.literal("")),
  // Optional FK to a registered asset (Phase 4) — surfaced in the wizard
  // for property_damage / unsafe_condition. Sparse: null for incidents
  // whose type doesn't pin to a specific asset.
  equipment_asset_id: z.string().uuid().nullable().optional(),
  // Dangerous occurrence kind
  dangerous_occurrence_kind: z.string().trim().max(120).optional().or(z.literal("")),
  // Injured persons (injury / illness)
  injured_persons: z.array(InjuredPersonSchema).max(10).default([]),
  // Witnesses (universal)
  witnesses: z.array(WitnessSchema).max(5).default([]),
});
export type Step2Values = z.infer<typeof Step2Schema>;

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
