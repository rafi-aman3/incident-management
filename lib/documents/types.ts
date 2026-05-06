/**
 * Documents + Assets registry — keeps the SQL enums (`document_type`,
 * `asset_kind`, `asset_condition`, `document_link_parent`) and the TS
 * world in sync.
 *
 * Mirrors the rows declared in the Phase 4 schema migration
 * (`20260509120000_phase4_resources_schema.sql`). When you add an enum
 * value, add it here in the same order — UI dropdowns and chip lookups
 * key off these arrays.
 */

import { z } from "zod";
import {
  AlertTriangle,
  BookOpen,
  Camera,
  ClipboardCheck,
  ClipboardSignature,
  FileText,
  GraduationCap,
  Scale,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// document_type
// ---------------------------------------------------------------------------
export const DOCUMENT_TYPES = [
  "sds",
  "sop",
  "policy",
  "training_cert",
  "form",
  "evidence",
  "audit_report",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  sds: "SDS",
  sop: "SOP",
  policy: "Policy",
  training_cert: "Training certificate",
  form: "Form",
  evidence: "Evidence",
  audit_report: "Audit report",
  other: "Other",
};

export const DOCUMENT_TYPE_ICON: Record<DocumentType, LucideIcon> = {
  sds: AlertTriangle,
  sop: BookOpen,
  policy: Scale,
  training_cert: GraduationCap,
  form: ClipboardSignature,
  evidence: Camera,
  audit_report: ClipboardCheck,
  other: FileText,
};

// ---------------------------------------------------------------------------
// asset_kind
// ---------------------------------------------------------------------------
export const ASSET_KINDS = [
  "forklift",
  "fume_hood",
  "fire_extinguisher",
  "aed",
  "conveyor",
  "ergonomic_station",
  "machine_guard",
  "press",
  "crane",
  "vehicle",
  "eyewash_station",
  "spill_kit",
  "safety_shower",
  "generator",
  "other",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  forklift: "Forklift",
  fume_hood: "Fume hood",
  fire_extinguisher: "Fire extinguisher",
  aed: "AED",
  conveyor: "Conveyor",
  ergonomic_station: "Ergonomic station",
  machine_guard: "Machine guard",
  press: "Press",
  crane: "Crane",
  vehicle: "Vehicle",
  eyewash_station: "Eyewash station",
  spill_kit: "Spill kit",
  safety_shower: "Safety shower",
  generator: "Generator",
  other: "Other",
};

// ---------------------------------------------------------------------------
// asset_condition
// ---------------------------------------------------------------------------
export const ASSET_CONDITIONS = [
  "excellent",
  "good",
  "fair",
  "poor",
  "unsafe",
] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const ASSET_CONDITION_LABEL: Record<AssetCondition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unsafe: "Unsafe",
};

/** Token classes for chips. `unsafe` uses destructive — see CLAUDE.md
 *  hard rule on Brand purple vs. severity reds. */
export const ASSET_CONDITION_TONE: Record<AssetCondition, string> = {
  excellent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  good:      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  fair:      "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  poor:      "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200",
  unsafe:    "bg-destructive/10 text-destructive dark:bg-destructive/30",
};

export const ASSET_CONDITION_ICON: Record<AssetCondition, LucideIcon> = {
  excellent: ShieldAlert,
  good:      ShieldAlert,
  fair:      ShieldAlert,
  poor:      AlertTriangle,
  unsafe:    AlertTriangle,
};

// ---------------------------------------------------------------------------
// asset_status
// ---------------------------------------------------------------------------
export const ASSET_STATUSES = ["active", "retired"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

// ---------------------------------------------------------------------------
// document_link_parent
// ---------------------------------------------------------------------------
export const DOCUMENT_LINK_PARENTS = [
  "incident",
  "investigation",
  "capa",
  "asset",
  "site",
  "inspection",
  "finding",
] as const;
export type DocumentLinkParent = (typeof DOCUMENT_LINK_PARENTS)[number];

export const DOCUMENT_LINK_PARENT_LABEL: Record<DocumentLinkParent, string> = {
  incident:      "Incident",
  investigation: "Investigation",
  capa:          "CAPA",
  asset:         "Asset",
  site:          "Site",
  inspection:    "Inspection",
  finding:       "Finding",
};

// ---------------------------------------------------------------------------
// Upload constraints — must match the documents bucket RLS implicitly.
// (Policy is path-prefix only; size + MIME are enforced client-side and
//  re-validated in createDocument server action.)
// ---------------------------------------------------------------------------
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_DOCUMENT_MIMES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIMES)[number];

export function isAllowedDocumentMime(mime: string): mime is AllowedDocumentMime {
  return (ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(mime);
}

// ---------------------------------------------------------------------------
// Zod schemas — used by server actions and client forms
// ---------------------------------------------------------------------------
export const DocumentTypeSchema      = z.enum(DOCUMENT_TYPES);
export const AssetKindSchema         = z.enum(ASSET_KINDS);
export const AssetConditionSchema    = z.enum(ASSET_CONDITIONS);
export const AssetStatusSchema       = z.enum(ASSET_STATUSES);
export const DocumentLinkParentSchema = z.enum(DOCUMENT_LINK_PARENTS);

export const DocumentMetadataSchema = z.object({
  name:        z.string().trim().min(1, "Name is required").max(200),
  type:        DocumentTypeSchema,
  site_id:     z.string().uuid().nullable().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").nullable().optional(),
  notes:       z.string().trim().max(2000).optional().or(z.literal("")),
});
export type DocumentMetadataInput = z.infer<typeof DocumentMetadataSchema>;

export const DocumentUploadSchema = DocumentMetadataSchema.extend({
  storage_path: z.string().trim().min(1).max(500),
  file_name:    z.string().trim().min(1).max(255),
  mime_type:    z.string().trim().min(1).max(120),
  size_bytes:   z.number().int().nonnegative().max(MAX_DOCUMENT_BYTES),
});
export type DocumentUploadInput = z.infer<typeof DocumentUploadSchema>;

export const LinkDocumentSchema = z.object({
  document_id:  z.string().uuid(),
  parent_type:  DocumentLinkParentSchema,
  parent_id:    z.string().uuid(),
  link_role:    z.string().trim().max(60).optional().or(z.literal("")),
});
export type LinkDocumentInput = z.infer<typeof LinkDocumentSchema>;

// ---------------------------------------------------------------------------
// Storage bucket id (kept in code so callers don't string-concat the
// bucket name)
// ---------------------------------------------------------------------------
export const DOCUMENTS_BUCKET = "documents" as const;
