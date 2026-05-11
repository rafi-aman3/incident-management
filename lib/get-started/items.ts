import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SectionKey } from "./sections";
import type { UseCaseKey } from "./use-cases";

type DBClient = SupabaseClient<Database>;

export type PredicateCtx = {
  supabase: DBClient;
  orgId: string;
  userId: string;
};

export type ChecklistItem = {
  id: string;
  section: SectionKey;
  useCase?: UseCaseKey;
  label: string;
  description?: string;
  ctaLabel: string;
  /** null = info-only row (no CTA, never appears in the dashboard widget). */
  ctaHref: string | null;
  /** Auto-detect "done" predicate. Counter ORs this with the dismissed set. */
  predicate: (ctx: PredicateCtx) => Promise<boolean>;
  /** When true, the item is hidden unless orgs.argus_enabled is true. */
  requiresArgus?: boolean;
};

// Tiny helper — head-count exists(). Returns true if the predicate returns
// at least one row.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exists(ctx: PredicateCtx, table: string, filter: (q: any) => any): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = (ctx.supabase as any).from(table).select("id", { count: "exact", head: true });
  const { count } = await filter(base);
  return (count ?? 0) > 0;
}

/**
 * Master catalog. Each entry is org-scoped — predicates count rows across
 * every site in the org. Section + useCase determine where the item appears.
 *
 * Stable item ids: changing them invalidates orgs.onboarding_dismissed
 * entries. Add new items at the end; never repurpose an existing id.
 */
