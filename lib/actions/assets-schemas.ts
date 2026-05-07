// Schema definitions extracted from lib/actions/assets.ts so they can be
// imported as runtime values. The actions file is a "use server" module
// and Next.js requires every export there to be an async function — Zod
// schema objects can't live alongside the actions.

import { z } from "zod";
import {
  AssetConditionSchema,
  AssetKindSchema,
  AssetStatusSchema,
} from "@/lib/documents/types";

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .nullable()
  .optional();

export const AssetCreateSchema = z.object({
  name:              z.string().trim().min(1, "Name is required").max(160),
  kind:              AssetKindSchema,
  site_id:           z.string().uuid(),
  location:          z.string().trim().max(160).optional().or(z.literal("")),
  condition:         AssetConditionSchema.default("good"),
  status:            AssetStatusSchema.default("active"),
  last_inspected_at: dateOrNull,
  next_pm_at:        dateOrNull,
  sds_document_id:   z.string().uuid().nullable().optional(),
  notes:             z.string().trim().max(2000).optional().or(z.literal("")),
});
export type AssetCreateInput = z.infer<typeof AssetCreateSchema>;

export const AssetUpdateSchema = AssetCreateSchema.partial().extend({
  // site_id changes are allowed but require asset:edit at BOTH old and new
  // site — handled in updateAsset (lib/actions/assets.ts).
});
export type AssetUpdateInput = z.infer<typeof AssetUpdateSchema>;
