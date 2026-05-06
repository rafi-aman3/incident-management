/**
 * Industry mapping between SafetyCulture's library (kebab-case) and our
 * `industry_type` enum from supabase/migrations/20260505120000_init.sql.
 *
 * Used by:
 *   - the library preset seed migration to normalize SC payloads
 *   - the /templates/browse page to render SC industry chips with our enum
 *
 * Any SC industry not in the table maps to 'office' as a safe fallback.
 */

import type { Database } from "@/lib/supabase/types";

export type IndustryEnum = Database["public"]["Enums"]["industry_type"];

const SC_TO_OURS: Record<string, IndustryEnum> = {
  // Direct matches
  "manufacturing": "manufacturing",
  "warehouse":     "warehouse",
  "office":        "office",
  "construction":  "construction",
  "education":     "education",
  // Hyphenated SC values
  "health-care":   "healthcare",
  // Plural / variant
  "laboratory":    "lab",
  "lab":           "lab",
  "labs":          "lab",
  // Common SC industries that don't map cleanly — collapse to closest neighbor
  "hospitality":   "office",
  "retail":        "office",
  "food-service":  "office",
  "agriculture":   "construction",
  "transportation": "warehouse",
  "logistics":     "warehouse",
  "energy":        "manufacturing",
  "mining":        "construction",
  "government":    "office",
  "non-profit":    "office",
};

const OURS_TO_LABEL: Record<IndustryEnum, string> = {
  healthcare:    "Healthcare",
  education:     "Education",
  manufacturing: "Manufacturing",
  warehouse:     "Warehouse",
  office:        "Office",
  construction:  "Construction",
  lab:           "Lab",
};

export function mapScIndustry(scIndustry: string | null | undefined): IndustryEnum {
  if (!scIndustry) return "office";
  return SC_TO_OURS[scIndustry.toLowerCase()] ?? "office";
}

export function industryLabel(industry: IndustryEnum): string {
  return OURS_TO_LABEL[industry];
}

export const INDUSTRY_VALUES: ReadonlyArray<IndustryEnum> = [
  "healthcare",
  "education",
  "manufacturing",
  "warehouse",
  "office",
  "construction",
  "lab",
];
