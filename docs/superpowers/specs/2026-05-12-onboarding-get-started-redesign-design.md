# Onboarding + Get Started — redesign

**Date:** 2026-05-12
**Status:** Brainstorming approved → ready for implementation plan
**Phase:** 18 (proposed)

## Goal

Replace the current 3-step onboarding + dashboard welcome cards with a slimmer 2-step wizard that captures use-case intent, plus a persistent **Get Started** checklist that lives on a dedicated page, surfaces as a compact widget on the dashboard, and shows a progress chip in the sidebar footer. The checklist auto-detects completion from existing tables (no separate state to keep in sync), tailors per-use-case items based on the wizard pick, and supports dismiss / un-dismiss.

## Non-goals (v1)

- Worker / supervisor-tailored checklists. Non-admins keep today's `WorkerWelcomeCard` / `RoleWelcomeCard`. Tailored lists may follow in a later phase.
- Per-user dismissal of items. Dismissal is per-org.
- Animation / confetti / tour overlays. Quiet, self-explanatory UI per the long-standing "no tour overlays" rule.
- Sample-data seeding. We do not pre-populate dummy incidents, templates, hazards, etc.

## Locked product decisions

| Decision | Choice |
|---|---|
| Wizard scope | Slim — org + site basics + use-case multi-select. Invite step dropped from wizard, becomes a Get Started item. |
| Module picker | Multi-select **use-case** tiles (5 tiles), not module names. Friendlier for non-EHS-fluent users. |
| Completion model | Hybrid — SQL auto-detect predicates per item, plus per-item dismiss stored on the org. |
| Audience | Admin-only (`org:configure` permission). Workers + supervisors are out of scope for v1. |
| Existing orgs | Backfill: infer use-cases from existing data; auto-detect progress; show whatever is genuine. |
| 100% behavior | Dashboard widget auto-hides at 100%. `/get-started` page stays reachable via sidebar chip (until that hides too) and renders a "You're all set" state. |
| Dashboard widget shape | Compact 3-up preview (progress bar + next 3 items + "View all"). Linear / Vercel / Intercom default. |
| Sidebar chip placement | Above the user-info footer, separated by border. Hides at 100%. Icon-only collapsed mode → 32px tile with circular progress ring. |
| Get Started page IA | Sectioned: **Set up your workspace** (always) + **Start using <X>** (per picked use-case) + **Power up** (Argus, if enabled). |
| Site-setup yellow banner | Kept. Coexists with the widget — banner is urgency-flavored, widget is checklist-flavored. |
| Un-dismiss | Yes — `Show N dismissed items` toggle at bottom of `/get-started` reveals dismissed items with an Un-dismiss action. |
| Edit use-cases later | Yes — `Change what you use` button on `/get-started` re-opens the multi-select tiles in a modal. |

## Use-case → module mapping

| Use-case key | Tile label | Modules behind it |
|---|---|---|
| `incidents` | Report & investigate incidents | Incidents, Investigations, CAPA, Reports |
| `inspections` | Run inspections | Templates, Inspections |
| `hazards_jsa` | Manage hazards & JSA | Hazards, JSA, Bulletins, SDS |
| `assets_documents` | Track assets & documents | Resources (Assets + Documents) |
| `planner` | Schedule recurring work | Planner |

"I'm not sure yet — show me everything" selects all 5.

## Master checklist

### Always shown — **Set up your workspace**

| Item id | Label | Auto-detect predicate | CTA |
|---|---|---|---|
| `org_created` | Create your organization | `true` (always, set at signup) | (info only) |
| `first_site_added` | Add your first site | `true` (always, set at signup) | (info only) |
| `use_cases_picked` | Pick your use-cases | `orgs.onboarding_use_cases != '{}'` | `/get-started?edit=use-cases` |
| `site_setup_finished` | Finish site setup (OSHA / RIDDOR detail) | every site has `setup_completed_at IS NOT NULL` | `/admin/site-setup` |
| `team_invited` | Invite your safety team | ≥1 non-creator membership on any site | `/admin/members` |
| `sidebar_customized` | Customize your sidebar | `profiles.sidebar_hidden_items` non-empty | `/settings/sidebar` |

