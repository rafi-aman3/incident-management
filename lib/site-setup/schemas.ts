import { z } from "zod";
import { HAZARD_TAG_CODES } from "./hazard-tags";
import { APPLICABLE_STANDARD_CODES } from "./applicable-standards";
import { STATE_PLAN_CODES } from "./state-plans";

// ============================================================================
// Step 1 — Site basics
// ============================================================================
// Name + structured address + lat/long + timezone + site_type + lifecycle.
// Country is read-only on this step (locked at site creation); the schema
// accepts it for round-trip but the action ignores changes.

const LatLongSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  })
  .refine(
    (v) =>
      (v.latitude === null || v.latitude === undefined) ===
      (v.longitude === null || v.longitude === undefined),
    {
      message: "Latitude and longitude must be both set or both blank",
      path: ["latitude"],
    }
  );

export const Step1Schema = z
  .object({
    name: z.string().trim().min(1, "Site name is required").max(120),
    street_1: z.string().trim().max(200).optional().or(z.literal("")),
    street_2: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().max(120).optional().or(z.literal("")),
    state_or_region: z.string().trim().max(80).optional().or(z.literal("")),
    postal_code: z.string().trim().max(20).optional().or(z.literal("")),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    country: z.enum(["US", "GB"]),
    timezone: z.string().trim().min(1, "Time zone is required").max(80),
    site_type: z.enum(["fixed", "mobile", "office_only"]),
    operational_status: z.enum(["active", "inactive", "closed"]),
    opened_on: z.string().date().optional().or(z.literal("")),
    closed_on: z.string().date().optional().or(z.literal("")),
  })
  .refine(
    (v) =>
      (v.latitude === null || v.latitude === undefined || v.latitude === ("" as unknown as number)) ===
      (v.longitude === null || v.longitude === undefined || v.longitude === ("" as unknown as number)),
    {
      message: "Latitude and longitude must be both set or both blank",
      path: ["latitude"],
    }
  )
  .refine(
    (v) => v.operational_status !== "closed" || (v.closed_on && v.closed_on !== ""),
    {
      message: "Closed sites need a close date",
      path: ["closed_on"],
    }
  );
export type Step1Values = z.infer<typeof Step1Schema>;

// ============================================================================
// Step 2 — Jurisdiction
// ============================================================================
// Country-branched. US: federal vs state_plan + state_plan_code. GB: hse vs
// local_authority.

export const Step2Schema = z
  .object({
    country: z.enum(["US", "GB"]),
    osha_jurisdiction: z.enum(["federal", "state_plan"]).optional().nullable(),
    state_plan_code: z.string().trim().toUpperCase().length(2).optional().or(z.literal("")),
    gb_jurisdiction: z.enum(["hse", "local_authority"]).optional().nullable(),
  })
  .refine(
    (v) => v.country !== "US" || !!v.osha_jurisdiction,
    { message: "Pick federal OSHA or a state plan", path: ["osha_jurisdiction"] }
  )
  .refine(
    (v) =>
      v.osha_jurisdiction !== "state_plan" ||
      (v.state_plan_code && STATE_PLAN_CODES.includes(v.state_plan_code)),
    { message: "Pick a state plan", path: ["state_plan_code"] }
  )
  .refine(
    (v) => v.country !== "GB" || !!v.gb_jurisdiction,
    { message: "Pick HSE or local authority", path: ["gb_jurisdiction"] }
  );
export type Step2Values = z.infer<typeof Step2Schema>;

// ============================================================================
// Step 3 — Identifiers (country-branched)
// ============================================================================
// US: EIN (NN-NNNNNNN) + NAICS (6 digits) + SIC (4 digits, optional) +
// ITA establishment ID (optional). GB: CRN (Companies House, 8 chars) +
// UK SIC 2007 (5 digits) + HSE establishment number (optional).

export const Step3Schema = z.object({
  country: z.enum(["US", "GB"]),
  // US
  ein: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{7}$/, "EIN must be in NN-NNNNNNN format")
    .optional()
    .or(z.literal("")),
  naics_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "NAICS must be exactly 6 digits")
    .optional()
    .or(z.literal("")),
  sic_code: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "SIC must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  ita_establishment_id: z.string().trim().max(40).optional().or(z.literal("")),
  osha_establishment_id: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "OSHA Establishment ID must be exactly 8 digits")
    .optional()
    .or(z.literal("")),
  // GB
  crn: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "CRN must be exactly 8 alphanumeric characters")
    .optional()
    .or(z.literal("")),
  uk_sic_2007: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "UK SIC 2007 must be exactly 5 digits")
    .optional()
    .or(z.literal("")),
  hse_establishment_number: z.string().trim().max(40).optional().or(z.literal("")),
});
export type Step3Values = z.infer<typeof Step3Schema>;

