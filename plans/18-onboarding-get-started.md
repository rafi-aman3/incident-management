# Phase 18 — Onboarding + Get Started redesign

**Status:** drafted 2026-05-12 — informed by the brainstorming session captured in `docs/superpowers/specs/2026-05-12-onboarding-get-started-redesign-design.md`
**Goal:** Replace the current 3-step `/onboarding` wizard with a slimmer 2-step flow that captures use-case intent (multi-select tiles), and add a persistent **Get Started** checklist with auto-detected completion on `/get-started`, a compact 3-up dashboard widget, and a sidebar-footer progress chip. Admin-only audience (`org:configure`).
**Estimated duration:** ~3-4 days (one migration + 5 lib files + 1 wizard reshape + 1 new route + 3 new components + dashboard + sidebar mount).
**Depends on:** Phase 12 closed (auth + onboarding wizard) · Phase 13 closed (`sites.setup_completed_at`) · Phase 17 closed (`orgCan('org:configure')` + `profiles.sidebar_hidden_items`) · Phase 9a closed (`orgs.argus_enabled` exists for the Argus item) · Phase 14/15 closed (Hazards + JSA tables exist for the per-use-case predicates).
**Branch:** `feat/onboarding-get-started` (already created — this plan lands as the second commit on it).
**PR target:** `main`
**New deps:** none — every primitive (radix Dialog, lucide icons, Promise.all count queries, sonner toasts, react-hook-form) ships already.
**Schema migration:** **one** — `20260525120000_phase18_onboarding_get_started.sql`.

> **What this PR ships:**
> - One migration adding `orgs.onboarding_use_cases text[]` + `orgs.onboarding_dismissed text[]`, with a one-shot backfill that infers `onboarding_use_cases` from existing incidents / inspections / hazards / assets / template_assignments rows so mature orgs land with the right sections pre-populated.
> - New `/onboarding` step 2: 5 use-case tiles (multi-select). Step 1 (`OrgAndSiteStep`) is unchanged. The Invite-teammates step is dropped from the wizard and reappears as a Get Started checklist item linking to `/admin/members`.
> - New `lib/get-started/` slice — `use-cases.ts` (tile catalog), `sections.ts` (section metadata), `items.ts` (item catalog with per-item predicates + CTAs), `state.ts` (`getChecklistState()` — Promise.all of predicates).
> - New `/get-started` route — RSC sectioned page, `<EditUseCasesModal>`, `<ChecklistRow>`, `<ShowDismissedToggle>`, 100% celebration state. Three server actions: `dismissItem` · `undismissItem` · `updateUseCases`. All gated on `orgCan('org:configure')`.
> - New `<GetStartedWidget>` mounted in `app/(app)/dashboard/page.tsx` between the yellow site-setup banner and the `Hi, {firstName}` heading. Renders only for admins below 100%.
> - New `<SidebarGetStartedChip>` mounted in `<SidebarFooter>` directly above the existing user-info block. Includes a collapsed icon-only state (32px tile with circular progress ring + tooltip).
> - SPEC delta logged in §15 + new §UI-GETSTARTED subsection locking the use-case keys, the master item set, the auto-detect predicates, and the 100% behavior.

> **Not in this PR (deferred):**
> - **No worker / supervisor checklists.** Non-admins keep today's `WorkerWelcomeCard` / `RoleWelcomeCard`. Role-tailored lists are a v2 follow-up.
> - **No per-user dismissal.** Dismissal is per-org — small admin set, no need for the per-user complexity in v1.
> - **No animation / confetti at 100%.** Static "You're all set" state. Consistent with the platform's no-tour-overlay rule.
> - **No sample-data seeding.** We do not pre-populate dummy incidents / templates / hazards. The checklist nudges users to create real records.
> - **No new permission keys.** Reuses `org:configure` (Phase 17). Workers + supervisors never see the surface.
> - **Yellow `setupIncompleteSiteName` banner stays untouched.** Coexists with the widget — different shape, same nudge.

---

## Why this scope

**The current dashboard nudges are bottom-of-page.** `WorkerWelcomeCard` and `RoleWelcomeCard` live at the very bottom of `/dashboard`, below KPIs, Argus tiles, recent incidents, and bulletins. For a site_admin who just finished a 30-second wizard and lands on the dashboard, the "what should I do next?" affordance is below the fold. The widget moves it to the top — directly under the greeting, where attention actually is.

**Slimming the wizard is the high-leverage move.** The Invite-teammates step is the only step today that can fail (Supabase RPC returns partial failures inline) and the only step a user is likely to skip. Dropping it removes both a failure surface and a friction point, and the Get Started item replaces it with zero loss of capability. Site-admin → `/admin/members` is one click; the team probably isn't sitting next to the admin at signup anyway.

**Use-case intent capture is what makes Get Started feel personal.** Without it the checklist either shows every item (overwhelming) or guesses (often wrong). With it, the section structure matches what the user said they came for — which is the same UX win Linear / Vercel / Notion all converged on.

**Hybrid auto-detect + dismiss is what makes Get Started feel truthful.** Auto-detect alone leaves "single-site org never adds another site" stuck at 6/7 forever. Materialized rows are over-engineered for ~10 items per org. The two-column hybrid (use_cases + dismissed text arrays) lands in a single migration and stays in sync with reality because the predicates read live tables.

---

## Pre-flight deps