### Per use-case (only when that tile was picked)

**`incidents`**
| Item id | Label | Predicate | CTA |
|---|---|---|---|
| `first_incident_reported` | Report your first incident | ≥1 non-sandbox incident in org | `/incidents/new/1` |
| `first_investigation_run` | Run an investigation | ≥1 investigation with a finalized 5-Why in org | (deep-link to most-recent investigation) |

**`inspections`**
| Item id | Label | Predicate | CTA |
|---|---|---|---|
| `first_template_built` | Build your first template | ≥1 published template in org | `/templates/new` |
| `first_inspection_run` | Run an inspection | ≥1 completed inspection in org | `/inspections/new` |

**`hazards_jsa`**
| Item id | Label | Predicate | CTA |
|---|---|---|---|
| `first_hazard_added` | Add a hazard to the register | ≥1 hazard in org | `/hazards/new` |
| `first_jsa_created` | Create your first JSA | ≥1 JSA in org | `/jsa/new` |

**`assets_documents`**
| Item id | Label | Predicate | CTA |
|---|---|---|---|
| `first_asset_added` | Add your first asset | ≥1 asset in org | `/resources/assets/new` |
| `first_document_uploaded` | Upload a document | ≥1 document in org | `/resources/documents` |

**`planner`**
| Item id | Label | Predicate | CTA |
|---|---|---|---|
| `first_planner_entry` | Schedule something | ≥1 planner entry in org | `/planner` |

### Power up — Argus (only when `orgs.argus_enabled = true`)

| Item id | Label | Predicate | CTA |
|---|---|---|---|
| `argus_intro_seen` | Meet Argus, your safety co-pilot | ≥1 `argus_suggestions` row by this user in the org | (opens Argus side-panel with guided intro) |

### Counters

- **Numerator** = items where the auto-detect predicate is true OR the item id is in `orgs.onboarding_dismissed`.
- **Denominator** = always-shown items (6) + items in picked use-case sections + Argus item if applicable. With all 5 use-cases + Argus enabled: 14 items. Typical with 2 use-cases: ~10.

## Data model

Single migration adds two columns to `orgs`:

```sql
ALTER TABLE orgs
  ADD COLUMN onboarding_use_cases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN onboarding_dismissed text[] NOT NULL DEFAULT '{}';
```

- `onboarding_use_cases` — chosen tile keys. Allowed: `'incidents'`, `'inspections'`, `'hazards_jsa'`, `'assets_documents'`, `'planner'`. Validation in the server action; no DB CHECK constraint (kept open for future tile additions without migration).
- `onboarding_dismissed` — checklist item ids the org has dismissed. Validation server-side against the known item catalog.

### Backfill (same migration)

Infer use-cases for existing orgs from real activity, so they don't see empty sections:

```sql
UPDATE orgs o SET onboarding_use_cases = ARRAY(
  SELECT v.uc FROM (VALUES
    ('incidents',        EXISTS(SELECT 1 FROM incidents WHERE org_id = o.id AND is_sandbox = false)),
    ('inspections',      EXISTS(SELECT 1 FROM inspections i JOIN sites s ON s.id = i.site_id WHERE s.org_id = o.id)),
    ('hazards_jsa',      EXISTS(SELECT 1 FROM hazards h JOIN sites s ON s.id = h.site_id WHERE s.org_id = o.id)),
    ('assets_documents', EXISTS(SELECT 1 FROM assets a JOIN sites s ON s.id = a.site_id WHERE s.org_id = o.id)),
    ('planner',          EXISTS(SELECT 1 FROM planner_entries pe JOIN sites s ON s.id = pe.site_id WHERE s.org_id = o.id))
  ) v(uc, has_it)
  WHERE v.has_it = true
);
```

The exact table / column names for each module must be verified during plan-writing by grepping the schema — names above are illustrative.

### RLS

Both new columns are on `orgs` and inherit the existing `orgs` RLS (read scoped to org members; write via SECURITY DEFINER through server actions).

## Routes