// ============================================================================
// Step 4 — Workforce (300A inputs + recordkeeping override)
// ============================================================================

export const Step4Schema = z.object({
  peak_employees_year: z.coerce
    .number()
    .int()
    .min(0, "Cannot be negative")
    .max(1_000_000)
    .optional()
    .nullable(),
  avg_employees_year: z.coerce
    .number()
    .int()
    .min(0, "Cannot be negative")
    .max(1_000_000)
    .optional()
    .nullable(),
  partially_exempt_override: z.coerce.boolean(),
});
export type Step4Values = z.infer<typeof Step4Schema>;

// ============================================================================
// Step 5 — Hazard profile
// ============================================================================
// US-only fields gracefully absent on GB sites (action ignores).

export const Step5Schema = z.object({
  applicable_standards: z.array(z.enum(APPLICABLE_STANDARD_CODES)).default([]),
  psm_applicable: z.coerce.boolean(),
  hazard_tags: z.array(z.enum(HAZARD_TAG_CODES)).default([]),
});
export type Step5Values = z.infer<typeof Step5Schema>;

// ============================================================================
// Step 6 — Departments & areas
// ============================================================================

const DepartmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(80),
  areas: z.array(z.string().trim().min(1).max(80)).max(40),
});
export const Step6Schema = z.object({
  departments: z.array(DepartmentSchema).max(40),
});
export type Step6Values = z.infer<typeof Step6Schema>;

// ============================================================================
// Step 7 — People (EHS lead + RIDDOR responsible person + emergency contacts)
// ============================================================================

const EmergencyContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().email("Not a valid email").optional().or(z.literal("")),
}).refine(
  (c) => Boolean(c.phone) || Boolean(c.email),
  { message: "Provide a phone or email", path: ["phone"] }
);

export const Step7Schema = z
  .object({
    country: z.enum(["US", "GB"]),
    site_ehs_lead_id: z.string().uuid("Pick the site EHS lead"),
    riddor_responsible_person_name: z.string().trim().max(120).optional().or(z.literal("")),
    riddor_responsible_person_role: z.string().trim().max(120).optional().or(z.literal("")),
    emergency_contacts: z.array(EmergencyContactSchema).max(20).default([]),
  })
  .refine(
    (v) =>
      v.country !== "GB" ||
      (v.riddor_responsible_person_name && v.riddor_responsible_person_name.trim().length > 0),
    {
      message: "RIDDOR requires a named responsible person",
      path: ["riddor_responsible_person_name"],
    }
  );
export type Step7Values = z.infer<typeof Step7Schema>;

// ============================================================================
// Step 8 — Notification recipients (unchanged from old Step 6)
// ============================================================================

const NOTIFICATION_KINDS = [
  "osha_8hr",
  "osha_24hr",
  "riddor_immediate",
  "riddor_f2508_10d",
  "riddor_7day",
  "riddor_disease",
  "capa_overdue",
  "capa_escalated",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export { NOTIFICATION_KINDS };

const RecipientSchema = z
  .object({
    recipient_profile_id: z.string().uuid().optional().or(z.literal("")),
    external_email: z.string().email("Not a valid email").optional().or(z.literal("")),
  })
  .refine(
    (r) => Boolean(r.recipient_profile_id) || Boolean(r.external_email),
    { message: "Each recipient must be either a user or an email" }
  );

export const Step8Schema = z.object({
  recipients: z.array(
    z.object({
      kind: z.enum(NOTIFICATION_KINDS),
      list: z.array(RecipientSchema).max(20),
    })
  ),
});
export type Step8Values = z.infer<typeof Step8Schema>;

// Backward-compat alias for existing call sites that still import Step6Schema
// for recipients. Phase 13 renumbered to Step8 — keep an alias for one phase.
export { Step8Schema as RecipientsSchema };

// ============================================================================
// Shared
// ============================================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
