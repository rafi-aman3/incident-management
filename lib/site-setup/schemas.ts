import { z } from "zod";

export const Step1Schema = z.object({
  name: z.string().trim().min(1, "Site name is required").max(120),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  country: z.enum(["US", "GB"]),
  timezone: z.string().trim().min(1, "Time zone is required").max(80),
});
export type Step1Values = z.infer<typeof Step1Schema>;

export const Step2Schema = z.object({
  regulator: z.enum(["osha", "hse", "both"]),
});
export type Step2Values = z.infer<typeof Step2Schema>;

export const Step3Schema = z.object({
  // US fields
  osha_establishment_id: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "OSHA Establishment ID must be exactly 8 digits")
    .optional()
    .or(z.literal("")),
  naics_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "NAICS must be exactly 6 digits")
    .optional()
    .or(z.literal("")),
  // GB field
  hse_establishment_number: z.string().trim().max(40).optional().or(z.literal("")),
  // "I'll fill this in later" path
  skipped: z.coerce.boolean().optional(),
});
export type Step3Values = z.infer<typeof Step3Schema>;

const DepartmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(80),
  areas: z.array(z.string().trim().min(1).max(80)).max(40),
});
export const Step4Schema = z.object({
  departments: z.array(DepartmentSchema).max(40),
});
export type Step4Values = z.infer<typeof Step4Schema>;

// Step 5 has no form payload in v1 — it's read-only, showing existing memberships
// (real invite emails are deferred to Phase 4 polish per docs/onboarding.md §5.6).
// The server action just marks step5 complete.

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

const RecipientSchema = z.object({
  recipient_profile_id: z.string().uuid().optional().or(z.literal("")),
  external_email: z.string().email("Not a valid email").optional().or(z.literal("")),
}).refine(
  (r) => Boolean(r.recipient_profile_id) || Boolean(r.external_email),
  { message: "Each recipient must be either a user or an email" }
);

export const Step6Schema = z.object({
  recipients: z.array(
    z.object({
      kind: z.enum(NOTIFICATION_KINDS),
      list: z.array(RecipientSchema).max(20),
    })
  ),
});
export type Step6Values = z.infer<typeof Step6Schema>;

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