| Route | Status | Purpose |
|---|---|---|
| `/onboarding` | **Reshaped** | 2-step wizard. Step 1 unchanged (org + site basics). Step 2 is the new use-case multi-select. |
| `/get-started` | **New** | Full Get Started page (sectioned checklist, edit-use-cases modal, show-dismissed toggle, 100% celebration state). |
| `/dashboard` | **Modified** | New `<GetStartedWidget>` mounted above KPI strip for admins below 100%. Yellow site-setup banner stays. |

`/onboarding` finishing redirects to `/dashboard?welcome=1` as today.

## Code structure

```
lib/get-started/
  items.ts           — config array: every item with id, section, useCase?, label, description, ctaHref, predicate fn
  state.ts           — getChecklistState({ orgId, userId, currentSiteId }): reads orgs.onboarding_use_cases + dismissed, filters items, Promise.all of predicates, returns assembled { sections, doneCount, totalCount, dismissedCount }
  sections.ts        — section metadata (label, order) keyed by section id
  use-cases.ts       — the 5 use-case tile definitions (key, label, icon, description)

app/get-started/
  page.tsx           — RSC, sectioned list, edit-use-cases modal trigger, show-dismissed toggle, celebration state at 100%
  actions.ts         — server actions: dismissItem, undismissItem, updateUseCases; all gated on orgCan('org:configure')
  edit-use-cases-modal.tsx — client modal that re-renders the wizard's use-case tiles

components/get-started/
  dashboard-widget.tsx      — RSC, compact 3-up preview, mounted in /dashboard
  sidebar-chip.tsx          — client (uses sidebar collapse state), mounted in SidebarFooter
  checklist-row.tsx         — shared row primitive used on /get-started

app/(onboarding)/onboarding/
  onboarding-wizard.tsx     — modified: drop Invite step, add UseCasePickStep
  actions.ts                — modified: bootstrapOrg writes onboarding_use_cases on completion of step 2 (or a new finishOnboardingWithUseCases action)
```

### `lib/get-started/items.ts` shape

```ts
export type ChecklistItem = {
  id: string;                          // stable key, used in dismissed[]
  section: 'workspace' | 'incidents' | 'inspections' | 'hazards_jsa' | 'assets_documents' | 'planner' | 'power_up';
  useCase?: UseCaseKey;                // when set, item only shows if useCase is in onboarding_use_cases
  label: string;
  description?: string;
  ctaLabel: string;                    // e.g. "Continue", "Start", "Open"
  ctaHref: string | null;              // null = info-only row
  predicate: (ctx: PredicateCtx) => Promise<boolean>;
  requiresArgus?: boolean;             // hidden unless orgs.argus_enabled
};

type PredicateCtx = {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  currentSiteId: string | null;
};
```

### `getChecklistState` contract

```ts
type ChecklistState = {
  sections: Array<{
    id: SectionId;
    label: string;
    items: Array<{ item: ChecklistItem; done: boolean; dismissed: boolean }>;
  }>;
  doneCount: number;       // numerator (done OR dismissed)
  totalCount: number;      // denominator (visible items)
  rawDoneCount: number;    // genuine done (without dismissals) — used for analytics later
  dismissedCount: number;
};
```

## RBAC

- **View** widget / chip / `/get-started`: gated on `org:configure` (Phase 17 permission; granted to `site_admin` + `ehs_manager`).
- **Mutate** (`dismissItem`, `undismissItem`, `updateUseCases`): same `org:configure` check inside each server action.
- Non-admins see neither widget nor chip; route guard on `/get-started` redirects them to `/dashboard`.
- No new permission keys.

## Dashboard widget specifics

Mounted between the `setupIncompleteSiteName` banner and the heading block in `app/(app)/dashboard/page.tsx`. Renders only when both:

```ts
const showGetStartedWidget =
  await orgCan('org:configure') &&
  state.doneCount < state.totalCount;
```

Shape:
- Header: `Get started · {doneCount} of {totalCount} done` + `View all →` to `/get-started`
- 4px progress bar
- Up to 3 rows: first 3 items that are not done and not dismissed, in section order
- Each row: empty radio + label + chevron CTA (click = navigate to `item.ctaHref`)
- No dismiss affordance on the widget — dismiss lives only on `/get-started` to avoid accidental clicks on the smaller surface