export const CHECKLIST_ITEMS: ReadonlyArray<ChecklistItem> = [
  // ---------- Always shown — Workspace ----------
  {
    id: "org_created",
    section: "workspace",
    label: "Create your organization",
    ctaLabel: "",
    ctaHref: null,
    predicate: async () => true,
  },
  {
    id: "first_site_added",
    section: "workspace",
    label: "Add your first site",
    ctaLabel: "",
    ctaHref: null,
    predicate: async () => true,
  },
  {
    id: "use_cases_picked",
    section: "workspace",
    label: "Pick your use-cases",
    description: "Tells us what to highlight on your Get Started checklist.",
    ctaLabel: "Edit",
    ctaHref: "/get-started?edit=use-cases",
    predicate: async (ctx) => {
      const { data } = await ctx.supabase
        .from("orgs")
        .select("onboarding_use_cases")
        .eq("id", ctx.orgId)
        .single();
      return ((data?.onboarding_use_cases as string[] | null) ?? []).length > 0;
    },
  },
  {
    id: "site_setup_finished",
    section: "workspace",
    label: "Finish site setup (OSHA / RIDDOR detail)",
    description: "Annual hours, NAICS, emergency contacts — required for OSHA 300 / 300A.",
    ctaLabel: "Continue",
    ctaHref: "/admin/site-setup",
    predicate: async (ctx) => {
      const { count: total } = await ctx.supabase
        .from("sites")
        .select("id", { count: "exact", head: true })
        .eq("org_id", ctx.orgId);
      const { count: done } = await ctx.supabase
        .from("sites")
        .select("id", { count: "exact", head: true })
        .eq("org_id", ctx.orgId)
        .not("setup_completed_at", "is", null);
      return (total ?? 0) > 0 && (done ?? 0) === (total ?? 0);
    },
  },
  {
    id: "team_invited",
    section: "workspace",
    label: "Invite your safety team",
    description: "Add the rest of your team. You can change their roles any time.",
    ctaLabel: "Open Members",
    ctaHref: "/admin/members",
    predicate: async (ctx) => {
      const { data: siteRows } = await ctx.supabase
        .from("sites")
        .select("id")
        .eq("org_id", ctx.orgId);
      const siteIds = (siteRows ?? []).map((r) => r.id);
      if (siteIds.length === 0) return false;
      const { data: members } = await ctx.supabase
        .from("site_members")
        .select("profile_id")
        .in("site_id", siteIds);
      const distinct = new Set((members ?? []).map((m) => m.profile_id));
      return distinct.size >= 2;
    },
  },
  {
    id: "sidebar_customized",
    section: "workspace",
    label: "Customize your sidebar",
    description: "Hide modules you don't use to keep navigation focused.",
    ctaLabel: "Open Settings",
    ctaHref: "/settings/sidebar",
    predicate: async (ctx) => {
      const { data } = await ctx.supabase
        .from("profiles")
        .select("sidebar_hidden_items")
        .eq("id", ctx.userId)
        .single();
      return ((data?.sidebar_hidden_items as string[] | null) ?? []).length > 0;
    },
  },

  // ---------- Incidents ----------
  {
    id: "first_incident_reported",
    section: "incidents",
    useCase: "incidents",
    label: "Report your first incident",
    description: "Walk through the 3-step Report Wizard.",
    ctaLabel: "Start",
    ctaHref: "/incidents/new/1",
    predicate: (ctx) =>
      exists(ctx, "incidents", (q) =>
        q.eq("org_id", ctx.orgId).eq("is_sandbox", false).is("deleted_at", null)
      ),
  },
  {
    id: "first_investigation_run",
    section: "incidents",
    useCase: "incidents",
    label: "Run an investigation",
    description: "Open a Track-A incident and complete its 5-Why chain.",
    ctaLabel: "Open",
    ctaHref: "/investigations",
    // investigations has no root_cause_finalized_at; status='closed' is the
    // equivalent completion signal (set when investigation is fully wrapped up).
    predicate: (ctx) =>
      exists(ctx, "investigations", (q) =>
        q.eq("org_id", ctx.orgId).is("deleted_at", null).eq("status", "closed")
      ),
  },

  // ---------- Inspections ----------
  {
    id: "first_template_built",
    section: "inspections",
    useCase: "inspections",
    label: "Build your first inspection template",
    description: "Save a custom checklist your team will reuse.",
    ctaLabel: "Start",
    ctaHref: "/templates/new",
    predicate: (ctx) =>
      exists(ctx, "templates", (q) => q.eq("org_id", ctx.orgId)),
  },
  {
    id: "first_inspection_run",
    section: "inspections",
    useCase: "inspections",
    label: "Run an inspection",
    description: "Walk a template end-to-end on one of your sites.",
    ctaLabel: "Open Inspections",
    ctaHref: "/inspections",
    predicate: (ctx) =>
      exists(ctx, "inspections", (q) =>
        q.eq("org_id", ctx.orgId).is("deleted_at", null).not("completed_at", "is", null)
      ),
  },

  // ---------- Hazards & JSA ----------
  {
    id: "first_hazard_added",
    section: "hazards_jsa",
    useCase: "hazards_jsa",
    label: "Add a hazard to the register",
    ctaLabel: "Start",
    ctaHref: "/hazards/new",
    predicate: (ctx) => exists(ctx, "hazards", (q) => q.eq("org_id", ctx.orgId)),
  },
  {
    id: "first_jsa_created",
    section: "hazards_jsa",
    useCase: "hazards_jsa",
    label: "Create your first JSA",
    ctaLabel: "Start",
    ctaHref: "/jsa/new",
    predicate: (ctx) => exists(ctx, "jsas", (q) => q.eq("org_id", ctx.orgId)),
  },

  // ---------- Assets & Documents ----------
  {
    id: "first_asset_added",
    section: "assets_documents",
    useCase: "assets_documents",
    label: "Add your first asset",
    ctaLabel: "Start",
    ctaHref: "/resources/assets/new",
    predicate: (ctx) => exists(ctx, "assets", (q) => q.eq("org_id", ctx.orgId)),
  },
  {
    id: "first_document_uploaded",
    section: "assets_documents",
    useCase: "assets_documents",
    label: "Upload a document",
    ctaLabel: "Open Documents",
    ctaHref: "/resources/documents",
    predicate: (ctx) =>
      exists(ctx, "documents", (q) =>
        q.eq("org_id", ctx.orgId).is("archived_at", null)
      ),
  },

  // ---------- Planner ----------
  {
    id: "first_planner_entry",
    section: "planner",
    useCase: "planner",
    label: "Schedule something",
    description:
      "Open Templates and assign one to a site with a recurring schedule — it shows up on the Planner.",
    ctaLabel: "Open Templates",
    ctaHref: "/templates",
    predicate: async (ctx) => {
      const { data: siteRows } = await ctx.supabase
        .from("sites")
        .select("id")
        .eq("org_id", ctx.orgId);
      const siteIds = (siteRows ?? []).map((r) => r.id);
      if (siteIds.length === 0) return false;
      const { count } = await ctx.supabase
        .from("template_assignments")
        .select("id", { count: "exact", head: true })
        .in("site_id", siteIds)
        .is("unassigned_at", null);
      return (count ?? 0) > 0;
    },
  },

  // ---------- Power up — Argus ----------
  {
    id: "argus_intro_seen",
    section: "power_up",
    label: "Meet Argus, your safety co-pilot",
    description: "See how the assistant helps with reporting, classification, and investigation.",
    ctaLabel: "Open Argus",
    ctaHref: "/get-started?open=argus",
    requiresArgus: true,
    predicate: (ctx) =>
      exists(ctx, "argus_suggestions", (q) =>
        q.eq("org_id", ctx.orgId).eq("user_id", ctx.userId)
      ),
  },
];

/** Lookup helper for actions that need to validate item ids. */
export function getItemById(id: string): ChecklistItem | undefined {
  return CHECKLIST_ITEMS.find((i) => i.id === id);
}