- **Phase 12 closed (PR #25, 2026-05-09)** — `app/(onboarding)/onboarding/` is on `main` with the 3-step wizard. Phase 18 modifies `onboarding-wizard.tsx` + `actions.ts` in place; no new route under `(onboarding)`.
- **Phase 13 closed (PR #26)** — `sites.setup_completed_at` exists; `site_setup_finished` predicate uses it. The yellow `setupIncompleteSiteName` banner on `/dashboard` already nudges to `/admin/site-setup` — we keep both nudges.
- **Phase 17 closed (PR #44, 2026-05-12)** — `lib/auth/orgCan.ts` + the `org:configure` permission key + the `requireOrgPermission` guard exist. `profiles.sidebar_hidden_items` exists; the `sidebar_customized` item reads it.
- **Phase 9a closed (PR #27)** — `orgs.argus_enabled` exists; the Argus item is gated on it.
- **Phase 14 + 15 closed (PRs #40, #41)** — `hazards` and `jsas` tables exist; the `first_hazard_added` and `first_jsa_created` predicates use them.

---

## Spec deltas to fold

Two additions to `docs/SPEC.md` ship with this plan:

1. **§15 — new 2026-05-12 entry**: "Onboarding wizard slimmed to 2 steps. Invite step dropped from the wizard (reappears as Get Started item `team_invited`). Step 2 captures use-case intent via 5 multi-select tiles. Persisted to `orgs.onboarding_use_cases text[]` (Phase 18 / PR #N)."

2. **New §UI-GETSTARTED subsection** (next to §UI-SETTINGS-IA in SPEC.md). Locks:
   - The 5 use-case keys: `incidents` · `inspections` · `hazards_jsa` · `assets_documents` · `planner`.
   - The master item set per section (always-shown + per-use-case + Argus power-up).
   - Auto-detect predicates are **org-scoped**, not site-scoped — counts come from any site in the org.
   - **Numerator = items where the predicate is true OR the item id is in `orgs.onboarding_dismissed`. Denominator = visible items (always-shown + items in picked use-case sections + Argus item if applicable).**
   - 100% behavior: dashboard widget + sidebar chip hide; `/get-started` page renders the celebration state.
   - Audience: `org:configure` only. Non-admins keep today's role welcome cards.
   - Yellow `setupIncompleteSiteName` banner on `/dashboard` coexists with the widget; both nudges remain.

---

## Schema migration: `20260525120000_phase18_onboarding_get_started.sql`

```sql
-- ============================================================================
-- Phase 18 — Onboarding + Get Started redesign
-- ============================================================================
-- 1. orgs.onboarding_use_cases text[]   — wizard step 2 pick + later edits
-- 2. orgs.onboarding_dismissed text[]   — per-org dismissed checklist item ids
-- 3. Backfill onboarding_use_cases for existing orgs from real activity
-- ============================================================================

begin;

-- 1 + 2. New columns on orgs --------------------------------------------------
alter table public.orgs
  add column onboarding_use_cases text[] not null default '{}',
  add column onboarding_dismissed text[] not null default '{}';

comment on column public.orgs.onboarding_use_cases is
  'Use-case keys picked in the onboarding wizard step 2. Allowed values: incidents, inspections, hazards_jsa, assets_documents, planner. Editable later from /get-started.';
comment on column public.orgs.onboarding_dismissed is
  'Item ids the org has dismissed from /get-started (e.g. invite_team). Counts toward the done numerator.';

-- 3. Backfill use-cases from existing activity --------------------------------
-- Every existing org gets onboarding_use_cases inferred from whether they've
-- used each module. Empty result is fine (silent orgs see only the always-
-- shown Workspace section). Joins via sites for tables that don't carry
-- org_id directly.
update public.orgs o set onboarding_use_cases = array(
  select v.uc from (values
    ('incidents',        exists(select 1 from public.incidents      where org_id = o.id and is_sandbox = false and deleted_at is null)),
    ('inspections',      exists(select 1 from public.inspections    where org_id = o.id and deleted_at is null)),
    ('hazards_jsa',      exists(select 1 from public.hazards        where org_id = o.id)
                       or exists(select 1 from public.jsas          where org_id = o.id)),
    ('assets_documents', exists(select 1 from public.assets         where org_id = o.id)
                       or exists(select 1 from public.documents     where org_id = o.id and archived_at is null)),
    ('planner',          exists(select 1 from public.template_assignments ta
                                join public.sites s on s.id = ta.site_id
                                where s.org_id = o.id and ta.unassigned_at is null))
  ) v(uc, has_it)
  where v.has_it = true
);

commit;
```

**RLS:** both new columns are on `orgs`. `orgs` RLS is already defined in `init.sql` (org members read; writes via SECURITY DEFINER through server actions). No new policy needed. The server action `updateUseCases` performs a direct `UPDATE orgs SET onboarding_use_cases = $1 WHERE id = $2` — it'll succeed for the same caller-as-org-member set the existing select policy already trusts. Writes for `dismissItem` / `undismissItem` are similar.

> **Why no DB CHECK constraint on the array values:** keeping the list open lets a future phase add a 6th use-case tile (e.g. a new module) without a migration. Validation happens server-side in the action via a Zod enum.

---

## File map

```
supabase/migrations/
  20260525120000_phase18_onboarding_get_started.sql   ← new

lib/get-started/
  use-cases.ts                                         ← new (5 tile defs)
  sections.ts                                          ← new (section metadata)
  items.ts                                             ← new (master item catalog + predicates)
  state.ts                                             ← new (getChecklistState entrypoint)

app/(onboarding)/onboarding/
  onboarding-wizard.tsx                                ← modified (drop InviteStep, add UseCasePickStep)
  actions.ts                                           ← modified (drop inviteOnOnboarding; rename finishOnboarding → finishOnboardingWithUseCases; new arg)
  page.tsx                                             ← modified (initialStep flows: org → use_cases → finish)

app/(app)/get-started/
  page.tsx                                             ← new (sectioned RSC with celebration at 100%)
  actions.ts                                           ← new (dismissItem · undismissItem · updateUseCases)
  edit-use-cases-modal.tsx                             ← new (re-uses the wizard tile set)

components/get-started/
  use-case-tiles.tsx                                   ← new (shared tile renderer for wizard + modal)
  checklist-row.tsx                                    ← new (row primitive: radio + label + CTA + Dismiss)
  show-dismissed-toggle.tsx                            ← new (collapsible "Show N dismissed items")
  dashboard-widget.tsx                                 ← new (compact 3-up preview, RSC)
  sidebar-get-started-chip.tsx                         ← new (chip + collapsed icon-only ring)

app/(app)/dashboard/
  page.tsx                                             ← modified (mount <GetStartedWidget> below banner)

components/app-shell/
  app-sidebar.tsx                                      ← modified (mount <SidebarGetStartedChip> in SidebarFooter)

docs/
  SPEC.md                                              ← appended (§15 entry + new §UI-GETSTARTED)
  BUILD_STATUS.md                                      ← appended (PR entry stub on merge)
```

---

## Task 1 — Schema migration

**Files:**
- Create: `supabase/migrations/20260525120000_phase18_onboarding_get_started.sql`

- [ ] **Step 1.1 — Write the migration**

Paste the migration SQL from the **Schema migration** section above into the new file, verbatim.

- [ ] **Step 1.2 — Apply locally**

```bash
pnpm db:push
```

Expected: migration applies cleanly. No errors about missing `incidents.deleted_at` or `template_assignments.unassigned_at` (both shipped in earlier phases).

- [ ] **Step 1.3 — Verify backfill**

```bash
pnpm db:check 2>/dev/null | head -40
# OR run manually:
psql "$SUPABASE_DB_URL" -c "select id, name, onboarding_use_cases from public.orgs limit 5;"
```

Expected: at least one demo org has non-empty `onboarding_use_cases` matching whatever data its sites contain. The default-organization (no activity) shows `'{}'`.

- [ ] **Step 1.4 — Regen Supabase types**

```bash
pnpm db:types
```

Expected: `lib/supabase/types.ts` now lists `onboarding_use_cases` and `onboarding_dismissed` on the `orgs` Row + Insert + Update types.

- [ ] **Step 1.5 — Commit**

```bash
git add supabase/migrations/20260525120000_phase18_onboarding_get_started.sql lib/supabase/types.ts
git commit -m "feat(phase18): add orgs.onboarding_use_cases + onboarding_dismissed + backfill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — Use-case + section catalogs

**Files:**
- Create: `lib/get-started/use-cases.ts`
- Create: `lib/get-started/sections.ts`

- [ ] **Step 2.1 — Write `lib/get-started/use-cases.ts`**

```ts
import {
  AlertOctagon,
  ClipboardSignature,
  TriangleAlert,
  Boxes,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

/**
 * Use-case keys persisted in orgs.onboarding_use_cases. Editing this list
 * is a schema-touching change — keep keys stable. Server actions validate
 * against this enum.
 */
export const USE_CASE_KEYS = [
  "incidents",
  "inspections",
  "hazards_jsa",
  "assets_documents",
  "planner",
] as const;

export type UseCaseKey = (typeof USE_CASE_KEYS)[number];

export type UseCaseDef = {
  key: UseCaseKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const USE_CASES: ReadonlyArray<UseCaseDef> = [
  {
    key: "incidents",
    label: "Report & investigate incidents",
    description: "Capture events, run 5-Whys, manage CAPA, file OSHA / RIDDOR.",
    icon: AlertOctagon,
  },
  {
    key: "inspections",
    label: "Run inspections",
    description: "Build templates, schedule recurring rounds, log findings.",
    icon: ClipboardSignature,
  },
  {
    key: "hazards_jsa",
    label: "Manage hazards & JSA",
    description: "Hazard register, controls, job safety analyses, SDS imports.",
    icon: TriangleAlert,
  },
  {
    key: "assets_documents",
    label: "Track assets & documents",
    description: "Equipment registry, attached docs, lifecycle tracking.",
    icon: Boxes,
  },
  {
    key: "planner",
    label: "Schedule recurring work",
    description: "Planner calendar for inspections, JSA reviews, control checks.",
    icon: CalendarDays,
  },
];

export function isUseCaseKey(value: unknown): value is UseCaseKey {
  return (
    typeof value === "string" &&
    (USE_CASE_KEYS as readonly string[]).includes(value)
  );
}
```

- [ ] **Step 2.2 — Write `lib/get-started/sections.ts`**

```ts
import type { UseCaseKey } from "./use-cases";

export const SECTION_KEYS = [
  "workspace",
  "incidents",
  "inspections",
  "hazards_jsa",
  "assets_documents",
  "planner",
  "power_up",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type SectionDef = {
  key: SectionKey;
  label: string;
  /** When set, the section is only included if the org picked this use-case. */
  requiresUseCase?: UseCaseKey;
};

export const SECTIONS: ReadonlyArray<SectionDef> = [
  { key: "workspace", label: "Set up your workspace" },
  { key: "incidents", label: "Start using Incidents", requiresUseCase: "incidents" },
  { key: "inspections", label: "Start using Inspections", requiresUseCase: "inspections" },
  { key: "hazards_jsa", label: "Start using Hazards & JSA", requiresUseCase: "hazards_jsa" },
  { key: "assets_documents", label: "Start using Assets & Documents", requiresUseCase: "assets_documents" },
  { key: "planner", label: "Start using the Planner", requiresUseCase: "planner" },
  { key: "power_up", label: "Power up" },
];
```

- [ ] **Step 2.3 — Commit**

```bash
git add lib/get-started/use-cases.ts lib/get-started/sections.ts
git commit -m "feat(phase18): add use-case + section catalogs for Get Started

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Item catalog + predicates

**Files:**
- Create: `lib/get-started/items.ts`

- [ ] **Step 3.1 — Write the item catalog**

```ts
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
async function exists(
  ctx: PredicateCtx,
  table: string,
  filter: (q: ReturnType<DBClient["from"]>) => ReturnType<DBClient["from"]>
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = ctx.supabase.from(table as any).select("id", { count: "exact", head: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (filter(base as any) as any);
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
    // True when every site in the org has setup_completed_at populated.
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
    // ≥1 non-creator membership across any site in the org. We approximate
    // "non-creator" as "≥2 distinct profile_ids on site_members for any
    // site in this org" — the creator is one of them.
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
    description: "Open a Track-A incident and finalize its 5-Why chain.",
    ctaLabel: "Open",
    ctaHref: "/investigations",
    predicate: (ctx) =>
      exists(ctx, "investigations", (q) =>
        q.eq("org_id", ctx.orgId).is("deleted_at", null).not("root_cause_finalized_at", "is", null)
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
    // Active template_assignment = "scheduled work" on the planner.
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
```

> **Note on the `exists()` helper:** the `as any` casts are unavoidable until Supabase's typed builder accepts a generic table name. They're contained to one helper — every call site is type-safe.

- [ ] **Step 3.2 — Commit**

```bash
git add lib/get-started/items.ts
git commit -m "feat(phase18): add Get Started item catalog with auto-detect predicates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — State engine

**Files:**
- Create: `lib/get-started/state.ts`

- [ ] **Step 4.1 — Write the engine**

```ts
import { createClient } from "@/lib/supabase/server";
import { CHECKLIST_ITEMS, type ChecklistItem } from "./items";
import { SECTIONS, type SectionKey } from "./sections";
import { isUseCaseKey, type UseCaseKey } from "./use-cases";

export type ChecklistRowState = {
  item: ChecklistItem;
  done: boolean;
  dismissed: boolean;
  /** done OR dismissed — what the counter uses. */
  counted: boolean;
};

export type ChecklistSection = {
  key: SectionKey;
  label: string;
  rows: ChecklistRowState[];
};

export type ChecklistState = {
  sections: ChecklistSection[];
  doneCount: number;       // counted (done OR dismissed)
  totalCount: number;      // visible items
  rawDoneCount: number;    // done only (no dismissals)
  dismissedCount: number;
  useCases: UseCaseKey[];
  argusEnabled: boolean;
};

/**
 * Phase 18 — getChecklistState.
 *
 * Reads orgs.onboarding_use_cases + onboarding_dismissed + argus_enabled
 * with one query, runs every applicable predicate via Promise.all, and
 * returns the assembled sectioned structure. The dashboard widget and
 * /get-started page both call this directly from a server component.
 */
export async function getChecklistState(args: {
  orgId: string;
  userId: string;
}): Promise<ChecklistState> {
  const supabase = await createClient();

  const { data: orgRow, error: orgErr } = await supabase
    .from("orgs")
    .select("onboarding_use_cases, onboarding_dismissed, argus_enabled")
    .eq("id", args.orgId)
    .single();
  if (orgErr || !orgRow) {
    throw new Error(`getChecklistState: orgs row not found (${orgErr?.message})`);
  }

  const useCases = ((orgRow.onboarding_use_cases as string[] | null) ?? []).filter(
    isUseCaseKey
  );
  const dismissed = new Set<string>(
    (orgRow.onboarding_dismissed as string[] | null) ?? []
  );
  const argusEnabled = Boolean(orgRow.argus_enabled);

  // Filter the catalog to applicable items.
  const applicable = CHECKLIST_ITEMS.filter((item) => {
    if (item.requiresArgus && !argusEnabled) return false;
    if (item.useCase && !useCases.includes(item.useCase)) return false;
    return true;
  });

  // Run every predicate in parallel.
  const predicateResults = await Promise.all(
    applicable.map((item) =>
      item.predicate({ supabase, orgId: args.orgId, userId: args.userId }).catch(() => false)
    )
  );

  // Assemble row states.
  const rows: ChecklistRowState[] = applicable.map((item, idx) => {
    const done = predicateResults[idx];
    const isDismissed = dismissed.has(item.id);
    return { item, done, dismissed: isDismissed, counted: done || isDismissed };
  });

  // Group into sections (skipping any section that ended up empty).
  const sections: ChecklistSection[] = [];
  for (const sectionDef of SECTIONS) {
    const sectionRows = rows.filter((r) => r.item.section === sectionDef.key);
    if (sectionRows.length === 0) continue;
    sections.push({ key: sectionDef.key, label: sectionDef.label, rows: sectionRows });
  }

  const doneCount = rows.filter((r) => r.counted).length;
  const rawDoneCount = rows.filter((r) => r.done).length;
  const dismissedCount = rows.filter((r) => r.dismissed).length;

  return {
    sections,
    doneCount,
    totalCount: rows.length,
    rawDoneCount,
    dismissedCount,
    useCases,
    argusEnabled,
  };
}

/** Convenience for the dashboard widget — the next N not-done, not-dismissed
 *  items in display order. Excludes info-only rows (ctaHref === null). */
export function pickNextItems(
  state: ChecklistState,
  limit: number
): ChecklistRowState[] {
  const out: ChecklistRowState[] = [];
  for (const section of state.sections) {
    for (const row of section.rows) {
      if (out.length >= limit) return out;
      if (row.counted) continue;
      if (row.item.ctaHref === null) continue;
      out.push(row);
    }
  }
  return out;
}
```

- [ ] **Step 4.2 — Commit**

```bash
git add lib/get-started/state.ts
git commit -m "feat(phase18): add getChecklistState engine + pickNextItems helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — Onboarding wizard reshape

**Files:**
- Modify: `app/(onboarding)/onboarding/onboarding-wizard.tsx`
- Modify: `app/(onboarding)/onboarding/actions.ts`
- Modify: `app/(onboarding)/onboarding/page.tsx`
- Create: `components/get-started/use-case-tiles.tsx`

- [ ] **Step 5.1 — Write the shared tile renderer**

`components/get-started/use-case-tiles.tsx` is used by both the wizard step 2 and the `<EditUseCasesModal>` on `/get-started`. Encoding the tile shape here once avoids drift.

```tsx
"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { USE_CASES, type UseCaseKey } from "@/lib/get-started/use-cases";
import { cn } from "@/lib/utils";

export function UseCaseTiles({
  selected,
  onToggle,
}: {
  selected: ReadonlySet<UseCaseKey>;
  onToggle: (key: UseCaseKey) => void;
}) {
  const labelId = useId();
  return (
    <ul
      role="group"
      aria-labelledby={labelId}
      className="grid gap-2.5 sm:grid-cols-2"
    >
      <span id={labelId} className="sr-only">
        Use-cases
      </span>
      {USE_CASES.map((uc) => {
        const Icon = uc.icon;
        const isSel = selected.has(uc.key);
        return (
          <li key={uc.key} className={uc.key === "planner" ? "sm:col-span-2" : undefined}>
            <button
              type="button"
              onClick={() => onToggle(uc.key)}
              aria-pressed={isSel}
              className={cn(
                "group flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
                isSel
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-accent/40"
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-md",
                  isSel ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {uc.label}
                  {isSel && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      <Check className="h-2.5 w-2.5" aria-hidden /> Picked
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {uc.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5.2 — Rewrite `app/(onboarding)/onboarding/actions.ts`**

Drop `inviteOnOnboarding`. Rename `finishOnboarding` → `finishOnboardingWithUseCases` and accept the picked use-cases. Keep `bootstrapOrg` as-is.

```ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { Database } from "@/lib/supabase/types";
import { USE_CASE_KEYS, type UseCaseKey } from "@/lib/get-started/use-cases";

type IndustryType = Database["public"]["Enums"]["industry_type"];
const INDUSTRY_VALUES: ReadonlyArray<IndustryType> = [
  "healthcare", "education", "manufacturing", "warehouse",
  "office", "construction", "lab",
];

const bootstrapSchema = z.object({
  org_name: z.string().trim().min(1, "Organization name is required").max(120),
  industry: z.enum(INDUSTRY_VALUES as unknown as [IndustryType, ...IndustryType[]]),
  site_name: z.string().trim().min(1, "Site name is required").max(120),
  country: z.enum(["US", "GB"]),
  timezone: z.string().trim().min(1, "Timezone is required").max(60),
});

export async function bootstrapOrg(
  _prev: ActionResult<{ siteId: string }> | null,
  fd: FormData
): Promise<ActionResult<{ siteId: string }>> {
  const parsed = bootstrapSchema.safeParse({
    org_name: fd.get("org_name"),
    industry: fd.get("industry"),
    site_name: fd.get("site_name"),
    country: fd.get("country"),
    timezone: fd.get("timezone"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bootstrap_org_v1", {
    p_org_name: parsed.data.org_name,
    p_industry: parsed.data.industry,
    p_country: parsed.data.country,
    p_site_name: parsed.data.site_name,
    p_timezone: parsed.data.timezone,
  });
  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("site_id" in row)) {
    return { ok: false, error: "Bootstrap returned no site id" };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { siteId: String(row.site_id) } };
}

const finishSchema = z.object({
  use_cases: z.array(z.enum(USE_CASE_KEYS as unknown as [UseCaseKey, ...UseCaseKey[]])).min(0).max(USE_CASE_KEYS.length),
});

/**
 * Phase 18 — finish onboarding with picked use-cases.
 *
 * Step 2 of the slim wizard submits the picked tiles (zero-or-more). Empty
 * array is allowed (= "show me everything" maps to picking all five on the
 * client side before submission). Writes orgs.onboarding_use_cases,
 * stamps profiles.onboarded_at, redirects to /dashboard?welcome=1.
 */
export async function finishOnboardingWithUseCases(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // FormData carries multi-value 'use_cases' entries.
  const raw = fd.getAll("use_cases").map(String);
  const parsed = finishSchema.safeParse({ use_cases: raw });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (profErr || !profile) return { ok: false, error: profErr?.message ?? "Profile missing" };

  const { error: updErr } = await supabase
    .from("orgs")
    .update({ onboarding_use_cases: parsed.data.use_cases })
    .eq("id", profile.org_id);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/dashboard?welcome=1");
}
```

- [ ] **Step 5.3 — Rewrite `app/(onboarding)/onboarding/onboarding-wizard.tsx`**

Replace the file:

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { bootstrapOrg, finishOnboardingWithUseCases } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/incidents/schemas";
import { cn } from "@/lib/utils";
import { USE_CASE_KEYS, type UseCaseKey } from "@/lib/get-started/use-cases";
import { UseCaseTiles } from "@/components/get-started/use-case-tiles";

type StepKey = "org" | "use_cases";

const INDUSTRIES = [
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "warehouse", label: "Warehouse / Logistics" },
  { value: "office", label: "Office" },
  { value: "construction", label: "Construction" },
  { value: "lab", label: "Lab / R&D" },
] as const;

const TIMEZONE_HINTS = [
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "UTC", label: "UTC" },
];

const STEP_ORDER: StepKey[] = ["org", "use_cases"];
const STEP_LABELS: Record<StepKey, string> = {
  org: "Workspace",
  use_cases: "Use-cases",
};

export function OnboardingWizard({
  email,
  fullName,
  initialStep,
  defaultOrgName,
}: {
  email: string;
  fullName: string;
  initialStep: StepKey;
  defaultOrgName: string | null;
}) {
  const [step, setStep] = useState<StepKey>(initialStep);

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}
        </p>
        <h1 className="text-2xl font-semibold">Set up your workspace</h1>
        <p className="text-sm text-muted-foreground">
          Two quick steps and you&apos;re ready to start.
        </p>
      </header>

      <ProgressBar current={step} />

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {step === "org" ? (
          <OrgAndSiteStep
            defaultOrgName={defaultOrgName}
            onSuccess={() => setStep("use_cases")}
          />
        ) : (
          <UseCasesStep />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Signed in as <span className="font-medium">{email}</span>
      </p>
    </div>
  );
}

function ProgressBar({ current }: { current: StepKey }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <ol
      className="flex items-center gap-2"
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuenow={currentIdx + 1}
      aria-valuemin={1}
      aria-valuemax={STEP_ORDER.length}
      aria-valuetext={`Step ${currentIdx + 1} of ${STEP_ORDER.length} · ${STEP_LABELS[current]}`}
    >
      {STEP_ORDER.map((key, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <li
            key={key}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              isDone && "bg-success",
              isCurrent && !isDone && "bg-primary",
              !isCurrent && !isDone && "bg-muted",
            )}
            aria-current={isCurrent ? "step" : undefined}
          />
        );
      })}
    </ol>
  );
}

function OrgAndSiteStep({
  defaultOrgName,
  onSuccess,
}: {
  defaultOrgName: string | null;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ siteId: string }> | null,
    FormData
  >(bootstrapOrg, null);

  useEffect(() => {
    if (state?.ok && state.data?.siteId) {
      toast.success("Workspace created");
      onSuccess();
    }
    if (state && state.ok === false && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Organization</legend>
        <div className="space-y-1.5">
          <Label htmlFor="org_name" className="text-xs">Organization name</Label>
          <Input id="org_name" name="org_name" placeholder="Acme Safety"
                 defaultValue={defaultOrgName ?? ""} required
                 aria-invalid={!!fieldErr("org_name")} />
          {fieldErr("org_name") && <p className="text-xs text-destructive">{fieldErr("org_name")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry" className="text-xs">Industry</Label>
          <Select name="industry" required defaultValue="manufacturing">
            <SelectTrigger id="industry"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-5">
        <legend className="text-sm font-semibold">First site</legend>
        <div className="space-y-1.5">
          <Label htmlFor="site_name" className="text-xs">Site name</Label>
          <Input id="site_name" name="site_name" placeholder="Acme HQ" required
                 aria-invalid={!!fieldErr("site_name")} />
          {fieldErr("site_name") && <p className="text-xs text-destructive">{fieldErr("site_name")}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="country" className="text-xs">Country</Label>
            <Select name="country" required defaultValue="US">
              <SelectTrigger id="country"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States (OSHA)</SelectItem>
                <SelectItem value="GB">United Kingdom (HSE / RIDDOR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-xs">Time zone</Label>
            <Select name="timezone" required defaultValue="America/Chicago">
              <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_HINTS.map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Creating workspace…</>
        ) : (
          <>Next <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></>
        )}
      </Button>
    </form>
  );
}

function UseCasesStep() {
  const [selected, setSelected] = useState<Set<UseCaseKey>>(new Set());
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    finishOnboardingWithUseCases,
    null,
  );

  useEffect(() => {
    if (state && state.ok === false) toast.error(state.error);
  }, [state]);

  function toggle(k: UseCaseKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-base font-semibold">What will you mostly use this for?</h2>
        <p className="text-xs text-muted-foreground">
          Pick one or more — we&apos;ll tailor your Get Started checklist. You can change this later.
        </p>
      </div>

      <UseCaseTiles selected={selected} onToggle={toggle} />

      {/* Multi-value 'use_cases' entries — server reads via fd.getAll('use_cases'). */}
      {Array.from(selected).map((k) => (
        <input key={k} type="hidden" name="use_cases" value={k} />
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setSelected(new Set(USE_CASE_KEYS))}
        >
          I&apos;m not sure yet — show me everything
        </button>
        <Button type="submit" disabled={pending} className="sm:min-w-[180px]">
          {pending ? "Taking you in…" : <>Take me in <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></>}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5.4 — Update `app/(onboarding)/onboarding/page.tsx`**

Drop the `site_members` lookup (it was only there to resume the dropped Invite step). Compute `initialStep` from whether the org has any sites yet — if it does, the user finished step 1 and we resume on step 2.

```tsx
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const { user } = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarded_at) redirect("/dashboard");

  const meta = user.user_metadata as { full_name?: string; org_name?: string } | undefined;

  // Profile + site exist → user finished step 1, resume on step 2.
  let initialStep: "org" | "use_cases" = "org";
  if (profile) {
    const { data: membership } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membership) initialStep = "use_cases";
  }

  return (
    <OnboardingWizard
      email={user.email ?? ""}
      fullName={profile?.full_name ?? meta?.full_name ?? ""}
      initialStep={initialStep}
      defaultOrgName={meta?.org_name ?? null}
    />
  );
}
```

- [ ] **Step 5.5 — Verify build + smoke test**

```bash
pnpm lint && pnpm typecheck
```

Then manually: sign up a fresh user (or wipe `profiles` + `orgs` rows for an existing test account), confirm the 2-step flow ends at `/dashboard?welcome=1`, and check `select onboarding_use_cases from orgs where id = '<your org>';` shows the picked tiles.

- [ ] **Step 5.6 — Commit**

```bash
git add app/\(onboarding\)/onboarding/ components/get-started/use-case-tiles.tsx
git commit -m "feat(phase18): slim onboarding to 2 steps + capture use-case intent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — /get-started page + actions

**Files:**
- Create: `app/(app)/get-started/page.tsx`
- Create: `app/(app)/get-started/actions.ts`
- Create: `app/(app)/get-started/edit-use-cases-modal.tsx`
- Create: `components/get-started/checklist-row.tsx`
- Create: `components/get-started/show-dismissed-toggle.tsx`

- [ ] **Step 6.1 — Create the route directory under the `(app)` group**

`/get-started` lives inside the same shell as `/dashboard`. Nest the new route under the existing `(app)` group so it inherits `app/(app)/layout.tsx` (sidebar + topbar) with zero duplication:

```bash
mkdir -p "app/(app)/get-started"
```

All files below are created under `app/(app)/get-started/`. No new layout file is needed — the parent `(app)` layout already wraps the page.

- [ ] **Step 6.2 — Write `components/get-started/checklist-row.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissItem, undismissItem } from "@/app/(app)/get-started/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ChecklistRowState } from "@/lib/get-started/state";

export function ChecklistRow({ row, allowDismiss }: { row: ChecklistRowState; allowDismiss: boolean }) {
  const [pending, startTransition] = useTransition();
  const { item, done, dismissed } = row;
  const isInfoOnly = item.ctaHref === null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-t border-border/60 px-3.5 py-3 first:border-t-0",
        row.counted ? "bg-card" : "bg-card/60",
        !row.counted && "hover:bg-accent/30"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
          done ? "bg-success text-white" :
          dismissed ? "bg-muted text-muted-foreground" :
          "border-2 border-border"
        )}
      >
        {done && <Check className="h-3 w-3" />}
        {!done && dismissed && <X className="h-3 w-3" />}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-medium",
            (done || dismissed) && "text-muted-foreground line-through"
          )}
        >
          {item.label}
        </div>
        {item.description && (
          <div className="text-xs text-muted-foreground">{item.description}</div>
        )}
      </div>

      {!isInfoOnly && !done && !dismissed && (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
        >
          <Link href={item.ctaHref!}>{item.ctaLabel || "Open"} →</Link>
        </Button>
      )}

      {allowDismiss && !done && !dismissed && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await dismissItem(item.id);
              if (!res.ok) toast.error(res.error);
            })
          }
        >
          Dismiss
        </Button>
      )}

      {allowDismiss && dismissed && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await undismissItem(item.id);
              if (!res.ok) toast.error(res.error);
            })
          }
        >
          Un-dismiss
        </Button>
      )}
    </li>
  );
}
```

- [ ] **Step 6.3 — Write `components/get-started/show-dismissed-toggle.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistRowState } from "@/lib/get-started/state";
import { ChecklistRow } from "./checklist-row";

export function ShowDismissedToggle({ rows }: { rows: ChecklistRowState[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {open ? "Hide" : "Show"} {rows.length} dismissed item{rows.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="mt-2 overflow-hidden rounded-md border bg-card">
          {rows.map((row) => (
            <ChecklistRow key={row.item.id} row={row} allowDismiss />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6.4 — Write `app/(app)/get-started/actions.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgPermission } from "@/lib/auth/orgCan";
import { requireUser } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";
import { getItemById } from "@/lib/get-started/items";
import { USE_CASE_KEYS, type UseCaseKey } from "@/lib/get-started/use-cases";

async function loadOrgArray(
  column: "onboarding_use_cases" | "onboarding_dismissed",
  orgId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orgs")
    .select(column)
    .eq("id", orgId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Org not found");
  return ((data as Record<string, string[] | null>)[column] ?? []) as string[];
}

export async function dismissItem(itemId: string): Promise<ActionResult> {
  await requireOrgPermission("org:configure");
  if (!getItemById(itemId)) return { ok: false, error: "Unknown item" };

  const { profile } = await requireUser();
  const current = await loadOrgArray("onboarding_dismissed", profile.org_id);
  if (current.includes(itemId)) {
    return { ok: true, data: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({ onboarding_dismissed: [...current, itemId] })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/get-started");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function undismissItem(itemId: string): Promise<ActionResult> {
  await requireOrgPermission("org:configure");
  if (!getItemById(itemId)) return { ok: false, error: "Unknown item" };

  const { profile } = await requireUser();
  const current = await loadOrgArray("onboarding_dismissed", profile.org_id);
  if (!current.includes(itemId)) {
    return { ok: true, data: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({ onboarding_dismissed: current.filter((id) => id !== itemId) })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/get-started");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

const updateUseCasesSchema = z.object({
  use_cases: z
    .array(z.enum(USE_CASE_KEYS as unknown as [UseCaseKey, ...UseCaseKey[]]))
    .max(USE_CASE_KEYS.length),
});

export async function updateUseCases(useCases: UseCaseKey[]): Promise<ActionResult> {
  await requireOrgPermission("org:configure");
  const parsed = updateUseCasesSchema.safeParse({ use_cases: useCases });
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  const { profile } = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({ onboarding_use_cases: parsed.data.use_cases })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/get-started");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
```

- [ ] **Step 6.5 — Write `app/(app)/get-started/edit-use-cases-modal.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UseCaseTiles } from "@/components/get-started/use-case-tiles";
import { updateUseCases } from "./actions";
import { toast } from "sonner";
import type { UseCaseKey } from "@/lib/get-started/use-cases";

export function EditUseCasesModal({
  initialSelected,
  openByDefault,
}: {
  initialSelected: UseCaseKey[];
  openByDefault: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);
  const [selected, setSelected] = useState<Set<UseCaseKey>>(new Set(initialSelected));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(k: UseCaseKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await updateUseCases(Array.from(selected));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Updated");
      setOpen(false);
      // Strip the ?edit=use-cases query parameter without a full nav.
      router.replace("/get-started");
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change what you use
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>What do you mostly use this for?</DialogTitle>
            <DialogDescription>
              Pick one or more. We&apos;ll add or remove the matching sections on your Get Started checklist.
            </DialogDescription>
          </DialogHeader>
          <UseCaseTiles selected={selected} onToggle={toggle} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 6.6 — Write `app/(app)/get-started/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { getChecklistState } from "@/lib/get-started/state";
import { ChecklistRow } from "@/components/get-started/checklist-row";
import { ShowDismissedToggle } from "@/components/get-started/show-dismissed-toggle";
import { EditUseCasesModal } from "./edit-use-cases-modal";

type Search = Promise<{ edit?: string; open?: string }>;

export default async function GetStartedPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  if (!(await orgCan("org:configure"))) {
    redirect("/dashboard");
  }
  const { profile } = await requireUser();
  const state = await getChecklistState({ orgId: profile.org_id, userId: profile.id });

  const pct = state.totalCount === 0 ? 100 : Math.round((state.doneCount / state.totalCount) * 100);
  const complete = state.doneCount >= state.totalCount && state.totalCount > 0;

  const visibleSections = state.sections.map((s) => ({
    ...s,
    visibleRows: s.rows.filter((r) => !r.dismissed),
  }));
  const dismissedRows = state.sections.flatMap((s) => s.rows.filter((r) => r.dismissed));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Get started</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {complete ? "You’re all set" : "Finish setting up your workspace"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {complete
                ? "Every Get Started item is done or dismissed. The dashboard widget has hidden itself — this page stays here if you want to revisit."
                : "Auto-detected as you go. Dismiss anything that doesn’t apply."}
            </p>
          </div>
          <EditUseCasesModal initialSelected={state.useCases} openByDefault={sp.edit === "use-cases"} />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={state.doneCount}
              aria-valuemin={0}
              aria-valuemax={state.totalCount}
            />
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {state.doneCount} of {state.totalCount} done
          </span>
        </div>
      </header>

      {complete ? (
        <section className="rounded-lg border bg-card p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">Setup complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Head back to your dashboard or explore Argus if you haven&apos;t already.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        visibleSections.map((section) => (
          section.visibleRows.length === 0 ? null : (
            <section key={section.key}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {section.label}
              </h2>
              <ul className="overflow-hidden rounded-lg border bg-card">
                {section.visibleRows.map((row) => (
                  <ChecklistRow key={row.item.id} row={row} allowDismiss />
                ))}
              </ul>
            </section>
          )
        ))
      )}

      <ShowDismissedToggle rows={dismissedRows} />
    </div>
  );
}
```

- [ ] **Step 6.7 — Verify the page renders**

```bash
pnpm dev
```

Then visit `http://localhost:3000/get-started` as a site_admin. Confirm:
- Workspace section appears with pre-checked org/site/use-cases rows.
- Per-use-case sections appear only for picked tiles.
- `?edit=use-cases` opens the modal automatically.
- Dismiss buttons work; "Show dismissed" toggle reveals them; un-dismiss restores.
- Sign in as a worker → redirected to `/dashboard`.

- [ ] **Step 6.8 — Commit**

```bash
git add app/\(app\)/get-started/ components/get-started/checklist-row.tsx components/get-started/show-dismissed-toggle.tsx
git commit -m "feat(phase18): ship /get-started page + dismiss/undismiss/updateUseCases actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — Dashboard widget

**Files:**
- Create: `components/get-started/dashboard-widget.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 7.1 — Write the widget**

```tsx
// components/get-started/dashboard-widget.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChecklistRowState } from "@/lib/get-started/state";

export function GetStartedWidget({
  rows,
  doneCount,
  totalCount,
}: {
  rows: ChecklistRowState[];   // pre-filtered: not done, not dismissed, with CTA — up to 3
  doneCount: number;
  totalCount: number;
}) {
  const pct = totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100);
  return (
    <section
      aria-labelledby="get-started-heading"
      className="rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="get-started-heading" className="text-sm font-semibold">
          Get started · {doneCount} of {totalCount} done
        </h2>
        <Link
          href="/get-started"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.item.id}>
            <Link
              href={row.item.ctaHref!}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/40"
            >
              <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2 border-border" />
              <span className="flex-1 truncate font-medium">{row.item.label}</span>
              <span className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
                {row.item.ctaLabel || "Open"} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 7.2 — Mount in `app/(app)/dashboard/page.tsx`**

At the top of the page-render function, after `requireUser()` resolves, fetch the checklist state in parallel with the existing reads. Then render the widget below the yellow banner and above the heading block.

Add the imports:

```ts
import { getChecklistState, pickNextItems } from "@/lib/get-started/state";
import { GetStartedWidget } from "@/components/get-started/dashboard-widget";
import { orgCan } from "@/lib/auth/orgCan";
```

Inside the page function, parallelise the checklist fetch:

```ts
const [
  argusAvailable,
  canInvestigationRead,
  canCapaRead,
  canReportRead,
  overdueInvPayload,
  stopWorkPayload,
  reportabilityPayload,
  capaOverduePayload,
  isOrgAdmin,
  checklistState,
] = await Promise.all([
  isArgusAvailable(profile.org_id),
  currentSiteId ? can("investigation:lead", currentSiteId) : Promise.resolve(false),
  currentSiteId ? can("capa:complete", currentSiteId) : Promise.resolve(false),
  currentSiteId ? can("report:read", currentSiteId) : Promise.resolve(false),
  getOverdueInvestigationsTilePayload(supabase, currentSiteId),
  getStopWorkActiveTilePayload(supabase, currentSiteId),
  getReportabilityUncertainTilePayload(supabase, currentSiteId),
  getCapaOverdueTilePayload(supabase, currentSiteId),
  orgCan("org:configure"),
  getChecklistState({ orgId: profile.org_id, userId: profile.id }),
]);

const showGetStartedWidget =
  isOrgAdmin && checklistState.doneCount < checklistState.totalCount;
const nextItems = showGetStartedWidget ? pickNextItems(checklistState, 3) : [];
```

Render the widget between the yellow banner and the heading block:

```tsx
{setupIncompleteSiteName && (
  /* existing banner ... */
)}

{showGetStartedWidget && (
  <GetStartedWidget
    rows={nextItems}
    doneCount={checklistState.doneCount}
    totalCount={checklistState.totalCount}
  />
)}

<div className="flex flex-wrap items-end justify-between gap-3">
  {/* existing "Hi, {firstName}" + Report Incident button */}
</div>
```

- [ ] **Step 7.3 — Smoke-test**

Sign in as site_admin on a partially-set-up demo org. Confirm:
- Widget appears between banner and greeting.
- Shows 3 rows, the leftmost still-open items.
- Hover surfaces the CTA on the right.
- Clicking a row navigates to its href.
- Dismiss an item via `/get-started` → re-load `/dashboard` → next item slides up into the third slot.

- [ ] **Step 7.4 — Commit**

```bash
git add components/get-started/dashboard-widget.tsx app/\(app\)/dashboard/page.tsx
git commit -m "feat(phase18): mount Get Started widget on dashboard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 — Sidebar progress chip

**Files:**
- Create: `components/get-started/sidebar-get-started-chip.tsx`
- Modify: `components/app-shell/app-sidebar.tsx`

The sidebar is collapsible (`collapsible="icon"`). The chip needs an expanded shape (label + count + bar) and a collapsed icon-only shape (32px tile with a circular progress ring). Both states use `group-data-[collapsible=icon]:` Tailwind selectors that the rest of the sidebar already uses.

- [ ] **Step 8.1 — Write the chip**

```tsx
// components/get-started/sidebar-get-started-chip.tsx
"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SidebarGetStartedChip({
  doneCount,
  totalCount,
}: {
  doneCount: number;
  totalCount: number;
}) {
  if (totalCount === 0 || doneCount >= totalCount) return null;

  const pct = Math.round((doneCount / totalCount) * 100);
  // Circumference for the collapsed ring (r=10 → C ≈ 62.83).
  const r = 10;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/get-started"
          aria-label={`Get started — ${doneCount} of ${totalCount} done`}
          className={cn(
            "group/get-started flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 transition-colors hover:bg-accent/40",
            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
          )}
        >
          {/* Collapsed: circular ring */}
          <span
            className={cn(
              "relative grid h-7 w-7 place-items-center",
              "group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
            )}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="12" cy="12" r={r} className="fill-none stroke-muted" strokeWidth="2.5" />
              <circle
                cx="12"
                cy="12"
                r={r}
                className="fill-none stroke-primary"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c - dash}`}
              />
            </svg>
            <Sparkles className="relative h-3.5 w-3.5 text-primary" />
          </span>

          {/* Expanded: label + counter + bar */}
          <span className="flex flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <span className="flex items-center justify-between text-xs">
              <span className="font-semibold">Get started</span>
              <span className="font-medium text-primary">{doneCount}/{totalCount}</span>
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
            </span>
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="group-data-[collapsible=icon]/sidebar-wrapper:block hidden">
        Get started · {doneCount}/{totalCount}
      </TooltipContent>
    </Tooltip>
  );
}
```

> The `group-data-[collapsible=icon]/sidebar-wrapper:block hidden` on `TooltipContent` is a defensive guard — show the tooltip only when the sidebar is collapsed. When expanded the chip already shows the same info inline. If the selector doesn't take, simplify to always-show — the cost is one redundant tooltip in expanded mode.

- [ ] **Step 8.2 — Fetch the counts in `app/(app)/layout.tsx` and pass to `AppSidebar`**

The sidebar is rendered from the (app) layout. Read `app/(app)/layout.tsx`, find where `AppSidebar` is mounted, and:

1. After the existing `requireUser()` / permissions resolve, call:

   ```ts
   const isOrgAdmin = await orgCan("org:configure");
   const checklist = isOrgAdmin
     ? await getChecklistState({ orgId: profile.org_id, userId: profile.id })
     : null;
   ```

2. Pass `getStartedCounts={checklist ? { done: checklist.doneCount, total: checklist.totalCount } : null}` to `<AppSidebar>`.

- [ ] **Step 8.3 — Mount the chip in `components/app-shell/app-sidebar.tsx`**

Add the prop type and render the chip inside `<SidebarFooter>` directly above the existing user-info block. The footer also needs to drop the `group-data-[collapsible=icon]:hidden` class on its outer container so the chip's collapsed-mode ring is still visible — but keep the user-info block hidden in icon mode (apply `group-data-[collapsible=icon]:hidden` directly on the inner user-info `<div>`).

```tsx
import { SidebarGetStartedChip } from "@/components/get-started/sidebar-get-started-chip";

export function AppSidebar({
  /* existing props */
  getStartedCounts,
}: {
  /* existing props */
  getStartedCounts: { done: number; total: number } | null;
}) {
  // ...
  return (
    <Sidebar /* ... */>
      {/* existing SidebarHeader + SidebarContent */}
      <SidebarFooter className="space-y-2 px-3 py-3">
        {getStartedCounts && (
          <SidebarGetStartedChip
            doneCount={getStartedCounts.done}
            totalCount={getStartedCounts.total}
          />
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <ShieldCheck className="h-3.5 w-3.5" />
          <div className="flex flex-col leading-tight">
            <span className="font-medium text-foreground">{userLabel}</span>
            <span>{roleLabel}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 8.4 — Smoke-test**

Toggle the pin button — chip should switch between expanded (label + bar) and the 32px ring. Hover the collapsed ring → tooltip reads `Get started · 3/7`. Sign in as a worker → no chip, no widget.

- [ ] **Step 8.5 — Commit**

```bash
git add components/get-started/sidebar-get-started-chip.tsx components/app-shell/app-sidebar.tsx app/\(app\)/layout.tsx
git commit -m "feat(phase18): mount Get Started progress chip in sidebar footer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 — SPEC delta

**Files:**
- Modify: `docs/SPEC.md`

- [ ] **Step 9.1 — Add the §15 entry**

Open `docs/SPEC.md`, locate the §15 decisions log, and append a new dated entry at the top of the entries:

```markdown
**2026-05-12 — Onboarding slimmed + Get Started checklist added (Phase 18, PR #N).**

The onboarding wizard collapses from 3 steps to 2: workspace basics (unchanged) + a multi-select use-case picker. The Invite-teammates step is dropped from the wizard and reappears as the Get Started item `team_invited` linking to /admin/members. A new /get-started page replaces the bottom-of-dashboard `RoleWelcomeCard` for admins — a sectioned checklist auto-detected from existing tables, with per-org dismiss support. The dashboard mounts a compact 3-up `<GetStartedWidget>` above the KPI strip; the sidebar footer mounts a `<SidebarGetStartedChip>` with a circular-ring collapsed state. Audience: `org:configure` only (Phase 17). Workers + supervisors keep today's role welcome cards. See §UI-GETSTARTED for the locked use-case keys and item set.
```

- [ ] **Step 9.2 — Add the §UI-GETSTARTED subsection**

Append the subsection near §UI-SETTINGS-IA:

```markdown
## §UI-GETSTARTED — Get Started checklist

### Use-case keys (stable, persisted in `orgs.onboarding_use_cases text[]`)

| Key | Tile label | Modules behind it |
|---|---|---|
| `incidents` | Report & investigate incidents | Incidents, Investigations, CAPA, Reports |
| `inspections` | Run inspections | Templates, Inspections |
| `hazards_jsa` | Manage hazards & JSA | Hazards, JSA, Bulletins, SDS |
| `assets_documents` | Track assets & documents | Resources (Assets + Documents) |
| `planner` | Schedule recurring work | Planner |

Empty array = silent state (no use-case sections shown). The wizard's "show me everything" link selects all 5.

### Master item set

Items have stable string ids — never repurposed once shipped. Adding a new tile or section is additive; new entries land at the end of the catalog. Dismissal is per-org (`orgs.onboarding_dismissed text[]`), not per-user.

| Section | Item id | Predicate (all org-scoped) | CTA |
|---|---|---|---|
| workspace | `org_created` | always true | (info only) |
| workspace | `first_site_added` | always true | (info only) |
| workspace | `use_cases_picked` | `orgs.onboarding_use_cases <> '{}'` | `/get-started?edit=use-cases` |
| workspace | `site_setup_finished` | every site in the org has `setup_completed_at IS NOT NULL` | `/admin/site-setup` |
| workspace | `team_invited` | ≥1 distinct non-creator profile_id on `site_members` across any site in the org | `/admin/members` |
| workspace | `sidebar_customized` | `profiles.sidebar_hidden_items` non-empty (per-user predicate) | `/settings/sidebar` |
| incidents | `first_incident_reported` | ≥1 non-sandbox `incidents` row (deleted_at NULL) | `/incidents/new/1` |
| incidents | `first_investigation_run` | ≥1 `investigations` row with `root_cause_finalized_at IS NOT NULL` | `/investigations` |
| inspections | `first_template_built` | ≥1 `templates` row scoped to the org | `/templates/new` |
| inspections | `first_inspection_run` | ≥1 `inspections` row with `completed_at IS NOT NULL` | `/inspections` |
| hazards_jsa | `first_hazard_added` | ≥1 `hazards` row in the org | `/hazards/new` |
| hazards_jsa | `first_jsa_created` | ≥1 `jsas` row in the org | `/jsa/new` |
| assets_documents | `first_asset_added` | ≥1 `assets` row in the org | `/resources/assets/new` |
| assets_documents | `first_document_uploaded` | ≥1 non-archived `documents` row in the org | `/resources/documents` |
| planner | `first_planner_entry` | ≥1 active `template_assignments` row across any site in the org | `/templates` |
| power_up | `argus_intro_seen` | ≥1 `argus_suggestions` row by this user in the org (gated on `orgs.argus_enabled`) | `/get-started?open=argus` |

### Counter semantics

- **Numerator** = items where the predicate is true OR the item id is in `orgs.onboarding_dismissed`.
- **Denominator** = items in `workspace` + items in picked use-case sections + the Argus item if `orgs.argus_enabled = true`.

### 100% behavior

When `numerator >= denominator`:
- `<GetStartedWidget>` on `/dashboard` hides.
- `<SidebarGetStartedChip>` hides.
- `/get-started` renders the celebration state (centered card with a `Go to dashboard` CTA).

### Audience

- Render: `orgCan('org:configure')` only. Workers + supervisors never see the widget, chip, or page (route guard on `/get-started` redirects to `/dashboard`).
- Mutate (dismiss / undismiss / updateUseCases): same `org:configure` guard inside each server action.
```

- [ ] **Step 9.3 — Commit**

```bash
git add docs/SPEC.md
git commit -m "docs(phase18): SPEC §15 entry + §UI-GETSTARTED subsection

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10 — Manual QA + PR

- [ ] **Step 10.1 — Manual QA checklist**

Fresh org via signup:
- 2-step wizard ends at `/dashboard?welcome=1`.
- Yellow site-setup banner is present (existing behavior).
- `<GetStartedWidget>` is present below the banner with 3 next items.
- Sidebar chip shows in expanded + collapsed states.

`/get-started` as site_admin:
- Workspace section pre-checked: org_created, first_site_added, use_cases_picked.
- Per-use-case sections present only for picked tiles.
- Dismiss an item → row moves to "Show dismissed" toggle at the bottom + numerator advances.
- Un-dismiss restores.
- `Change what you use` modal saves correctly; new sections appear / disappear on close.
- Dismiss every remaining item → page flips to celebration state; widget + chip disappear on dashboard.

Existing demo org (post-backfill):
- `select onboarding_use_cases from orgs` shows correct inference from real activity.
- Dashboard widget shows whatever items are still genuinely undone.

RBAC:
- Sign in as worker → `/dashboard` shows the existing `WorkerWelcomeCard`. `/get-started` redirects.
- Sign in as supervisor → same.

- [ ] **Step 10.2 — Push and open PR**

```bash
git push -u origin feat/onboarding-get-started

gh pr create --title "feat: onboarding + Get Started redesign (phase 18)" --body "$(cat <<'EOF'
## Summary

- Slim onboarding wizard from 3 steps to 2 — workspace basics + use-case multi-select. Invite step drops; reappears as a Get Started checklist item.
- Add `/get-started` sectioned checklist with auto-detected completion + per-org dismiss. Three new server actions (`dismissItem` · `undismissItem` · `updateUseCases`), all gated on `org:configure`.
- New `<GetStartedWidget>` on `/dashboard` (compact 3-up preview) and `<SidebarGetStartedChip>` in the sidebar footer (expanded + collapsed icon-only ring). Both hide at 100%.

## Changes
- Migration `20260525120000_phase18_onboarding_get_started.sql` adds `orgs.onboarding_use_cases` + `onboarding_dismissed` + backfills existing orgs from real activity.
- New `lib/get-started/` slice (`use-cases.ts` · `sections.ts` · `items.ts` · `state.ts`).
- Onboarding wizard rewritten in place; `inviteOnOnboarding` server action removed; new `finishOnboardingWithUseCases` action.
- SPEC §15 entry + new §UI-GETSTARTED subsection lock the use-case keys, item set, counter semantics, and 100% behavior.

## Test Plan
- [ ] Fresh signup completes 2-step wizard → lands on `/dashboard?welcome=1` with widget visible.
- [ ] `select onboarding_use_cases from orgs where id = <demo>` returns the picked tiles.
- [ ] Dismiss / un-dismiss / `Change what you use` modal all work; counter updates.
- [ ] Dashboard widget shows 3 next non-done, non-dismissed items in display order.
- [ ] Sidebar chip toggles between expanded chip and collapsed circular ring.
- [ ] Worker + supervisor sign-in shows no widget, no chip, and `/get-started` redirects.
- [ ] At 100% all three surfaces (widget, chip, page) flip to their done states.

## Screenshots
<onboarding step 2, dashboard widget, sidebar chip expanded + collapsed, /get-started page sectioned + celebration>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10.3 — Append a `docs/BUILD_STATUS.md` entry on merge**

After PR merges and squashes, append the standard per-PR entry to `docs/BUILD_STATUS.md` — phase name, PR number + squash SHA, schema delta summary, surfaces shipped, locked decisions. Do **not** touch CLAUDE.md (`feedback_build_status_canonical_location` memory).

---

## Self-review

- Every spec section in `2026-05-12-onboarding-get-started-redesign-design.md` is covered by a task: wizard reshape (Task 5), data model + backfill (Task 1), use-case + section + item catalogs (Tasks 2-3), state engine (Task 4), `/get-started` page + actions + edit modal + dismiss-toggle (Task 6), dashboard widget (Task 7), sidebar chip (Task 8), SPEC delta (Task 9), QA + PR (Task 10).
- No `TODO` / `TBD` / "implement later" placeholders — every code block is paste-ready. The two open questions called out in the spec ("exact table/column names for backfill" and "every site vs at least one site") are resolved inline: backfill uses verified table names + columns (incidents.org_id, inspections.org_id, hazards.org_id, jsas.org_id, assets.org_id, documents.org_id, template_assignments via sites join), and `site_setup_finished` is "every site has `setup_completed_at`" per the verification predicate in Task 3.
- Names are consistent across tasks: `getChecklistState`, `pickNextItems`, `ChecklistRow`, `ChecklistRowState`, `ChecklistState`, `EditUseCasesModal`, `SidebarGetStartedChip`, `GetStartedWidget`, `UseCaseTiles`, `dismissItem`, `undismissItem`, `updateUseCases`, `finishOnboardingWithUseCases`.
- Type consistency: `ChecklistRowState` is defined in `lib/get-started/state.ts` and imported by `ChecklistRow`, `ShowDismissedToggle`, `GetStartedWidget`. `UseCaseKey` is defined once in `lib/get-started/use-cases.ts` and imported by the wizard, the actions, the modal, and the tiles.