## Sidebar chip specifics

New client component `<SidebarGetStartedChip>` rendered inside `<SidebarFooter>` in `components/app-shell/app-sidebar.tsx`, directly above the existing user-info block, separated by `border-t`. Renders only when `state.doneCount < state.totalCount` AND user has `org:configure`. Props: `{ doneCount, totalCount }` — fetched server-side in the layout and passed down.

Collapsed (icon-only) mode (`group-data-[collapsible=icon]:...`): swaps to a 32px square tile with a circular SVG progress ring around a `⊙` icon; tooltip on hover renders `Get started · 3/7`.

## Yellow site-setup banner

Unchanged. Both nudges coexist. The banner is conditional on `currentSite.setup_completed_at IS NULL` + `currentRoleKey === 'site_admin'`. The checklist item `site_setup_finished` covers the same nudge in a different shape.

## Onboarding wizard reshape — diff vs. today

| Step | Today | New |
|---|---|---|
| 1 | Org + site (`OrgAndSiteStep`) | **Same** |
| 2 | Invite teammates (`InviteStep`) | **Replaced** by `UseCasePickStep` (5 tiles, multi-select, "show me everything" link) |
| 3 | Done (`DoneStep` with "Go to dashboard") | **Dropped** — Step 2 submit calls a new `finishOnboardingWithUseCases` action that writes `onboarding_use_cases` and redirects to `/dashboard?welcome=1` |

The Invite teammates flow lives on as the `team_invited` Get Started item linking to `/admin/members`, which already has an invite form.

`bootstrap_org_v1` RPC is **not** modified — it stays site-scoped to step 1. The new server action `updateUseCases` does a plain `UPDATE orgs SET onboarding_use_cases = $1 WHERE id = $2` gated on `org:configure`.

## Edge cases

- **Mid-onboarding refresh.** If the user creates the org in step 1 but closes the tab before step 2: `profiles.onboarded_at` is still null, so the layout routes them back to `/onboarding`. The page already detects mid-flow (profile + first membership exist) and forces step 2 — same shape as today.
- **Existing orgs.** Backfill (see Data model § Backfill) fills `onboarding_use_cases` from real activity. `onboarding_dismissed` starts `'{}'`. Auto-detect ticks off everything genuinely done. The 100% case will hit immediately for mature orgs and the widget never shows.
- **All items dismissed.** Numerator can equal denominator via dismissals alone. The 100% state triggers the celebration screen the same way as genuine completion. Acceptable — user told us they didn't want the items.
- **`org:configure` revoked mid-life.** User loses widget + chip + page on next render. No data loss.
- **Multi-site orgs.** All counts and predicates scope to the **org**, not the current site. Two sites both completing site-setup ticks off `site_setup_finished` once; a single incomplete site keeps it open.
- **CTA route requires a site context.** Items like "Report your first incident" use `/incidents/new/1` which is site-scoped via the current site switcher. No extra wiring needed.
- **Argus not enabled.** `argus_intro_seen` is excluded from both numerator and denominator.

## Migration ordering

1. Add `onboarding_use_cases` + `onboarding_dismissed` columns with defaults.
2. Backfill existing orgs from activity.
3. Deploy code (RSC routes + actions + components).
4. New signups land on the reshaped wizard from the next request onward.

No data backfill is required for the dismissal column — empty default is correct.

## Open questions deferred to plan-writing

- Exact table / column names for the backfill predicates (need to grep each module's schema — e.g. confirm `incidents.org_id` vs `incidents` joining via `sites`).
- Whether `site_setup_finished` should be "every site has `setup_completed_at`" or "at least one site has it." Leaning every site, to match the banner's per-site nudge.
- Icon set for the use-case tiles — propose `AlertOctagon`, `ClipboardSignature`, `TriangleAlert`, `Boxes`, `CalendarDays` from `lucide-react` to mirror sidebar nav.
- Empty-state copy for the celebration screen.
