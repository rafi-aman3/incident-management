import type { InvestigationStatus } from "@/lib/investigations/types";

/**
 * Plain data shape passed from the server page to the client Kanban
 * board / list view. Same shape used by the card render in both views.
 */
export type InvestigationCardData = {
  id: string;
  ref_code: string | null;
  status: InvestigationStatus;
  due_date: string | null;
  started_at: string | null;
  lead_investigator_id: string | null;
  site_id: string;
  site_name: string | null;
  lead: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  incident: {
    id: string;
    ref_code: string | null;
    title: string;
    severity: "S1" | "S2" | "S3" | "S4" | "S5" | null;
    track: "A" | "B" | "C" | null;
  };
};
