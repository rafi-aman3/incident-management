# Build Status — EHS Operations Platform

Phase-by-phase shipping log. Records what was shipped on each merged PR with enough detail for future-Claude to recall implementation patterns, fix recipes, locked decisions, and where bodies are buried.

For locked rules, tenancy, RBAC, tech stack, and the doc-reading order, see `CLAUDE.md`.

---

## Phase 0 — Foundation

Merged 2026-05-05 (PR #1).

## Phase 1 — Incidents capture

Merged 2026-05-06 (PR #2).

## Phase 2 — Investigations + CAPA + Reports

Merged 2026-05-06 (PR #3) — investigation Kanban + 5-tab detail (Summary / 5-Why / Evidence / Findings / Timeline) with witness-statement carryover, OSHA 301 sticky banner; CAPA list with KPI strip + 6 tabs; CAPA detail with 60/40 layout, progress slider auto-promoting `created → in_progress`, complete-confirm, reassign verifier; 4-outcome verification flow via `verify_capa_v1` RPC (incl. `partially_effective` auto-spawning a follow-up CAPA wired through `follow_up_capa_id`); URL-driven CAPA-create modal used by both `/capa?action=create` (standalone) and `/investigations/[id]?action=create-capa` (atomic via `assign_capa_from_investigation_v1`); Reports landing + OSHA 300 Log table + ITA-format CSV + OSHA 300A annual summary with `site_annual_hours` editor and live TRIR/DART/Severity Rate; OSHA 301 + RIDDOR F2508 per-incident pages with HSE notification record card; `@react-pdf` PDFs for 301 + F2508 (300/300A PDFs deferred to v2); daily-overdue + sandbox-cleanup Vercel Cron (twice-daily UTC, site-local-midnight bucket detection); `/admin/demo` affordances (reset / sample-load / trigger-banner) guarded by `orgs.is_demo`; supervisor / EHS-manager / site-admin role-aware welcome cards + context-driven verifier welcome card; Help drawer in topbar with role-aware shortcuts + FAQ; 9 new regulatory tooltips placed (17 total); notification bell with kind-aware icons + capa deep-links. Seed extended with `injured_persons` (driving recordable counts), `witnesses`, `site_annual_hours`, RCA whys, partial-effective CAPA chain, HSE record. Smoke-test guide at `docs/smoke-test-phase2.md`.

## Phase 3 — Templates + Inspections

Merged 2026-05-06 (PR #4) — Templates + Inspections *(Phases 3 + 4 collapsed 2026-05-06 — editor and inspection runner share rendering primitives, see `docs/SPEC.md` §15)*. Adopts the SafetyCulture-shaped data model from `/Users/rafiaman/Desktop/office-projects/workplace-safety-frontend` (flat items[] with `parent_id`, reusable `answer_sets`, separate `header[]` for title-page items) as JSONB on `template_versions`. Ships: 7 new tables (`templates`, `template_versions`, `template_assignments`, `inspections` with `template_version_id` snapshot, `inspection_uploads`, `inspection_findings`, `inspection_assignees`); 4 atomic RPCs (`publish_template_version_v1`, `import_preset_to_org_v1` with item-UUID regeneration preserving `parent_id` graph, `complete_inspection_v1` materializing findings on failed answers, `escalate_finding_to_incident_v1` creating draft incident); 13 new perm keys + `has_org_permission()` + `resolve_org_permissions()` for org-scoped checks; `inspection-uploads` Storage bucket with path-prefix RLS; `/templates` (imported list, industry-grouped), `/templates/browse` (system-preset library card grid like SafetyCulture's, 4 featured chips), `/templates/new` (blank create form), `/templates/[id]/edit` (3-column versioned builder — sidebar tree + canvas preview + options panel, 1s autosave-to-draft, ChangeSummaryDialog, 8 MVP item types editable: section/category/information/question/text/datetime/signature/media; 7 deferred types render as a yellow "Unsupported in v1" placeholder), `/templates/[id]` (read-only viewer with versions panel), `/templates/[id]/assign` (per-site or all-sites + schedule kind/cron/start_time_local, hierarchy-aware via include_children), `/inspections` (list with status filter + URL-driven Start picker), `/inspections/[id]` (dual-mode: mobile-first runner OR completed report, depending on status + viewer perms; photo + signature uploads to Supabase Storage; required-fields modal + flagged-items wizard before complete RPC), `/inspections/[id]/findings/[findingId]` (finding detail with Mark Resolved + Escalate-to-Incident → Phase 1 Report Wizard pre-fill chain). 14 system presets curated across all 7 industries from real SafetyCulture library payloads (4 featured); `scripts/seed.ts` extended (idempotent) to clone 2 into UCB, assign Forklift @ Houston (daily 06:00) + Ergonomic @ Manchester (weekly 09:00), simulate 1 in-progress + 1 completed inspection-with-finding so demo lands populated. Sidebar nav adds Templates + Inspections entries. 6 new RegTooltips placed (23 total). Smoke-test guide at `docs/smoke-test-phase3.md` with explicit snapshot-rule integration check. Plan: `plans/03-templates.md`. Phase numbering shifts: old Phase 5 Resources → new Phase 4; old Phase 6 Planner → new Phase 5.

## Phase 4 — Resources (Assets + Documents)

Merged 2026-05-06 (PR #5). Ships: 3 new tables (`assets`, `documents`, `document_links`) + `incidents.equipment_asset_id` sparse FK + `activity_events` extended with `asset_id` / `document_id` / `document_link_id` parent columns + `org_id_of_event` coalesce; 9 new perm keys (`asset:{read_site,create,edit,delete}`, `document:{read_org,upload,edit_metadata,archive}`, `document_link:{create,remove}`) replacing the legacy `asset:manage` placeholder; 4 atomic RPCs (`link_document_v1` idempotent + per-parent edit dispatch via `can_edit_parent`, `unlink_document_v1` soft-remove, `archive_document_v1` with `force` for active-link case, `replace_document_file_v1` overwrite-in-place); private `documents` storage bucket with `<org_id>/...` path-prefix RLS; `/resources/assets` (site-grouped table, filters site/kind/condition/q), `/resources/assets/new`+`[id]/edit` (shared form with `<DocumentSelectField>` for SDS pin), `/resources/assets/[id]` (4-tab detail — Overview / Incidents / Inspections / Documents — with `<AssetActions>` condition popover + Mark Inspected + unsafe-transition CTA wiring `/incidents/new/1?asset=...&type=unsafe_condition`); `/resources/documents` (card grid + table toggle, filters type/site/expiring), `/resources/documents/new` (upload form), `/resources/documents/[id]` (file preview via signed URL — PDF iframe / image inline / download fallback — with grouped link list across all 7 parent types and Replace/Edit/Archive header cluster). **Reusable `<DocumentLinkPicker>`** (two-tab modal: From library / Upload new) mounted in 5 contexts: wizard Step 2 attachments, `/incidents/[id]` Linked-library-documents card, `/investigations/[id]` Library-evidence panel, `/capa/[id]` Evidence & references card, asset detail Documents tab. **`<AssetTypeaheadField>`** combobox in wizard Step 2 for property_damage / unsafe_condition / dangerous_occurrence, persisting `incidents.equipment_asset_id`; incident detail surfaces a linked-Asset card. **Strategy: additive** — legacy `incident_attachments` and `investigation_evidence` tables stay; the picker writes only to `documents` + `document_links`. Both surface side-by-side on detail pages. Document Control deep features (versioning, approvals, e-signatures, forced ack, distribution audit-trail, SDS Manager API, asset PM cron) deferred to Phase 7 of IMS_PLANNING (v2). Sidebar nav adds Assets + Documents entries between Inspections and Reports. 4 new RegTooltips (asset_unsafe_condition, document_expiry_retention, library_link_reuse, sds_auto_attach_intent — 27 total). Seed extends with 8 documents (1 per type, training cert at +14d expiry exercises the ?expiring=1 filter), 6 assets (conveyor seeded `unsafe`), and cross-link backfill across incident / investigation / capa / asset / inspection. Smoke-test guide at `docs/smoke-test-phase4.md`. Plan: `plans/04-resources.md`.

## Phase 5 — Planner

Merged 2026-05-06 (PR #6). Read-only Month / Week / Day calendar at `/planner` aggregating 6 event sources (incident `occurred_at` · inspection `started_at` + `completed_at` · capa `due_date` · asset `next_pm_at` · investigation `due_date` · notification `deadline_at`); URL-driven filters by site + event type (verbose `?<kind>=0` shape — absence = enabled — so each chip self-documents in shared links). Click any chip jumps to its source record. App-level aggregator in `lib/planner/aggregate.ts` runs up to 6 parallel queries through existing per-table RLS, merged + sorted in TS, each fetcher swallowing its own error so one source failing never blanks the calendar; "All accessible sites" expands `include_children` memberships via in-app site-tree BFS. 1 new perm key (`planner:read`) + grants in `seed_default_roles()`; 2 new RegTooltips (`planner_aggregation_rule`, `planner_url_share` — 29 total). Postgres union view, drag-to-reschedule, event creation from planner, iCal export, conflict detection, recurring-inspection materialization, and team / user lanes all deferred to v2. No schema changes beyond the perm row. Plan: `plans/05-planner.md`. Smoke-test guide: `docs/smoke-test-phase5.md`.

**All 5 V1 modules shipped — Incidents · Templates · Inspections · Resources · Planner. V1 demo feature-complete.**

## Phase 6 — Frontend Polish (kickoff)

Kickoff 2026-05-06. Page-by-page audit + small-functional-gap pass across all 10 modules (35 routes), one PR per module under `feat/phase-6-<module>-polish` branched off `main`, sequenced by user-flow priority (Dashboard → Incidents → Investigations → CAPA → Reports → Templates → Inspections → Resources → Planner → Admin). Phase index + 10 per-module plans live at `plans/06-frontend-polish.md` + `plans/06a..j-*.md`.

## Phase 6a — Dashboard + Login + App-shell polish

Merged 2026-05-06 (PR #7). Surface fixes: KPI bug (Open + S1/S2 cards counted a 5-row slice, now true site-wide via `count: 'exact', head: true`); `trir_dart_formula` tooltip added to TRIR + DART KPIs; `firstName` DRY + email-prefix fallback (no more leaking the full email when full_name is null); recent-incidents empty state CTA; "no sites yet" empty card; sidebar version stamp `v0.1 · Phase 0` → `v1.0`; help-drawer footer `v0.2 · Phase 2` → `v1.0`; notification-bell "Mark resolved" Clock → Check icon; demo password no longer pre-filled in production; demo-chip click fills both fields; login error gets `role="alert"`. Topbar SiteSwitcher hardened: always interactive (chevron always shown), header reads "Your sites (N)", "Create new site" item at bottom (gated by `canCreateSite` mirroring the bootstrap rule).

**New feature shipped alongside (real, not just polish):** create-site flow at `/admin/sites/new` + `create_site_v1` security-definer RPC that gates on bootstrap (zero memberships in caller's org) OR existing site_admin in same org, inserts `sites` + auto-grants `site_admin` membership to caller, sets the `selected_site` cookie, redirects to `/dashboard?created=<name>`. Sonner success toast fires on dashboard via `<SiteCreatedToast />` reading `?created`. Dashboard auto-redirect-to-wizard removed entirely — yellow setup-in-progress banner does the nudging instead, so users always land on the dashboard with the new site selected.

**RLS recursion fix:** `site_members_read` policy from the Phase 0 init migration referenced `site_members` from inside its own USING clause (`exists (select 1 from site_members sm where ...)`) — Postgres returned `infinite recursion detected in policy for relation "site_members"` on every authenticated read, silently returning 0 rows. Migration `20260511130000_phase6a_fix_site_members_rls_recursion.sql` replaces the EXISTS-on-self with `user_can_access_site(site_id)` (existing SECURITY DEFINER helper) — same intent, no self-reference.

**Seed update:** `scripts/seed.ts` now sets `setup_completed_at = now()` on insert + backfills it on existing rows so demo sites land "ready" and don't trap admins on the wizard.

**New diagnostic:** `pnpm db:check` (`scripts/check-demo-state.ts`) prints auth users / profiles / memberships / sites / roles for the 4 demo accounts via the service role — used to prove DB state during the RLS-recursion debug.

Modules 6b–6j (Incidents → Admin) queued.

## Phase 6k — Sidebar pin + hover-drawer overlay

Merged 2026-05-06 (PR #8). Default = collapsed 60px icon rail (`--sidebar-width-icon: 3.75rem` overrides shadcn's 3rem default); unpinned hover slides an overlay drawer over content with 150ms enter / immediate close, ESC closes; pinned = expanded inline (240px) and persisted via `sidebar_pinned` cookie (1y, lax). New `components/app-shell/sidebar-shell.tsx` (client) owns `pinned` + `hovered` state and drives `<SidebarProvider open={pinned || hovered}>`; the trick to overlay-without-layout-shift is forcing the gap div to `--sidebar-width-icon` when unpinned via `[&_[data-slot=sidebar-gap]]:w-(--sidebar-width-icon)!` so the fixed-positioned container can expand to 240px without pushing content. Container gets `z-50` when unpinned so the drawer covers the sticky topbar (z-30) and regulatory banner (z-20). Pin/PinOff button in `SidebarHeader` with `aria-pressed` + state-aware tooltip ("Pin sidebar (keeps it open)" / "Unpin sidebar (auto-collapses)"); hidden on mobile and when collapsed. `setSidebarPinned` server action (`sidebar-actions.ts` is pure-async; cookie name lives in sibling `sidebar-cookie.ts` so the `"use server"` rule isn't violated). Layout reads cookie SSR for no first-paint flicker. Honors `docs/design.md` §6.5 (collapsed default) which the shipped `defaultOpen` violated. Deferred to v2: keyboard pin shortcut, per-section collapse, animation tuning, telemetry. Plan: `plans/06k-sidebar-polish.md`.

## Phase 6l — Topbar polish (search shell + responsive + profile menu)

Merged 2026-05-07 (PR #9). Drops the now-redundant desktop sidebar toggle (6k pin + hover-drawer replaces it) by wrapping `MobileMenuButton` in `lg:hidden`; below `lg` the button stays visible as a hamburger and opens the sidebar in shadcn Sheet mode. New centred `<SearchTrigger>` (Cmd+K-style "Search… ⌘K" button at md+, `<Search />` icon-only at < md) — both variants open the same Dialog with a "Coming in Phase 07" placeholder; the kbd badge is decorative and the keyboard shortcut is intentionally not wired (07 wires it). Profile dropdown gains Settings + Members `<Link>` items above the Sign out separator (lucide `Settings` / `Users` icons), routing to two new `EmptyState` stub pages at `/settings` + `/members` with `TODO(phase-08)` markers for the real RBAC gates.

**`useIsMobile` breakpoint bumped 768 → 1024** so the shadcn sidebar primitive flips to Sheet mode at iPad-portrait and below — only the sidebar primitive consumes the hook so the ripple is contained; `sidebar-shell.tsx` is unchanged because the primitive short-circuits to its Sheet branch (line 181) on mobile, leaving the desktop pin/hover `open` prop unused. New `components/app-shell/mobile-menu-button.tsx` is a 20-line wrapper that calls `useSidebar().toggleSidebar()` with a hamburger icon — keeps shadcn's `SidebarTrigger` primitive untouched (still uses `PanelLeftIcon`) so future shadcn updates merge cleanly. Vertical separator between hamburger and SiteSwitcher dropped — header `gap-2` carries the spacing. Plan: `plans/06l-topbar-polish.md`.

## Phase 6b — Incidents redesign + wizard/detail polish

Merged 2026-05-07 (PR #10). Replaces `/incidents` with the stakeholder-mock layout from `assets/incident-management.png`: header band → 4-tile KPI row (Total / High-Critical / Under Investigation / This Month with month-over-month trend pill) → 3-or-4-tile rate row with **per-site rate selection** (US single-site shows TRIR + DART, GB single-site shows LTIFR + TRIFR, "All sites" shows TRIR + LTIFR + TRIFR — DART intentionally omitted in all-sites mode) → 12-month area trend chart (recharts, destructive stroke + gradient fill, integer y-ticks) → 4 breakdown cards (By Type · By Severity donut · By Track · Top Sites) → 4-card status pipeline (Reported / Investigating / Action Required / Closed) mapping `incidents.status` enum (`draft+submitted` → Reported, `classified+under_investigation` → Investigating, `awaiting_capa` → Action Required, `closed` → Closed) with proportional progress fills → existing search + filter chips + table preserved at the bottom (filters operate on the table only; KPIs reflect the scope).

New foundations: `lib/format/kpi.ts` extended with `ltifr()` + `trifr()` (RIDDOR 1,000,000-hour multiplier, same null-on-zero-hours guard); `lib/queries/incidents-list.ts` with 5 typed RLS-bound queries (`getKpiCounts` / `getFrequencyRates` / `getMonthlyTrend` / `getBreakdowns` / `getStatusPipeline`); `SiteScope` resolution mirrors the planner pattern (`?site=all` / `?site=<uuid>` / cookie default); 7 new components under `components/incidents/list/` (`KpiCard` primitive with 6-accent palette including new **`amber` → severity-S3** mapping, `TrendPill` + `computeMonthOverMonthTrend`, `IncidentsOverTime`, `BreakdownCard`, `DonutBreakdown`, `IncidentsPageHeader`, `StatusPipelineRow`, `IncidentsListSurface`); `app/(app)/incidents/loading.tsx` skeletons matching post-load layout.

Wizard polish (no structural change — still 3 steps): header treatment (destructive-tinted icon + breadcrumb + subtitle), `WizardProgress` restyled to tab-pill format (active = green-bordered + green-tinted, ChevronRight separators), Step 1 future-date validation (Zod `.refine((v) => Date.parse(v) <= Date.now())`), Step 2 witness-carryover helper text, Step 3 footer adds "Save draft & exit" link, "Submit incident" → **"Finalize report"** with track-targeted explainer ("Starts the regulatory clock and notifies anyone configured for Track <X> events…").

Detail polish: soft-deleted incidents render a `<DeletedNotice>` card (retention copy + ref code + back link) instead of 404; severity-override audit shows full reverse-chrono history in a collapsible `<details>` block (latest entry preview always visible); 4 aside queries parallelized via `Promise.all`; `StatusBadge` "draft" tone migrated from raw amber-100/950 literals to `warning/15 + warning` token pair.

**Three post-merge hot-fixes shipped on the same PR:** (1) extracted asset Zod schemas to a sibling `lib/actions/assets-schemas.ts` (no `"use server"` directive) because newer Next.js enforcement rejects non-async-function exports from `"use server"` files; (2) dropped the type re-export `export type { AssetCreateInput, AssetUpdateInput }` because Next's `"use server"` compiler emits a runtime reference even for type-only re-exports (manifests as `ReferenceError: AssetCreateInput is not defined` at module evaluation); (3) Step 2 footer alert no longer swallows the `"Validation failed"` server-action error — renders a section-targeted title (witnesses / injured persons / risk matrix / generic) plus the first failing field path as a hint.

Plan: `plans/06b-incidents-polish.md`. Smoke-test guide: `docs/smoke-test-phase6b.md`.

**Phase 09 stub claimed**: `plans/09-argus-ai-assistant.md` reserves the slot for an in-app AI assistant ("Argus" — our equivalent of the references' ARIA), with 10 open scope questions to resolve when the user signals "let's plan phase 09". Reference image `assets/incident-management.png` added (joining the 3 already-tracked wizard reference images).

## Phase 6c — Investigations polish (Kanban a11y + Evidence DnD + Timeline 4-source merge)

Merged 2026-05-07 (PR #11). Plan rewritten on kickoff with concrete audit findings against shipped surfaces (replaces TBD stubs).

Real bugs fixed: Kanban added `KeyboardSensor` alongside `PointerSensor` + `aria-live` move announcer (was pointer-only — keyboard users couldn't drag at all); Evidence dropzone had drag-and-drop copy but only click worked — wired real `onDragEnter/Over/Leave/Drop` with brand-purple drop highlight; per-file upload failure aborted the whole batch (`for ... throw` pattern) — refactored to gather successes + failures with one success toast + per-error toasts; trash button on evidence cards was `opacity-0 group-hover:opacity-100` (keyboard-unreachable, no confirm) — gated behind a new `components/ui/alert-dialog.tsx` primitive (radix-ui umbrella `AlertDialog` export, shadcn-style wrapper) with always-visible button; Timeline only joined 2 of 4 promised event sources — now fetches CAPA events (lookup `capa.investigation_id = inv.id`, OR `capa_id.in.(...)`) + notifications (separate fetch keyed on `incident_id`, merged in TS) for full 4-source coverage with day-grouped reverse-chrono + per-row deep-link icon.

Small gaps closed: `loading.tsx` for both routes + `error.tsx` for detail with retry + back-link; tab strip `aria-current` + `role=tab/tablist`; filter chips `aria-pressed`; "Open" filter chip split into "Pending" + "In progress" (each maps to one DB enum); planner-shape Site filter (`?site=all|<uuid>`) + Lead filter (`?lead=me|unassigned|<uuid>`) added as URL-driven dropdowns (filter component flipped to `"use client"` for `useRouter().push`); sandbox practice badge migrated from raw `bg-amber-100/950` literals to `warning/15 + warning` token pair; "Module 2" eyebrow dropped (matches 6b); 5-Why + Findings save-fail indicator gains a `Retry` button that re-invokes save with current values; Summary-only fetches (team + witnesses) moved inside `tab === "summary"` branch (saves 2 RTTs on non-summary tab nav); site_members stays always-fetched because modals on every tab consume them.

New `assignMeAsLead` server action + card-level "Assign me as lead" CTA on `pending_assignment` cards (gated on `investigation:lead`) — claims lead, upserts team_members with role=lead, advances status to `in_progress`, logs `investigation.lead_reassigned` activity with `self_assigned: true` payload.

**Post-merge fix shipped on same PR:** server `revalidatePath` updates SSR caches but the Kanban owns column state via `useState(initialColumns)` — initial-prop only seeds first render, so the card stayed in Pending until reload. Threaded `currentUser` through `KanbanBoard` + mirrored the drag-end optimistic-update pattern (move card from `pending_assignment` → `in_progress` in local state with viewer as lead + `started_at` set), plus `router.refresh()` to keep downstream surfaces in sync.

Plan correction: original 06c stub described Findings tab as cards-with-status-pills + escalate-CTA — that's the inspection findings model. Investigation findings is a single `text` column on `investigations` per SPEC §5; the shipped textarea is correct, plan now matches.

Plan: `plans/06c-investigations-polish.md`.

## Phase 6d — CAPA polish

Merged 2026-05-08 (PR #17). Plan re-audited on kickoff against shipped surfaces (replaces the 2026-05-06 TBD stub) — same precedent set by 6c.

Cross-cutting: `loading.tsx` + `error.tsx` ship at both routes (`/capa` and `/capa/[id]`); brand error card with Try again (resets boundary) + Back-to-CAPAs link. "Module 3" eyebrow dropped from the list page header (matches 6b/6c which dropped their internal "Module N" labels).

List (`/capa`): tab strip migrated to `<nav role="tablist">` with each tab `role="tab"` + `aria-current="page"` on the active item (mirrors the 6c `detail-tabs.tsx` semantics). Per-tab empty-state copy lives in a new `CAPA_TAB_EMPTY_COPY` map in `lib/capa/types.ts` ("Nothing assigned to you" for Mine / "No overdue CAPAs — nice work" for Overdue / etc.) — replaces the prior single string that read the same regardless of tab. New `<CapaFilters>` component (URL-driven Site `?site=all|<uuid>` + Owner `?owner=<uuid>` dropdowns) — mirrors the 6c planner-shape Site filter and the 6c Lead filter pattern. Site filter respects accessible-sites BFS (`include_children`) identical to investigations + planner. Both KPI counts and rows filter through the resolved `filterSiteIds + ownerParam` so the chips affect the whole surface, not just the table. Tabs preserve `?site` / `?owner` across switches via a `params` prop on `CapaTabs`. Owners dropdown sources distinct profiles holding any role on the filtered sites; current user removed (Mine tab covers the "owned by me" case so no `?owner=me` shorthand). **Verifier / due-window / source filters analyzed and deferred to v2 per the per-chip rationale in the plan** (low click-through value vs. footprint).

Detail (`/capa/[id]`): `updateCapaProgress` server action now returns `ActionResult<{ promoted: boolean }>`; `ProgressSection` fires `toast.success("CAPA started", { description: "Status moved to In progress." })` on the `created → in_progress` auto-promotion. Was silent pre-PR — only the status pill flip signaled the lifecycle change. Retry button surfaces next to `SaveIndicator` on save-fail (mirrors the 6c 5-Why + Findings retry pattern). `VerificationForm`: each `RadioGroupItem` gets `aria-describedby` linking to its consequence text (with matching `id` on the description paragraph) so screen readers pick up the hint, not just the label. **Pre-submit info card** appears when `outcome === "partially_effective"`, naming the owner who'll receive the auto-spawned follow-up CAPA: "Submitting this verification will create a follow-up CAPA assigned back to <owner-name>. You'll be able to edit its title, due date, and details after the verification completes." Compromise per the plan — full form preview was too heavy (would re-implement the create-CAPA form); the info card surfaces the *intent*. Reassign-verifier trigger uses `Button asChild variant="outline" size="sm"` for the standard secondary-action tier (was generic `border + hover:bg-accent`). Reassign `<Select>` + `<SelectTrigger>` get `required` + `aria-required="true"` to signal screen readers and HTML form validators consistently.

**Activity timeline 2-source merge**: parallel-fetch `notifications.eq("capa_id", capa.id)` alongside `activity_events`; map notifications into the shared `ActivityEvent` shape (verb = `notification.<kind>`, `actor_name = null` → renders as "System"); merge in TS and re-sort by `created_at desc`. CAPA only has 2 plausible sources (no comments table; document linkage shown in its own card not as timeline events) so this is a 2-source merge, not the 4-source pattern from 6c investigations. Per-day grouping + deep-link affordance already supported by the shared `components/investigations/detail/activity-timeline.tsx`. Five new `VERB_LABELS` added to that shared component (non-breaking global additions): `capa.started` / `capa.verifier_reassigned` / `notification.capa_overdue` / `notification.capa_escalated` / `notification.assigned`.

**Owner-cannot-verify locked HIDDEN, not disabled-with-tooltip** (the 2026-05-06 stub suggested the latter; re-audit found the form is hidden when viewer = owner — that's the shipped pattern and is acceptable: 3-layer enforcement makes a disabled state visual debt; `OwnerVerifierCard` already surfaces the assigned verifier so the owner sees who to ask).

`pnpm tsc --noEmit` clean. Routes spot-checked (/capa, ?tab=overdue, ?site=all all return 307 to login when unauth — middleware gate intact). Plan: `plans/06d-capa-polish.md`.

## Phase 6f — Templates polish

Merged 2026-05-08 (PR #19). Plan re-audited on kickoff against shipped surfaces (replaces the 2026-05-06 TBD stub) — same precedent as 6c/6d/6e. User answered all 6 open questions before coding (most consequentially Q1 brought drag-reorder via `@dnd-kit/sortable` into the PR scope rather than deferring it).

State coverage: `loading.tsx` + `error.tsx` ship at all 7 templates routes (none existed before — `/templates`, `/templates/browse`, `/templates/browse/[id]`, `/templates/new`, `/templates/[id]`, `/templates/[id]/edit`, `/templates/[id]/assign`); brand `not-found.tsx` at `/templates/[id]` and `/templates/browse/[id]`. Editor `loading.tsx` is a 3-column shell so the cold-load flash matches the post-load layout. "Module 4" eyebrow dropped from `/templates` (matches the eyebrow drops on 6b/6c/6d/6e).

Builder a11y: Body / Title-page switcher migrated to `role="tablist"` + `role="tab"` + `aria-selected` with the tree below as `role="tabpanel"` + `aria-labelledby`; tree-node selection gets `aria-current="true"`; collapse chevrons get `aria-expanded` + descriptive `aria-label`; template name input gets `aria-label="Template name"`. `GripVertical` becomes a real drag handle with `aria-label`; the icon next to it becomes `aria-hidden`. Industry filter strip on `/templates` and `/templates/browse` migrated to `role="radiogroup"` + per-pill `role="radio"` + `aria-checked` (single-select filter pattern, more correct than `tablist` for non-panel-swapping filters); Featured toggle gets `aria-pressed`. Version sidebar in `/templates/[id]` wrapped in `<nav aria-label="Version history">` with `aria-current="page"` on the active row.

**Tree DnD (sibling-only, brought into 6f scope per Q1)**: `@dnd-kit/sortable` wired onto the tree. `PointerSensor` with a 4px activation distance prevents click-to-select from accidentally starting a drag; `KeyboardSensor` with `sortableKeyboardCoordinates` follows the standard pickup/drop flow (Space → arrows → Space, Escape cancels). One `<SortableContext>` per parent's children list — cross-parent drops snap back with an aria-live announce ("Can't move across sections — drops are restricted to siblings"). The existing ↑/↓ buttons stay as a redundant explicit affordance. Reorder rewrites `sort_order` via a new `reorderSiblings()` helper in `lib/templates/items.ts`. `aria-live` polite move announcer mirrors the 6c Kanban pattern. Cross-parent reparenting deferred to v2 (smoke-test note added).

Destructive guards: tree Delete (TreeNode trash + OptionsPanel "Delete item" — both call `handleRemove`) now wraps a single new `<DeleteItemConfirm>` AlertDialog. Section delete with descendants shows "Delete this section and N items inside?" using a new `countDescendants()` helper that mirrors the closure walk in `removeItem()`. Assignment Remove on `/templates/[id]/assign` wraps an `AlertDialog` with snapshot-rule reassurance copy ("inspections already in progress against the pinned version stay running and unaffected").

Autosave hardening: per-attempt `AbortController` ref marks any prior in-flight save as stale before scheduling a new one; the aborted handler ignores its own response so a stale save never clobbers a fresher state. In-flight save promise tracked separately via `inFlightSaveRef`; the new `openPublishDialog()` handler awaits it before opening the dialog so the publish RPC reads a fully-committed draft (server-side serialization without changing the action signature). Publish button is also disabled while `status === "saving"` with a `title=` tooltip explaining why. Save-failed state gains a Retry button next to the SaveIndicator (mirrors the 6c 5-Why and 6d CAPA Retry patterns). The 1000ms debounce stays; cleanup-on-unmount stays; the `runSave()` callable is now extracted via `useCallback` so both the autosave timer and the Retry button use the same path.

ChangeSummaryDialog auto-suggestion: new `lib/templates/diff-summary.ts` (pure helper) computes counters (`added` / `removed` / `renamed` / `typeChanged` / `optionsChanged`) by item-id matching between the published baseline and the live draft. Dialog pre-fills the textarea on open with the rendered one-sentence summary the author can edit. First-publish (no baseline) falls back to the literal `Initial version of <template name>.`. The 10-char minimum + 2000-char max stay; the placeholder example stays as a safety net if the user clears the prefill. The page passes `publishedHeader` + `publishedItems` from `tmpl.current_version_id` (when set and not equal to the draft version id).

Snapshot-rule callout on `/templates/[id]`: new query counts in-flight inspections where `template_id = X AND status = 'in_progress' AND template_version_id != displayed`. When ≥1, surfaces a warning-tinted info card: "N inspection(s) still running on a prior version" + "View running inspections →" link to `/inspections?template=<id>&status=in_progress`. Added `?template=<uuid>` filter on the inspections list to make the deep-link actionable. Brand-new template (zero items) on `/templates/[id]` now renders an EmptyState card pointing at the editor instead of a near-blank ChecklistPreview.

Assign page polish: active-assignments div soup → real `<table>` with thead (Site / Schedule / Pinned version / Actions) + `<th scope="row">` per site name + `aria-label` per Remove button (`"Remove assignment from <site name>"`). Dropped the "next 5 cron runs" preview wishlist entirely (recurring auto-create is deferred to v2; previewing fake runs would mislead). Replaced the warning Note callout with a one-line italic pointer to the Inspections page. `assignTemplate` action now returns `fieldErrors` for `selections`, `schedule_cron`, `start_time_local` from Zod via the standard `ActionResult` shape; form renders them inline with `aria-invalid` + `aria-describedby`.

Smoke test: `docs/smoke-test-phase3.md` extended with 14 new 6f checkpoints (loading skeletons / error-retry / DnD pointer / DnD keyboard / cross-parent rejection / tree-delete confirm / assignment-remove confirm / active-assignments table / diff-suggestion / autosave-vs-publish race / Save-failed Retry / snapshot-rule callout / version-sidebar `aria-current` / editor tab a11y). Known-edges list updated to reflect that sibling-only DnD is shipped and only cross-parent reparenting remains v2.

`pnpm tsc --noEmit` clean. Plan: `plans/06f-templates-polish.md`.

## Phase 6g — Inspections polish

Merged 2026-05-08 (PR #20). Plan re-audited on kickoff against shipped surfaces (replaces the 2026-05-06 TBD stub) — same precedent as 6c/6d/6e/6f. User answered all 6 open questions before coding (most consequentially Q2 brought the full network indicator with last-saved timestamp into the PR scope rather than deferring to a v2 PWA-mode).

**The only mobile-first surface in V1.** Runner must work cleanly on a 375px viewport with one thumb, photo upload must tolerate per-file errors without nuking the batch, signature pad needs labels and a name input that screen readers can find, and tap targets across the runner must hit the 44px mobile spec from `docs/design.md` §8.1.

State coverage: 7 new state files — `loading.tsx` + `error.tsx` at all 3 routes (`/inspections`, `/inspections/[id]`, `/inspections/[id]/findings/[findingId]`) + brand `not-found.tsx` at `/inspections/[id]`. List page now `throw`s on query failure so `error.tsx` catches it (replaces the bare `<p className="text-destructive">` rendering). "Module 5" eyebrow dropped from `/inspections` (matches 6b–6f sequencing).

**Runner save debounce + state tracking** (`components/inspections/runner/inspection-runner.tsx`): per-`(scope, item_id)` 1s debounce keyed via a `pendingSaves` Map ref; latest payload wins. New `runSave()` callback drives `saveStatus` + `lastSavedAt`; `flushPending()` runs at the start of `submitNow()` so the `complete_inspection_v1` RPC never reads a stale JSONB blob. `inFlightSaves` Set ref tracks promises across debounce + auto-populate paths so the indicator only flips to "saved" when the queue is fully drained. The auto-populate effect on mount now goes through `runSave()` for status parity instead of fire-and-forget `Promise.all`.

**NetworkIndicator** (new `components/inspections/runner/network-indicator.tsx`): pill in the sticky runner topbar that subscribes to `online` / `offline` window events + `setInterval(15s)` to refresh the relative-time label. Cycles 5 states: Saving… (spinner) / Saved Xs ago (online + idle) / Offline — last saved Xm ago (offline + has prior save) / Offline (offline + never saved) / Save failed (last save errored, online). Tone changes neutral → warning → destructive across the cycle.

**Photo upload resilience** (`components/inspections/runner/media-uploader.tsx`): refactored the upload loop into per-file `UploadOutcome` (`{ ok: true, uploadId, fileName, storagePath, previewUrl } | { ok: false, fileName, error }`) — one bad file no longer aborts the batch and discards previously-successful uploads. Per-file `AbortController` with a 30s timeout via `Promise.race(uploadPromise, abortPromise)` — supabase-js storage `upload()` doesn't honor an `AbortSignal` natively (its `FileOptions` type has no `signal` field), so the underlying request may still complete in the background, but the user-facing queue stops blocking and the file is reported as failed. Successes + failures are collected separately; success toast reads "Uploaded N of M" (or "Photo uploaded" / "Uploaded N photos" when N === total), per-failure error toasts. Camera + Upload buttons get descriptive `aria-label`s ("Capture photo from camera" / "Upload images from device") and ≥44px tap targets on mobile (collapse to compact at `sm:`).

**FindingActionsCard rewrite** (`components/inspections/finding-actions-card.tsx`): Mark Resolved + Escalate split into two separate `<AlertDialog>` confirms (re-using the primitive shipped in 6c). Resolution-notes textarea moves *inline into the Mark Resolved dialog body* (still optional, max 2000 chars) — no separate notes UI in the card. Both action buttons get descriptive `aria-label`s. The `resolveFinding` server action now requires `inspection_id`, fixes the pre-existing wrong `revalidatePath` (was `/inspections/${finding_id}` — never a valid URL), and `redirect`s to the parent `/inspections/[id]` on success — mirrors `escalateFindingToIncident`'s pattern.

**List page polish** (`components/inspections/inspection-list-filters.tsx` new + `app/(app)/inspections/page.tsx` simplified): URL-driven filter component mirrors `template-library-filters.tsx` — status select fires nav on `change`, search input on `blur` / Enter (no Apply button anywhere). Pre-existing `?template=<uuid>` filter from 6f preserved. `<section aria-label="Inspections">` wraps the table. Inline Resume / Continue draft chip on `in_progress` / `draft` rows in `inspection-list.tsx`.

**Signature pad a11y** (`components/inspections/runner/signature-canvas.tsx`): `<label htmlFor>` on the printed-name input (uses `useId()` to avoid id collisions when multiple signatures render in one inspection); `role="img"` + `aria-label="Signature drawing area"` on the canvas; `aria-label="Clear signature"` on the Clear button. Save button hits 44px on mobile.

**Runner topbar tap targets**: Submit button + back-arrow link both hit `min-h-[44px]` on mobile; collapse to compact desktop sizes at the `sm:` breakpoint. Icon scales accordingly.

Smoke test: `docs/smoke-test-phase3.md` extended with 15 new 6g checkpoints (loading skeletons / error retry / not-found / per-file upload tolerance / AbortController stalled-upload / save debounce / network indicator state cycling × 5 / signature a11y / 44px tap targets / Mark Resolved AlertDialog / Escalate AlertDialog / list filter auto-submit / Resume chip / findings panel aria-label / Module 5 eyebrow removal).

**Not in this PR (deferred to v2):** PWA / native-offline mode (online-with-tolerance only — AbortController + per-file errors + network indicator are the v1 ceiling); per-file upload progress % (would require switching to XHR + signed-URL uploads); GPS / geo-tagging on photos; live multi-inspector collaboration; linked-CAPA surfacing on the finding detail; section-header sticky-on-scroll in the runner (interacts with the existing sticky topbar, needs design validation at 375px); explicit "Save & exit" CTA (the silent-autosave-back-arrow is the contract — adding a CTA would suggest the back arrow does NOT save, misleading).

`pnpm tsc --noEmit` clean. `pnpm lint` matches the 40/16 baseline (no new violations introduced — pre-existing React 19 / Next 16 stricter `react-hooks/set-state-in-effect` warnings on patterns that ship across templates / admin / etc.). Plan: `plans/06g-inspections-polish.md`.

## Phase 6h — Resources polish

Merged 2026-05-08 (PR #21). Plan re-audited on kickoff against shipped surfaces (replaces the 2026-05-06 TBD stub) — same precedent as 6c/6d/6e/6f/6g. User answered all 6 open questions before coding; **Q1 brought an in-place `<InlineAssetCreateDialog>` into 6h scope** (the `<AssetTypeaheadField>` "+ Register a new asset" link previously navigated away from the wizard, destroying Step 2 form state).

State coverage: 13 new state files — `loading.tsx` + `error.tsx` at the 4 list/detail routes (`/resources/assets`, `/resources/assets/[id]`, `/resources/documents`, `/resources/documents/[id]`); `not-found.tsx` at the 2 `[id]` detail routes; lightweight `loading.tsx` at the 3 form routes (`assets/new`, `assets/[id]/edit`, `documents/new`). `/resources/assets/page.tsx` now `throw`s on Supabase query failure so `error.tsx` catches it (replaces the bare `<p text-destructive>` rendering). "Module 4 · Resources" eyebrow dropped on both list pages.

**Asset detail tab nav** (`app/(app)/resources/assets/[id]/page.tsx`): migrated to `<nav role="tablist">` + per-tab `role="tab"` + `aria-selected` + `aria-controls`; tab bodies wrapped in `role="tabpanel"` + `aria-labelledby`. Mirrors the 6f templates editor tab pattern. Per-tab Supabase errors (incidents / inspections / documents) now render through a new `TabError` component (rounded destructive-bordered alert with AlertTriangle icon) instead of the bare red `<p>`.

**`<AssetTypeaheadField>` rewrite** (`components/assets/asset-typeahead-field.tsx`): the cross-cutting picker mounted in the incident wizard's Step 2 (property_damage / unsafe_condition / dangerous_occurrence). Full WAI-ARIA combobox 1.2 pattern: input gets `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-haspopup="listbox"` + `aria-autocomplete="list"` + `aria-activedescendant`; results list `role="listbox"`; per-row `role="option"` + `aria-selected`. Keyboard nav: ↑ / ↓ moves the active descendant, Enter picks, **ESC closes the dropdown without dismissing the parent wizard dialog** (was a real foot-gun before). The "+ Register a new asset" anchor that navigated away from the wizard is replaced with `<InlineAssetCreateDialog>` — a slimmed `AssetForm` (name + kind + location + condition; site is fixed to the wizard's `siteId`; SDS picker dropped to avoid modal-in-modal). On create-success the new asset auto-selects in the typeahead pill via the existing `onSelect` path (no reload, no wizard state loss). Per Q1: modal-in-place over `?returnTo=` redirect, since serializing wizard state into searchParams is fragile (file uploads, deeply-nested fields).

**New server action** `createAssetInline` in `lib/actions/assets.ts`: sibling to `createAssetAction` but **does not redirect** on success — instead returns `{ id, ref_code, name }` so the typeahead can hydrate its picked-pill in place. Reuses the existing `createAsset()` core (which already returns Zod `fieldErrors` via `flatten().fieldErrors`) and just chases the new asset's `ref_code` for the label.

**`<AssetForm>` field-level errors** (`components/assets/asset-form.tsx`): server `fieldErrors` (already returned by `createAsset` / `updateAsset`) wired through to per-field `<p>` + `aria-invalid` + `aria-describedby`. Mirrors 6f's `assignTemplate` shape. Help text under `last_inspected_at` and `next_pm_at` clarifies the relative semantics ("when this asset was last walked" / "next preventive-maintenance date — overdue dates surface in red on the list").

**`<DocumentLinkPicker>` hardening** (`components/documents/document-link-picker.tsx`, the cross-cutting workhorse mounted in 5+ contexts):
- Upload tab: form state resets on success (`file` / `name` / `type` / `expiry` / `notes` cleared) so a second submit doesn't silently re-upload the same file.
- **Orphan recovery (per Q2):** if `createDocument` succeeds but `linkDocument` fails (or throws), surface a `toast.warning` (not error) naming the doc + a "View document" action that routes to `/resources/documents/[newId]` (10s duration). The doc may legitimately still be useful elsewhere; user decides whether to keep or archive. Matches 6g's per-file resilience pattern; soft-warning over hard-rollback because the rollback itself can fail.
- Library-tab archived-filter audit-correction: the audit flagged a missing `archived_at IS NULL` filter, but `listOrgDocuments` already enforces it server-side (`lib/actions/documents.ts:73`). No fix needed — flag the audit as wrong in the plan.

**`<DocumentDetailActions>` edit-metadata reset** (`components/documents/document-detail-actions.tsx`): re-seeds form state from `initial` whenever the dialog opens via a keyed `useEffect`, so a re-open after Cancel shows the live snapshot rather than the previously-edited (then-cancelled) values.

**Perf** (`/resources/documents/[id]/page.tsx`): the 7 sequential per-parent-type label queries (incidents / investigations / capas / assets / sites / inspections / inspection_findings) parallelize via `Promise.all`. ~6× latency cut on heavily-linked documents. Per Q4: `Promise.all` over a single batched RPC because the 7 queries are RLS-bound, run in <100ms each on warm Supabase, and parallelizing is a no-schema, no-RPC shape fix. Type uses `PromiseLike<T>[]` to match supabase-js's `PostgrestBuilder` return type (its `.then()` chain returns `PromiseLike`, not `Promise`).

**A11y polish on shared primitives:** AssetList table `<Table aria-label="Assets">` + `<TableHead scope="col">` on every column (same on the Documents table view); AssetActions dropdown trigger `aria-label="Change asset condition"` (icon-only ChevronDown becomes purely decorative).

**Empty-state copy refinements:** AssetList branches cold-empty CTA ("No assets yet — register your first asset to get started", with a Register button when `canCreate`) vs. filtered-zero hint ("No assets match these filters. Adjust the filters to see more."). Document detail linked-from sidebar replaces technical "Pickers across the app reference this document by id" with user-readable "This document hasn't been linked to any records yet. Use the picker on an incident, asset, CAPA, or inspection to link it."

Smoke test: `docs/smoke-test-phase4.md` extended with 18 new 6h checkpoints (loading skeletons / error retry / not-found / Module 4 drop / cold-empty + filtered-zero copy / tab a11y / dropdown a11y / table a11y / combobox keyboard + inline-create wizard-state-survives / fieldErrors / picker form-reset + orphan-warning / edit-metadata reset / linked-from copy / parallel label fetch / per-tab error styling).

**Not in this PR (deferred to v2):** document versioning · approvals / e-signatures / forced ack · SDS Manager API integration · asset PM cron auto-trigger · asset hierarchy / parent-child · bulk actions on either list · `'use cache'` migration on tab-fetch queries · asset Inspections-tab population (no `inspections.asset_id` FK in V1) · multi-file upload in `document-upload-form.tsx` or DocumentLinkPicker upload tab.

`pnpm tsc --noEmit` clean. `pnpm lint` 42/16 (baseline 40/16) — +2 are the standard "setState in effect on dialog-open" pattern that already ships across `change-role-dialog.tsx`, `archive-site-dialog.tsx`, `template-library-filters.tsx` in the existing baseline. Plan: `plans/06h-resources-polish.md`.

## Phase 6i — Planner polish

Merged 2026-05-08 (PR #22). Plan re-audited on kickoff against shipped surfaces (replaces the 2026-05-06 stub written before `/planner` shipped) — same precedent as 6c/6d/6e/6f/6g/6h. User answered all 6 open questions before coding ("proceed with recommendations" path).

State coverage: 2 new state files — `loading.tsx` (calendar shell skeleton: header band + filter row + 7×5 grid placeholder with chip-shaped pulses) + `error.tsx` (brand destructive-bordered card with **Try again** + **Back to dashboard**, mirrors the 6g/6h pattern with `error.digest` surfaced as a small mono ref line) at `app/(app)/planner/`. "Module 5" eyebrow dropped on the page header (matches the eyebrow drops on 6b–6h).

**Aggregator return shape evolution** (`lib/planner/aggregate.ts`): promoted from `Promise<PlannerEvent[]>` to `Promise<{ events: PlannerEvent[]; failedKinds: PlannerEventKind[] }>`. Each per-source fetcher (incidents · inspections_started · inspections_completed · capa_due · asset_pm_due · investigation_due · regulatory_deadline) refactored to return `{ kind, events, failed }` — the existing `[]`-on-error swallow contract is preserved exactly, but the orchestrator now collects which source kinds errored so the UI can name them. No SQL change; pure return-shape evolution.

**`<SourceFailurePill>`** (`components/planner/source-failure-pill.tsx`, new): renders a quiet warning rendering above the calendar grid when `failedKinds.length > 0`. Copy lists the failed kinds by `PLANNER_EVENT_LABEL` and ends "— refresh to retry". `role="status"` + `border-warning/30` + `bg-warning/10`. **No retry button** per Q4: full page reload is the only sensible recovery for an SSR'd read-only surface; synthesizing per-source retry would require client state + a second action path.

**Calendar-grid a11y** (`components/planner/planner-month.tsx`): real WAI-ARIA grid. Outer container is `role="grid"` with `aria-label="Planner month grid"`; days chunked into 5- or 6-row matrix with explicit `role="row"` wrappers (was a flat 35–42-cell sibling list with no row context). Each cell becomes `role="gridcell"` with `aria-label="<EEEE, PPP>, N event(s)"` (e.g. "Tuesday, May 12, 2026, 3 events"). The `+N more` link gets `aria-label="View all <total> events on <PPP>"`. Date number `aria-hidden` (the cell's aria-label already names the day). **Calendar-cell arrow-key roving-tabindex deferred to v2 per Q1** — proper grid keyboard nav (arrow handlers + roving focus + aria-rowindex) is closer to a small feature than polish; the chip Tab order already covers the day-by-day reading order linearly.

**Mobile horizontal scroll** (`planner-month.tsx` + `planner-week.tsx`): both grids wrap in `overflow-x-auto` with an inner `min-w-[640px]` floor. At <640px the calendar gets its own horizontal scroll context instead of forcing body-level overflow. Per Q5: lighter than forcing Day view at sm (which would surprise users who picked Month/Week). Aligns with `docs/design.md` §8 "data tables: full → priority columns + horizontal scroll" guidance.

**`<PlannerWeek>`**: same `overflow-x-auto` + `min-w-[640px]` wrap; per-day cell gains an `aria-label="<EEEE, d MMM>, N events"`. **No `role="grid"`** — week view is a 7-column lane layout, not a calendar grid; `role="grid"` would mislead.

**`<PlannerDay>` (`planner-day.tsx`)**: header gains site name (when a single site resolves from `?site=`) + a "Back to month" link with an `ArrowLeft` icon that builds `/planner?view=month&date=<same>&<filters>` via the same URL-builder used by `+N more`, preserving the user's filter set.

**`<PlannerFilters>` a11y + Site-Select fallback** (`planner-filters.tsx`):
- View toggle migrates to `role="radiogroup"` + per-button `role="radio"` + `aria-checked` (single-select filter without panel-swap; mirrors the 6f Templates industry-filter pattern, NOT a `role="tablist"` — radiogroup is the more correct WAI-ARIA pattern for filters that don't swap panels).
- Native date input gains `aria-label="Calendar date"`.
- Event-type chips gain `title=` tooltips that flip on `aria-pressed` state ("Click to hide <kind> events" / "Click to show <kind> events"). Existing `aria-pressed` already in place.
- **Real bug fixed:** the Site `<Select>` was setting `value="current"` even when `currentSiteId` was null and no `<SelectItem value="current">` existed in the rendered list — radix logged a missing-SelectItem warning and the trigger went blank. Fix falls back to `"all"` when `currentSite === undefined`.

**`<EventChip>` a11y** (`event-chip.tsx`): `aria-label={fullLabel}` on both `size="sm"` and `size="md"` (full kind/ref/title/date/site, mirroring the existing `title=` value). Without it, screen readers only got the truncated visible title + an unlabeled icon. Decorative icons get `aria-hidden`.

**Empty-state branching** (`page.tsx`): one generic "No events in this window" pill becomes 4 distinct branches:
1. Org-fresh / no events match → "No events in this window. Try a different date."
2. Some chips disabled, no events → "No events match the active filters." + **Clear filters** link (strips every `?<kind>=0`).
3. All chips disabled → "All event types are hidden." + **Show all** link (per Q6: active recovery affordance over passive copy; mirrors 6c's "Clear filters" precedent).
4. Zero accessible sites → dedicated "No sites available" card, calendar skipped entirely (rare edge case for newly invited users not yet attached to a site).

`buildPlannerHref` + `buildShowAllHref` helpers in `page.tsx` preserve every URL param across transitions (date, site, view, all 7 kind flags).

**Sandbox toggle deferred to v2 per Q2.** Aggregator currently relies on per-table RLS for sandbox isolation (sandbox events surface to the reporter + admins via existing `incidents_read` RLS — that's the intended behavior, no leak). Adding a "Show sandbox" admin toggle + a sandbox-styled chip variant would be cross-cutting work that shouldn't land piecemeal on the planner first.

**`+N more` kept as route navigation per Q3** — original 2026-05-06 stub had proposed a side drawer; shipped routes to `/planner?view=day&date=…` instead. URL-shareable + back-button-friendly + zero client state. Audit's `aria-label` add was the only fix needed.

Smoke test: `docs/smoke-test-phase5.md` extended with 12 new 6i polish checkpoints (eyebrow gone · loading/error shells · per-source failure pill · all 4 empty-state variants · no-accessible-sites card · mobile horizontal scroll · ARIA grid + radiogroup screen-reader announcements · EventChip aria-label · day-view back link · site-select null-currentSite fallback).

**Not in this PR (deferred to v2):** drag-to-reschedule · event creation from planner · iCal / Google Calendar export · conflict detection · team / user lanes · timezone-aware multi-day events · recurring-inspection materialization preview · printable view · mobile-optimized week view (horizontal scroll is the v1 fix) · arrow-key calendar-cell nav (per Q1 — `role="grid"` shell ships now) · "Show sandbox" admin toggle (per Q2).

`pnpm tsc --noEmit` clean. `pnpm lint` 42/16 (matches the 6h baseline; no new findings in `planner/*` files). Plan: `plans/06i-planner-polish.md`.

## Phase 6j — Admin polish

Merged 2026-05-08 (PR #23). **Last per-module polish PR — Phase 6 closes here.** Plan re-audited on kickoff against shipped reality (replaces the 2026-05-06 stub written before Phase 11 shipped sites + members + roles + invitations + public `/invite/[token]` 2026-05-07/08, multiplying the admin surface ~3× from 4 routes to 12). User answered all 6 open questions as "proceed with recommendations" — every Q resolved scope-conservatively, no scope expansion.

**State coverage** — 7 new state files: `app/(app)/admin/error.tsx` (only `loading.tsx` existed); `app/(app)/admin/demo/{loading,error}.tsx`; `app/(app)/admin/site-setup/{loading,error}.tsx` (covers the redirector + per-step page via parent boundary); `app/(app)/admin/sites/new/{loading,error}.tsx`. **`/(auth)/invite/[token]/error.tsx` intentionally skipped** per Phase 11c precedent — the page renders 7 branch-typed errors (`not_found` / `expired` / `revoked` / `accepted` / `unauth` / `mismatch` / `ready`); a generic error.tsx would only fire on `requireUser`-style throws that don't apply to a public unauth route.

**Demo Reset hardening** (`components/admin/demo-buttons.tsx` + `app/(app)/admin/demo/actions.ts`):
- `<ResetDataButton>` migrated from plain Dialog to AlertDialog primitive (mirrors 6c–6h destructive-action precedent — AlertDialog used wherever the action is destructive).
- Stripe-style "Type `<orgName>` to confirm" guard added (mirrors the shipped `<ArchiveSiteDialog>` from 11a — same Input + disabled-action pattern, same independent server validation).
- `resetDemoData` server action re-fetches `orgs.name` server-side (not trusting the client-passed `expected_name` hint) and validates `confirm_name` against it; returns `{ ok: false, fieldErrors: { confirm_name: [...] } }` on mismatch via the standard ActionResult shape — a curl bypass with `confirm_name=wrong` still requires the typed name.
- Dialog title now names the org explicitly: "Wipe all transactional data for `<orgName>`?" (was implicit before).

**`/admin` landing** (`app/(app)/admin/page.tsx`):
- Bootstrap-empty hint: 1-line note "Org just created — get started with the Site setup wizard below." appears above the KPI tiles when `activeSites === 0`. Per Q4: keep zeros visible, add directional nudge.
- KPI tiles wrapped in `<section aria-label="Admin counts">`; admin cards in `<section aria-label="Admin sections">`; deep-link tiles (Site setup wizard + Demo affordances) in `<nav aria-label="Admin tools">`.
- Deep-link grid bumped from `sm:grid-cols-2` only to `sm:grid-cols-2 md:grid-cols-2` so md (768–1024px) gets 2 columns instead of stacking.
- Decorative icons get `aria-hidden`.

**`/admin/demo`** (`app/(app)/admin/demo/page.tsx`):
- 3-card grid wrapped in `<section aria-label="Demo affordances">`.
- is_demo warning callout gets `role="status"` (mirrors 6e Reports `<HseRecordCard>` + 6c Investigations save-failed indicator pattern).
- Decorative `ArrowLeft` + `AlertTriangle` icons get `aria-hidden`.

**`/admin/site-setup` wizard a11y** (`components/site-setup/wizard-chrome.tsx`):
- `<ProgressDots>`: existing `<ol>` gains `role="progressbar"` + `aria-valuenow={completedCount}` + `aria-valuemin={0}` + `aria-valuemax={7}` + `aria-valuetext="Step N of 7 · M complete"`. The role="progressbar" override on `<ol>` is intentional — ARIA roles always override the implicit element role.
- `<StepList>`: wrapped in `<nav aria-label="Site setup steps">`. Per-step Link gets `aria-current="step"` on the active step + `aria-label="Step N: <title>, <state>"` where state is one of `complete` / `current` / `not yet started` / `not yet available`.
- New `<StepFormError>` component: inline `role="alert"` with a Retry button (mirrors the 6c/6d/6e/6g/6h Retry pattern). Re-submits the same form via `<button type="submit">`; relies on `useActionState` retaining values. Skips render when message is undefined or "Validation failed" (those surface as fieldErrors below the relevant input).
- All 7 step components (basics → regulator → establishment-ids → departments → users → recipients → confirm) migrated from bare `<p text-destructive>{state.error}</p>` to `<StepFormError message={...} isPending={isPending} />`.

**`/(auth)/invite/[token]` CTA labels** (`components/admin/accept-invitation-card.tsx`):
- Per-branch CTA `aria-label`s with site/role context: "Go to dashboard (this invitation has already been accepted)" · "Log in or sign up to accept invitation to `<siteName>`" · "Sign out (this invitation is for `<email>`, not `<currentEmail>`)" · "Accept invitation to `<siteName>` as `<roleName>`".
- All branch icons (`ShieldCheck` / `Mail` / `AlertTriangle` / `ArrowRight`) get `aria-hidden`.
- **Audit correction:** plan claimed branch headings were `<h2>` needing bump to `<h1>` — wrong, page already uses `<h1>` (line 221 of accept-invitation-card.tsx). Q2 simpler-fix recommendation (CTA aria-labels only) was correct.

**Smoke test:** new `docs/smoke-test-admin.md` is a thin umbrella index pointing at the existing `smoke-test-phase11a.md` / `smoke-test-phase11b.md` / `smoke-test-phase11c.md` per-feature deep-dives, plus a 6j-only polish section (state files / Reset hardening / wizard a11y / invite a11y). Per Q6: thin index over rewalk; the per-feature guides stay authoritative for RBAC + perm + RPC + audit-trail coverage.

**Audit findings that turned out clean (no fix needed):**
- Plan flagged a stale "Email invitations ship in Phase 11c" placeholder card on `/admin/members` — verified zero occurrences. 11c-merge correctly replaced it with live `<InviteMemberDialog>`.
- Plan flagged an unused `Sparkles` import on `/admin/demo/page.tsx` — wrong; `Sparkles` is imported by `components/admin/demo-buttons.tsx` and used by `<LoadSampleChainButton>`. Skipped.

**Deferred to v2 (logged):** new admin pages (org info / billing / SSO / SCIM / IDP / audit-trail viewer); org settings page; member-invite flow rework; Phase 11 RPC behavior changes; pathway-picker re-integration (already shipped per re-audit); demo-cleanup last-run surface (Vercel Cron isn't shipped); `?action=new` URL-sync regression hunt.

`pnpm tsc --noEmit` clean. `pnpm lint` 42/14 — **2 warnings BETTER than the 42/16 6h baseline**; the AlertDialog migration cleaned up 2 setState-in-effect warnings on the previous Dialog implementation. The 1 remaining warning in `demo-buttons.tsx:105` is the same setState-in-effect-on-success pattern that already shipped on the previous Dialog (line number shifted from the migration; not a new finding). Plan: `plans/06j-admin-polish.md`.

---

## Phase 6 — Closed 2026-05-08

**V1 polish-complete.** All 12 module-level polish PRs merged across 10 routes + global app shell:

| # | Module | PR | Merged |
|---|---|---|---|
| 1 | Dashboard | [#7](https://github.com/rafi-aman3/incident-management/pull/7) | 2026-05-06 |
| 2 | Sidebar (global) | [#8](https://github.com/rafi-aman3/incident-management/pull/8) | 2026-05-06 |
| 3 | Topbar (global) | [#9](https://github.com/rafi-aman3/incident-management/pull/9) | 2026-05-07 |
| 4 | Incidents | [#10](https://github.com/rafi-aman3/incident-management/pull/10) | 2026-05-07 |
| 5 | Investigations | [#11](https://github.com/rafi-aman3/incident-management/pull/11) | 2026-05-07 |
| 6 | CAPA | [#17](https://github.com/rafi-aman3/incident-management/pull/17) | 2026-05-08 |
| 7 | Reports | [#18](https://github.com/rafi-aman3/incident-management/pull/18) | 2026-05-08 |
| 8 | Templates | [#19](https://github.com/rafi-aman3/incident-management/pull/19) | 2026-05-08 |
| 9 | Inspections | [#20](https://github.com/rafi-aman3/incident-management/pull/20) | 2026-05-08 |
| 10 | Resources | [#21](https://github.com/rafi-aman3/incident-management/pull/21) | 2026-05-08 |
| 11 | Planner | [#22](https://github.com/rafi-aman3/incident-management/pull/22) | 2026-05-08 |
| 12 | Admin | [#23](https://github.com/rafi-aman3/incident-management/pull/23) | 2026-05-08 |

**Cross-cutting outcomes:**
- Every shipped page has loading + error state coverage at appropriate boundaries (`/(auth)/invite/[token]/error.tsx` intentionally skipped per branch-typed errors precedent).
- Calendar grid (Planner), Kanban (Investigations), 5×5 risk matrix (Incidents), template-builder tree (Templates), and inspection runner all have real WAI-ARIA roles + screen-reader announcements.
- Destructive-action confirms across the app use the AlertDialog primitive (introduced 6c) — not plain Dialog.
- Stripe-style type-the-name guard pattern shipped on `<ArchiveSiteDialog>` (11a) and `<ResetDataButton>` (6j) — both validate server-side independently of the client gate.
- Save-failed Retry pattern appears on every long-form surface (5-Why, Findings, CAPA progress, Annual Hours, Templates autosave, Inspection runner, Site-setup wizard) — re-uses `useActionState`'s retained form state.
- Empty-state copy differentiates org-fresh / filtered-down / all-disabled / no-permissions where applicable; no "No data" stubs remain.
- 35-route audit corrected ~6 cross-cutting issues (Site Select null-currentSite radix warning · per-source aggregator failure visibility · radix grid keyboard a11y · token consistency on the few `text-amber-*` literals that drifted · stale Phase 11c placeholders · etc.).
- `pnpm tsc --noEmit` clean across the closeout. `pnpm lint` baseline holds at 42/14 (improved from 42/16 mid-phase).

**Roadmap (post-Phase-6):**
- **Phase 7** = global search backend (consumes the 6l Cmd+K search shell + adds the `⌘K` shortcut + an `/api/search` endpoint with per-module result types).
- **Phase 8** = Settings (account preferences only — Members moved to Phase 11 in the 2026-05-07 scope adjustment).
- **Phase 9** = Argus AI assistant (stub plan claimed during 6b at `plans/09-argus-ai-assistant.md`).
- **Phase 10** = Safety Bulletin step + then-on-top wizard 3→4 step restructure.

---

Reserved 2026-05-07; user scope absorbs the Members half of the original Phase 8 reservation (Phase 8 stays = Settings/account preferences only). Closes the Supabase-SQL-editor gap for every org-admin task. Reclaims the 4 dormant perm keys (`site:configure / member:invite / member:manage / role:edit`) declared in `init.sql` line 119–124 since Phase 0 but never granted to any default role.

**Sub-PRs (3, sequential against `main`):** ① `feat/phase-11-sites-admin` ② `feat/phase-11-members-admin` ③ `feat/phase-11-roles-and-invitations`. Sites use `archived_at` NOT `deleted_at` (locked rule restricts soft-delete to incidents/investigations/capas).

**6l ripple:** Members link in profile dropdown will redirect to `/admin/members` once 11b ships.

## Phase 11a — Sites admin

Merged 2026-05-07 (PR #14). Migration `20260512120000_phase11a_sites_admin.sql` applied: adds `sites.archived_at + archived_by + archive_reason`; new `site:archive` perm key; `site:configure` granted to `site_admin` + `ehs_manager` (was dormant Phase 0 — until this PR no user saw the Admin nav entry at all even though the route existed); `site:archive` granted to `site_admin` only; `sites_update` RLS policy gated on `site:configure`.

3 atomic RPCs (security-definer): `update_site_v1` (cycle, cross-org, archived-parent guards on parent re-parent; logs `site.updated` with before/after diff payload; country intentionally NOT in signature — mutating country mutates the regulatory engine end-to-end), `archive_site_v1` (rejects when site has any non-archived child, surfaces actionable error naming the children; logs `site.archived` with reason), `unarchive_site_v1` (rejects when parent is itself archived; logs `site.unarchived`).

Routes: `/admin` rebuild from EmptyState (4 KPI tiles via `count: 'exact', head: true` — active sites + archived + members + roles, all org-scoped — plus 3 admin cards: Sites live, Members "Phase 11b" placeholder, Roles "Phase 11c" placeholder, plus existing Site setup wizard + Demo affordances deep-links preserved); `/admin/sites` (table + tree views toggle, URL-driven `?status=active|archived|all` default active + `?country=US|GB|all` + `?q=<name>` search + `?view=table|tree`, per-row Edit/Members/Open icon actions); `/admin/sites/[id]` (4 tabs `?tab=overview|members|hours|setup`, default overview — Overview = country-aware EditSiteForm with country read-only + US-only OSHA establishment ID and NAICS hidden for GB sites + parent reparent combobox using `__none__` sentinel for "no parent"; Members tab = read-only table with yellow "ships in 11b" banner + "run `add_site_member_v1` from the SQL editor" forcing-function copy; Annual hours = multi-year table editor sharing `setAnnualHoursAction` with the OSHA 300A single-year form so edits round-trip both surfaces; Setup = readout of `setup_completed_at` + `setup_progress` JSON in collapsible `<details>`).

**8 new components under `components/admin/`:** admin-landing (KPI tiles + 3 link cards inline in /admin/page.tsx), sites-filters (URL-driven `"use client"` chip + view toggle), sites-list (table primitive), site-hierarchy-tree (BFS nested-list with `parent_site_id` resolution), site-detail-tabs (`role=tab/tablist` + `aria-current`), edit-site-form (country-aware with parent reparent + sentinel), archive-site-dialog (Stripe-style type-the-name guard for archive — server validates the typed name independently so a curl bypass still requires the name; simpler Yes/Cancel for unarchive — reversible), annual-hours-editor (multi-year add/edit/delete with AlertDialog confirm on delete). `loading.tsx` + `error.tsx` ship at every route level. `lib/rbac/permissions.ts` PERMISSIONS union extended with `site:archive`.

Smoke test guide: `docs/smoke-test-phase11a.md` (16 steps covering sidebar visibility, lifecycle, perm gates, activity events trail). Plan: `plans/11a-sites-admin.md`.

## Phase 11b — Members admin

Merged 2026-05-07 (PR #15). Migration `20260513120000_phase11b_members_admin.sql` applied: 3 new RLS policies on `site_members` for admin write paths (insert/update/delete) gated on `has_permission('member:manage', site_id)`; grants `member:invite` + `member:manage` to `site_admin` and `member:invite` only to `ehs_manager`.

4 atomic RPCs (security-definer): `add_site_member_v1` (idempotent upsert with cross-org + archived-site guards; logs `member.added` or `member.role_changed`), `change_site_member_role_v1` (per-site last-admin guard rejects demoting the only `site_admin`), `remove_site_member_v1` (same per-site last-admin guard), `invite_member_to_site_v1` (11b version: only resolves email → existing org profile → calls `add_site_member_v1`; raises guidance error for not-yet-signed-up users with "Email invitations for new users ship in Phase 11c" — full email-invite flow lands in 11c with the `invitations` table).

Routes: `/admin/sites/[id]?tab=members` lit up (the "ships in 11b" forcing-function banner from 11a is now redeemed — replaced with a live editor: "+ Add member" + per-row Change role + Remove gated on `member:manage`; last-admin row gets a "· last admin" annotation and the Remove button renders disabled with a tooltip-style `title` attribute explaining the guard); `/admin/members` (org-wide profile list with columns name + email + sites count + primary role + last seen — last seen computed from a single grouped query on `activity_events` taking `MAX(created_at) where actor_id = profile_id`, NOT N+1; URL filters `?role=<role_id> / ?site=<site_id> / ?q=<name|email>`; right-side info card explains "Email invitations ship in Phase 11c"); `/admin/members/[profileId]` (per-member detail with profile header + read-only "Profile editing lands in Phase 8" hint + memberships table where Change role + Remove are gated **per-site** by `member:manage` on each individual row, NOT once at page level; "+ Add to a site" modal lists only sites the acting admin can manage AND that the member isn't already on; footer card with "<N> activity events in the last 30 days" as a "is this user active" signal — separate from the future activity-log surface); `/members` Phase 6l stub becomes a server-side `redirect('/admin/members')` so the existing profile-dropdown link starts working without the dropdown needing to change; `/admin` Members card flips from "Phase 11b" placeholder to a live link.

**7 new components under `components/admin/`:** `add-member-dialog` (mode-aware via `mode` prop: `add-profile-to-site` from the site tab vs. `add-site-to-profile` from per-member detail — same `add_site_member_v1` RPC backs both directions; empty-state copy explains why the dropdown is empty when the candidate list is empty, instead of hiding the trigger entirely — "Everyone in your org is already on this site" is honest, not sneaky), `change-role-dialog`, `remove-member-dialog` (surfaces the last-admin guard error **inline in the dialog body**, NOT as a toast, so the admin reads it without dismissing), `members-list` (table primitive), `members-filters` (URL-driven role/site native dropdowns + search), `member-memberships-table` (per-row Change role + Remove with a `canManageBySite` Map → per-site permission gating). `loading.tsx` + `error.tsx` ship at every new route level.

**Demo gap closed:** the PR #12 functional-gap report flagged that demo `Site Admin` + `EHS Manager` accounts were siteless and couldn't use the report wizard. After 11b an admin adds them to Houston via `/admin/sites/<houston-id>?tab=members`, they sign in, wizard works.

Smoke test: `docs/smoke-test-phase11b.md` (12 steps). Plan: `plans/11b-members-admin.md`.

**Defers to 11c:** roles editor, `roles.is_system` column backfill, `invitations` table, `/invite/[token]` accept flow.

**Open questions still in parent plan:** invitation site-pinning (recommend required); `notification_kind.invited` (recommend add); Supabase auth admin invite vs. hand-rolled email (recommend Supabase); last-admin guard scope (recommend per-site); `is_system` backfill (recommend yes); sandbox-on-sites (recommend incident-only); archive-cascade read filter (resolved in 11a — query-level archived_at filter, not RLS-level); Phase 8 ripple.

## Phase 11c — Roles editor + Invitations

Merged 2026-05-08 (PR #16). Migration `20260514120000_phase11c_roles_and_invitations.sql` applied 2026-05-07: appends `'invited'` to the `notification_kind` enum; adds 3 new perm keys (`role:create / role:delete / invitation:read`) plus reclaims the dormant `role:edit` key from Phase 0 and grants all 4 to `site_admin` + `invitation:read` to `ehs_manager`; adds the `invitations` table (org_id + site_id + role_id + email + 64-hex token + expires_at + accepted_at + revoked_at + accepted_by + invited_by + include_children) with a partial unique index on `(site_id, lower(email)) where accepted_at is null and revoked_at is null` so re-invites cleanly bump the token; adds RLS for invitations (read by `invitation:read` org-wide, insert/update by `member:invite` on site, no delete — append-only) and admin write paths on `roles` + `role_permissions` (gated on `role:edit / role:create / role:delete`); rewrites `seed_default_roles` so future orgs land with `invitation:read` on ehs_manager and the catch-all picks up the 3 new keys for site_admin automatically.

Reuses the existing `roles.is_default` column for "can't rename or delete" guards instead of adding a new `is_system` column the parent plan called out — same intent.

6 atomic RPCs (security-definer):
- `create_role_v1(p_name, p_description, p_permission_keys[])` — slugs the name into a kebab-case `key` with numeric suffix on `(org_id, key)` collision; validates every supplied permission key against the catalog (rejects unknown keys); inserts roles + bulk-inserts role_permissions; logs `role.created` with permission_count.
- `update_role_v1(p_role_id, p_name?, p_description?, p_permission_keys?)` — system-role rename guard rejects materially different names on `is_default = true` rows; description + permission set always editable; replace-set on role_permissions (delete then insert all); logs `role.updated` with `old_permission_keys` + `new_permission_keys` snapshot.
- `delete_role_v1(p_role_id)` — rejects when `is_default = true` (system roles eternal) or when any `site_members.role_id` matches (forces admin to reassign first); logs `role.deleted`.
- `create_invitation_v1(p_site_id, p_email, p_role_id, p_include_children?)` — rejects when an existing org profile already owns the email (forces the per-site Members tab path — no double-path); revokes any prior pending invitation for the same `(site, lower(email))` before inserting (so re-invite cleanly bumps the token + expiry); generates token via `encode(gen_random_bytes(32), 'hex')` (64 chars); returns `(invitation_id, token)` so the calling Server Action can both display the link AND trigger the Supabase auth admin invite; logs `invitation.created`.
- `revoke_invitation_v1(p_invitation_id)` — gates on `member:invite` resolved via the invitation row's site_id; idempotent (revoking already-revoked is a no-op); logs `invitation.revoked`.
- `accept_invitation_v1(p_token)` — **NOT permission-gated**; validates not-expired + not-accepted + not-revoked + the calling auth user's email matches `lower(invitations.email)` (case-insensitive); also requires the user's profile to be in the inviting org (an actionable error fires if Supabase auth created the profile in a different org, which shouldn't happen but is defensible); calls `add_site_member_v1` to land the membership; sets `accepted_at` + `accepted_by`; returns `(org_id, site_id, site_name, role_id)` for the redirect copy; logs `invitation.accepted`.

Routes: `/admin/roles` (list with **system / custom / all** filter chip + name search; sort `is_default desc, name asc`; per-row member count + permission count; **+ New role** gated on `role:create`); `/admin/roles/[id]?tab=permissions|members` (Permissions tab = name + description fields + grouped PermissionChecklist with collapsible sections + "selected N / M" counts + dirty-state save button; Members tab = profiles holding this role grouped by profile with their site memberships listed and a per-row link to `/admin/members/[profileId]`; system roles get name field disabled + Delete button hidden entirely); `/admin/invitations?status=pending|all` (default pending; columns Email · Site · Role · Invited by · Status · Expires · per-row Copy link + Revoke; **+ Invite member** gated on `member:invite` opens `<InviteMemberDialog>`); `/invite/[token]` (public — middleware whitelist; service-role admin client loads invitation by token + joined site/role/org/inviter so unauth users still see "you're invited to <Site> by <Inviter>"; 7 branches: not_found · expired · revoked · accepted · unauth · mismatch · ready).

8 new components under `components/admin/`: `permission-checklist` (grouped by entity prefix with `GROUP_LABELS` dictionary + per-group collapse + per-group "Select all / Clear" + hidden inputs so the parent form picks selection up via `permission_keys` + a `permission_keys_set=1` marker so the server can tell "user submitted permission keys" apart from "user didn't touch"), `role-list` (table primitive with system chip + per-row link + member/permission counts), `role-filters` (URL-driven type chip + search), `new-role-dialog` (Dialog with `?action=new` URL sync — replaces URL on close so the back button doesn't re-open the modal; on success redirects to the new role's edit page), `delete-role-dialog` (`<AlertDialog>` confirm with `disabled={memberCount > 0 || isSystemRole}` and a `title=` tooltip explaining the guard; the RPC enforces both guards independently), `invite-member-dialog` (Dialog with email + site + role + include_children; on RPC success the dialog **replaces the form with a success panel** showing the `<APP_URL>/invite/<token>` link + Copy button + email-delivery status — best-effort Supabase auth admin invite via `inviteUserByEmail({ redirectTo: <APP_URL>/invite/<token> })`, link is the source of truth regardless of SMTP outcome), `invitations-list` (table with status pill — `pending|expired|accepted|revoked` derived in TS from `accepted_at + revoked_at + expires_at` since the DB doesn't carry an explicit status column — plus per-row Copy link + Revoke buttons that fire the action via `useActionState`), `accept-invitation-card` (the body of `/invite/[token]` rendering all 7 branches with branch-specific copy + CTAs).

Surgical edits: `/admin/page.tsx` (5th KPI tile **Pending invites** appears alongside the existing Active sites + Archived + Members + Roles tiles; admin-cards grid bumps to 4 (Sites · Members · Roles · Invitations) — Roles flips from "Phase 11c" placeholder to live link, new Invitations card lands as a peer; gate now also accepts `invitation:read` so ehs_manager users can land on /admin even without site:configure / member:invite); `/admin/members/page.tsx` (replaces the "Email invitations ship in Phase 11c" placeholder card with a live `<InviteMemberDialog>` gated on `canInvite`); dashboard mounts a new `<InvitedToast />` sibling of `<SiteCreatedToast />` that fires once on `?invited=<site_name>` then strips the param.

Middleware change: `lib/supabase/middleware.ts` whitelist now also lets `/invite/*` through unauth so the public accept page can render its branch logic — paired with the service-role admin client load on the page so the invitation lookup bypasses RLS for unauthenticated visitors.

`lib/auth/orgCan.ts` already shipped in Phase 3; new code uses `orgCan('role:read|role:create|role:delete|invitation:read')` and `requireOrgPermission('role:edit|role:create|role:delete')` for org-scoped checks (roles + invitations are org-scoped, not site-scoped). `lib/rbac/permissions.ts` PERMISSIONS union extended with the 3 new keys.

Service-role admin client (`lib/supabase/admin.ts`) is consumed by 2 places in 11c: (a) `createInvitation` action wraps `auth.admin.inviteUserByEmail` (best-effort — emailError is surfaced to the dialog without blocking the RPC success); (b) the public `/invite/[token]` page loads the invitation + joined entities to render branches for unauth users (RLS would otherwise hide everything from anon).

Two-FK-to-profiles type quirk handled: `invitations` has both `invited_by` and `accepted_by` referencing `profiles(id)`, which makes the `profiles!invitations_invited_by_fkey` embed return `GenericStringError` from supabase-js's type inference even though it works at runtime. Both `/admin/invitations` and `/invite/[token]` skip the embed and fetch inviter/site/role/org separately, joining in TS. Cleaner reads anyway.

`loading.tsx` + `error.tsx` ship for /admin/roles, /admin/roles/[id], /admin/invitations, /invite/[token] (loading only — the public accept page doesn't need an error.tsx since the page itself renders branch-typed errors). Smoke test guide: `docs/smoke-test-phase11c.md` (Parts A–F, ~30 checkpoints covering role lifecycle + system role guards + invitation lifecycle + auth branches + audit trail + DB sanity + polish).

Phase 11 closes. Plan: `plans/11c-roles-and-invitations.md`.

---

## Phase 8 — Settings (account preferences)

Merged 2026-05-09 (PR #24). First post-Phase-6 feature PR. Replaces the EmptyState stub at `/settings` shipped in 6l Topbar polish (PR #9) with a real account-preferences surface. **Account-only** scope — every org-level / site-level / role-level / notification-recipient surface already lives under `/admin/*` after Phase 11 (the original Phase 8 reservation was "Settings + Members"; Members moved to Phase 11 on 2026-05-07). User answered all 6 open questions as "proceed with recommendations" — every Q resolved scope-conservatively.

**No schema migration. No new permission keys. No new RPCs.** Account settings are RLS-bound to `auth.uid() = profiles.id` via the existing `profiles_update_self` policy from Phase 0 init.sql. Single route, 4 sections, 3 server actions.

**3 server actions** in `app/(app)/settings/actions.ts`:
- `updateProfile` — Zod validates `full_name` (required, max 120) + `department` (optional, max 120); RLS-bound update over `profiles`. Returns `ActionResult` with `fieldErrors` via `flatten().fieldErrors`. Revalidates `/settings` + `/` layout (so the topbar avatar dropdown re-reads `full_name` on next nav).
- `changePassword` — re-auths via `supabase.auth.signInWithPassword({ email, password: current_password })` BEFORE applying `auth.updateUser({ password: new_password })` so a stolen session can't change pw without the typed current password. Wrong current → `fieldErrors.current_password = ["Current password is incorrect"]`. Mismatched confirm → `fieldErrors.confirm_password` (Zod `.refine`). New === current → `fieldErrors.new_password`. Min 8 chars on `new_password`.
- `signOutEverywhere` — uses the service-role admin client (`lib/supabase/admin.ts`, already shipped Phase 11c for `/invite/[token]` lookup) to call `auth.admin.signOut(userId)`, invalidating every active session for this user including the current one. Redirects to `/login?signed_out=everywhere`.

**Page layout** (`app/(app)/settings/page.tsx`): single `max-w-3xl` column with 4 cards stacked. Header copy points at `/admin` for org-level settings.

**4 cards under `components/settings/`:**
- `<ProfileCard>` — Display name + Department editable; Email read-only with "Contact your admin" v2 hint. Field-errored inputs get `aria-invalid` + `aria-describedby` + per-field error message.
- `<SecurityCard>` — password change form with `<PwField>` reusable input (Current / New / Confirm; `autoComplete="current-password" / "new-password"`); below the form, a section-divided "Sign out from all devices" row that opens an AlertDialog confirm (mirrors 6c destructive-action precedent + 6j Demo Reset migration). Form ref + `formRef.current?.reset()` on success so the 3 fields clear; toast "Password updated".
- `<AppearanceCard>` — Light / Dark / System theme toggle as a 3-button `role="radiogroup"` (mirrors 6f Templates industry-filter + 6i Planner view-toggle precedent — radiogroup, not tablist, for filters that don't swap panels). Per-button `role="radio"` + `aria-checked`. Active button gets `bg-brand text-white shadow-sm`. Uses `next-themes`' `useTheme()` + a `mounted` flag (set in `useEffect`) to gate the active-theme readback so SSR markup matches the first client render — per next-themes' hydration-mismatch docs. The `setMounted(true)` in `useEffect` carries an inline `eslint-disable-next-line react-hooks/set-state-in-effect` with a comment linking the next-themes docs (the lint rule is a known false positive for this exact pattern).
- `<SignOutCard>` — section-level button mounting the existing `signOut` action from `app/(auth)/login/actions.ts`. **Plain Button (no AlertDialog)** per Q6 — same-device sign-out is reversible by signing back in; AlertDialog reserved for the harder-to-undo sign-out-everywhere flow.

**Theme infrastructure:**
- New `<ThemeProvider>` wrapper at `components/theme-provider.tsx` — thin client component wrapping `next-themes`'s ThemeProvider so the RSC root layout (`app/layout.tsx`) can import a single client-component module (mirrors how `components/ui/sonner.tsx` already wraps sonner's `<Toaster>`).
- `app/layout.tsx` wraps the tree in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`. `suppressHydrationWarning` added to `<html>` per next-themes' recommendation (the `class="dark"` attribute is set client-side after mount, so SSR markup mismatches by design for one frame).
- `next-themes` was already a direct dep (`^0.4.6` in package.json) — previously only consumed by `components/ui/sonner.tsx` for sonner's theme-aware toasts. No new dep added.

**State coverage:** `app/(app)/settings/{loading,error}.tsx` — 4-card skeleton matching the post-load layout + brand destructive card with **Try again** + **Back to dashboard** (mirrors 6h/6j shape).

**Login page** (`app/(auth)/login/page.tsx`): reads `searchParams.signed_out === "everywhere"` and renders a 1-line `role="status"` warning callout above the form: "You've been signed out from all devices. Sign in again to continue." `searchParams` extended with `signed_out?: string`.

**Doc updates:**
- `docs/ui-flow.md` line 36 fixed: outdated "Site Admin · Site settings page (post-setup)" → "All users · Account preferences (profile, password, theme, sign out)". Site-level concerns moved to `/admin/sites/[id]` in Phase 11a; the line had been stale since.
- `docs/smoke-test-phase8.md` (NEW) — 11-step walkthrough (land · profile happy path · profile validation · password wrong-current · password mismatch · password success · sign-out-everywhere · theme persists · same-device sign out · a11y/SR sanity · console hygiene).

**Open questions resolved on kickoff** (all "proceed with recommendations"):
1. Theme storage = next-themes/localStorage per-device (over a synced DB column — DB column is over-engineered for a per-device convention).
2. Sign-out-everywhere = ship (admin client already in repo from 11c; security best-practice).
3. Email change = defer to v2 (Supabase verification flow with 2-stage confirm).
4. Notification silencing per user = defer to v2 (would need new `user_notification_silences` table + dashboard banner filter + bell filter).
5. `preferred_pathway` column = defer (no current dashboard need; empty-state cards already personalize).
6. Section-level sign out confirm = plain button (same-device, reversible); AlertDialog reserved for sign-out-everywhere.

**Deferred to v2 (logged):** email change · MFA/2FA enrollment + recovery codes + step-up auth · notification silencing per user · avatar upload · language preference · timezone preference · active-sessions list · `preferred_pathway` column / personalized dashboard.

`pnpm tsc --noEmit` clean. `pnpm lint` 42/14 — **exact match with 6j baseline**. The next-themes mounted-flag pattern in `appearance-card.tsx` requires the inline disable noted above. Plan: `plans/08-settings.md`.

---

## Phase 12 — Auth & Onboarding

Merged 2026-05-09 (PR #25). First feature PR that turns the platform into a *self-serve* product — pre-12 the only path to a `profiles` row was running `pnpm db:seed`. Now any brand-new email signs up, verifies, names their org + first site, optionally invites teammates, and lands on a real dashboard with their own bootstrapped data. User answered all 9 open questions as "proceed with recommendations" — every Q resolved scope-conservatively.

**Migration `20260515120000_phase12_auth_onboarding.sql`:** adds `profiles.onboarded_at timestamptz` (NULL = mid-onboarding, timestamp = finished — backfilled `now()` for the 4 seeded demo accounts so they skip the gate); adds `bootstrap_org_v1(text, industry_type, char(2), text, text)` SECURITY DEFINER RPC that atomically creates org + profile + first site + first membership + seeded default roles in a single function call (so no half-state if any step fails); adds `profiles_self_insert` RLS policy as defense-in-depth for any non-RPC profile insert under the user's session.

**Migration `20260516120000_phase12_fix_bootstrap_org_ambiguous_org_id.sql` (post-merge bug fix):** original `bootstrap_org_v1` declaration `returns table (org_id uuid, site_id uuid)` makes `org_id` an OUT parameter visible inside the function body. The bare comparison `where org_id = v_org_id` inside the `roles` lookup at step 7 was therefore ambiguous against `roles.org_id`; Postgres rejected it as `column reference "org_id" is ambiguous`. Fix qualifies the column reference (`roles.org_id`) using a table alias. Rewritten function is otherwise identical to the original.

**6 new pages** under `app/(auth)/` and `app/(onboarding)/`:
- `/register` (`page.tsx` + `register-form.tsx` + `actions.ts`) — full_name + email + password + confirm + **company name** form. Calls `auth.signUp` with `options.data` carrying `full_name` + `org_name` (so onboarding step 1 pre-fills the org name without a second user keystroke). Stashes the registration password base64-encoded in a 5-minute httpOnly + sameSite=strict cookie (`pending_otp`) so the DEMO OTP path can sign the user in after verification — production path doesn't depend on this cookie because Supabase `verifyOtp({type:"signup"})` handles the password during verification natively. Email-already-registered surfaces as a `fieldErrors.email` ("This email is already registered. Try signing in instead.") not a generic toast. **Country intentionally NOT collected at register** — country is a per-site fact (multi-country orgs are real; a US HQ can have UK + Australia sites), so it stays in the onboarding wizard's site fieldset where it belongs.
- `/verify-otp` (`page.tsx` + `otp-form.tsx` + `actions.ts`) — single inputMode=numeric maxLength=6 input. DEMO mode: typing the magic value `NEXT_PUBLIC_DEMO_OTP_BYPASS` (default `8484`) routes through the service-role admin client which sets `email_confirm:true` then signs in via `signInWithPassword` from the cookie-stashed pw. PROD mode: native `verifyOtp({type:"signup"})`. Resend wired with a 60s cookie-based cooldown.
- `/forgot-password` (`page.tsx` + `forgot-password-form.tsx` + `actions.ts`) — always returns `ok:true` (no email enumeration); DEMO mode `console.log`s the magic-link target so devs can copy/paste during local testing.
- `/reset-password` (`page.tsx` + `reset-password-form.tsx` + `actions.ts`) — reads the Supabase-established session from the magic link; calls `auth.updateUser({password})` + `signOut` + redirects to `/login?password_reset=1`. Expired-link path surfaces "Reset link expired or missing. Request a new password reset email."
- `/onboarding` (`page.tsx` + `onboarding-wizard.tsx` + `actions.ts` + `loading.tsx` + `error.tsx`) — NEW route group `(onboarding)` with its own centered layout (`max-w-xl`, no app shell). 3-step wizard: (1) Org+Industry → (2) Site+Country+Timezone → (3) optional Invites. Steps 1+2 commit atomically via `bootstrap_org_v1`; Step 3 reuses the Phase 11c `invite_member_to_site_v1` RPC (up to 5 emails — comma- or newline-separated). On finish, `finishOnboarding` sets `onboarded_at = now()` + redirects to `/dashboard?welcome=1`. Tab-crash recovery: profile + at least one membership + `onboarded_at IS NULL` → page re-enters at the invite step. Org name pre-fills from `auth.users.raw_user_meta_data.org_name` (set during register) — user can still edit before clicking "Create my workspace". Wizard's "Skip for now" uses React 19's `<Button formAction={finishOnboarding}>` instead of a nested `<form>` (HTML forbids nested forms — original implementation triggered a hydration error).

**Auth gate split** (`lib/supabase/auth.ts`):
- `requireUser()` (for `(app)` routes) — auth.user check + profile row read; **redirects no-profile state to `/onboarding` (not `/login`)** so a user who completed signup but lost their tab before finishing onboarding lands on the wizard instead of a confusing login round-trip.
- `requireAuthenticatedUser()` (NEW, for `(onboarding)` routes) — auth.user check only, accepts the no-profile state mid-bootstrap.
- `ProfileRow` type extended with `onboarded_at`.

**`(app)` layout finishing nudge** (`app/(app)/layout.tsx`): `if (profile.onboarded_at IS NULL && memberships.length > 0) redirect('/onboarding?step=invite')` — the second tab-crash recovery layer for users who closed the browser between Step 2 commit and Step 3 finish.

**Login page** (`app/(auth)/login/page.tsx`): adds `?password_reset=1` (green) and `?after_verify=1` (neutral) banners alongside the existing `?signed_out=everywhere` (yellow). Footer gains "Forgot password?" + "Don't have an account? Sign up" links.

**Proxy middleware** (`lib/supabase/middleware.ts`):
- Public-auth allowlist extended for the new routes so unauthenticated users can reach `/register`, `/verify-otp`, `/forgot-password`, `/reset-password`, `/callback` (the original allowlist only covered `/login`, `/auth/*`, `/invite/*` — every Phase 12 route was getting bounced to `/login` mid-flow).
- **Switched from `supabase.auth.getClaims()` to `supabase.auth.getUser()` (post-merge fix).** `getClaims()` only verifies the JWT locally — it does NOT refresh expired access tokens. After Supabase's default 1-hour TTL, the access-token cookie expired and `getClaims()` returned null even though a valid `refresh_token` was sitting right next to it; the middleware then redirected signed-in users to `/login` (reproduced as "log in as admin@demo.local, click /incidents, get bounced to login"). `getUser()` goes through the Auth server, refreshes the access token via the refresh cookie, and the cookies adapter's `setAll` writes the rotated tokens back to the response. Matches the canonical Supabase Next.js SSR pattern.

**`ROLE_WELCOME_CONTENT` extracted to `lib/onboarding/role-welcome-content.ts` (post-merge fix).** Originally exported from the `"use client"` `components/onboarding/role-welcome-card.tsx`; the dashboard server component imported it from there. Next.js 16 with Cache Components treats every named export of a `"use client"` module as a client reference — non-component values come back as opaque stubs in the server runtime, so `ROLE_WELCOME_CONTENT[currentRoleKey]` evaluated to `undefined` and the dashboard crashed on `content.title` when `?welcome=1` rendered the dialog. Moved the data + type to a plain non-client module; `role-welcome-card.tsx` re-exports them so existing call sites still work, and the component now early-returns `null` if `content` is missing as a defensive belt.

**Demo accounts unaffected.** All 4 seeded demo profiles had `onboarded_at` backfilled to `now()` by the migration's `update profiles set onboarded_at = now() where onboarded_at is null` step, so login → /dashboard works as before. New self-signups (e.g. `rafiaman03@…`) go through the full register → verify → onboard flow; a sign-out + sign-back-in still owns their real org + site (no "demo data is gone" surprise).

**`docs/smoke-test-phase12.md`** — 14-step walkthrough.

**`docs/ui-flow.md`** — 5 new public auth routes + onboarding listed at top of route inventory.

**Env requirement (`.env.local` — gitignored):**
```
NEXT_PUBLIC_DEMO_OTP_BYPASS=8484
```
**Production deployments MUST unset this** — when present, the magic value lets anyone sign up with any email without a real OTP. The `pending_otp` cookie payload is harmless when unset (production native `verifyOtp` ignores it).

`pnpm tsc --noEmit` clean. Plan: `plans/12-auth-onboarding.md`.

**Deferred to v2 (logged):** real email-OTP delivery configuration (currently DEMO-mode only — Supabase email templates need wiring); MFA/2FA enrollment + recovery codes + step-up auth; SSO/SAML/SCIM/IDP integration; passwordless magic-link login (we ship password-based + OTP-during-signup but not magic-link sign-in); rate-limiting on `/register` + `/verify-otp` (currently unthrottled — Supabase auth's built-in rate-limits are the ceiling); CAPTCHA on public auth surfaces; legal/ToS acceptance checkbox + tracking column; soft-delete on profiles (currently RLS-bound to `auth.uid()` only); audit-trail viewer for self-signup events.

---

## Phase 13 — Site Setup OSHA + RIDDOR alignment

Merged 2026-05-09 (PR #26). Replaces the 7-step demo Site Setup wizard with a 9-step regulatory-aligned flow that captures the fields OSHA Form 300A and RIDDOR F2508 actually require. Pre-13 the wizard collected only name + address-text + NAICS + an OSHA establishment ID; that's not enough to file. User answered all 10 open questions as "ship it as recommended" — every Q resolved scope-conservatively with no scope expansion.

**Migration `20260517120000_phase13_site_setup_osha_riddor.sql`:**
- 22 new columns on `sites`: structured address (`street_1/2`, `city`, `state_or_region`, `postal_code`), lat/long (`numeric(9,6)` paired-or-null with range CHECKs — plain numerics, NOT PostGIS, since map dashboards just read two numbers per row), jurisdiction (`osha_jurisdiction` federal/state-plan + `state_plan_code`; `gb_jurisdiction` HSE/local-authority), US identifiers (`ein` NN-NNNNNNN format, `sic_code`, `ita_establishment_id`), GB identifiers (`crn` Companies House, `uk_sic_2007`, `hse_establishment_number` promoted from JSONB to a real column), workforce (`peak_employees_year`, `avg_employees_year`, `partially_exempt_override`), hazards (`applicable_standards text[]` constrained to {1910/1926/1915/1917/1918/1928}, `psm_applicable`, `hazard_tags text[]` constrained to a 10-tag catalog), lifecycle (`site_type` fixed/mobile/office_only, `operational_status` active/inactive/closed, `opened_on`, `closed_on`), people (`site_ehs_lead_id` FK profiles, `riddor_responsible_person_{name,role}`).
- New child table `site_emergency_contacts` (id, site_id, name, role, phone, email, sort_order, timestamps + `name + (phone OR email)` CHECK). RLS read = `user_can_access_site`; writes gated on `site:configure`.
- Three new RLS policies on `notification_recipients` — INSERT/UPDATE/DELETE all gated on `site:configure`. **Closes the Phase-0-era bug** the user reported: the init migration shipped a SELECT-only policy on this table, so the recipients step (Step 6 pre-13, now Step 8) silently 401'd with "new row violates row-level security policy" when the wizard tried to save.
- Two computed-read SQL functions:
  - `is_ita_required(p_naics text, p_peak_employees integer)` — returns true if the site must submit Form 300A via OSHA's ITA portal, per 29 CFR 1904.41 Appendix A: 250+ employees in any covered industry, OR 20–249 in a high-hazard NAICS, falling through to false when partially exempt.
  - `is_partially_exempt(p_naics text, p_peak_employees integer)` — returns true if the site is partially exempt from routine 300/300A/301 recordkeeping per 29 CFR 1904.2: ≤10 employees at all times, OR NAICS in the partially-exempt low-hazard list.
- Curated NAICS prefix arrays (high-hazard + partially-exempt) live as static array literals inside private helper functions `_phase13_high_hazard_naics_prefixes()` + `_phase13_partially_exempt_naics_prefixes()`. Curated representative set for V1 — the full Appendix A tables run ~150 rows; expand as more industries onboard. `is_partially_exempt` is defined first because `is_ita_required` references it (one-line ordering bug fixed before merge).
- DB-layer CHECK constraints validate `applicable_standards <@ array['1910','1926','1915','1917','1918','1928']` and `hazard_tags <@ array[<10-tag catalog>]` — defense-in-depth alongside the Zod layer.
- Lat/long CHECK: `(latitude IS NULL) = (longitude IS NULL)` (paired-or-null) + `latitude between -90 and 90` + `longitude between -180 and 180`.
- Existing `address text` column kept as denormalized legacy for one phase per Q1 decision; migration runs `update sites set street_1 = address where address is not null and street_1 is null` for backfill — no regex parsing of unstructured strings (US/GB formats vary too much).

**Wizard rewrite — 9 steps with slug URLs at `/admin/site-setup/<slug>`:**
| # | Slug | Country branching | Fields collected |
|---|---|---|---|
| 1 | `basics` | label-only | name, structured address, lat/long, country (read-only), timezone, site_type, operational_status, opened_on, closed_on |
| 2 | `jurisdiction` | US: federal vs state-plan + state code; GB: HSE vs local authority | `osha_jurisdiction`, `state_plan_code`, `gb_jurisdiction` |
| 3 | `identifiers` | US block: EIN + NAICS + SIC + ITA + legacy OSHA establishment ID; GB block: CRN + UK SIC 2007 + HSE establishment number | per-country identifier set |
| 4 | `workforce` | universal | peak/avg employees, inline annual-hours readout pointing at `/admin/sites/[id]?tab=hours`, computed read-only badges for `is_ita_required` + `is_partially_exempt` calling the SQL fns via `supabase.rpc()`, `partially_exempt_override` toggle |
| 5 | `hazards` | US-only: applicable_standards multi-select + PSM toggle; both: hazard_tags multi-select | text[] selections matching DB CHECK constraints |
| 6 | `departments` | label-only | preserved from old Step 4 — JSON-payload pattern in `setup_progress.departments` |
| 7 | `people` | GB: RIDDOR responsible person fields visible | EHS lead profile picker (from `site_members`), responsible person name + role, emergency contacts list editor |
| 8 | `recipients` | label-only | preserved from old Step 6 — RLS fix is migration-only |
| 9 | `confirm` | label-only | summary in 6 sections + warnings list + Launch button |

**URL slug migration:**
- `lib/site-setup/steps.ts` reshape: `slug` field added to `SETUP_STEPS`; `nextIncompleteStep()` returns slug strings; new helpers `isValidSlug`, `stepBySlug`, `stepByNumber`, `nextStepSlug`.
- Route folder renamed `[step]` → `[slug]`. Numeric URL backward-compat dropped per Q5 — internal admin chrome, no external links, redirector at `/admin/site-setup` handles stale tabs by routing to `nextIncompleteStep(progress)`.
- `lib/site-setup/{hazard-tags,applicable-standards,state-plans}.ts` — TS catalog modules with codes + display labels matching the DB CHECK constraints. Per Q2/Q3/Q4: text[] columns with constants modules over lookup tables — premature abstraction otherwise.

**Server actions** (`app/(app)/admin/site-setup/actions.ts`): 9 actions, slug-based redirects, country-branched persistence (e.g. `saveStep3` writes US fields when `country='US'` and nulls the GB fields, vice versa). `saveStep7` does an emergency-contacts insert-after-delete pattern (simpler than diffing for v1).

**localStorage draft persistence** (`lib/site-setup/use-draft-persistence.ts`):
- Every form step auto-saves its current FormData to localStorage on every input/change with a 600ms debounce. Multi-value fields (`text[]`) preserved via `Set + getAll` serializer.
- On mount, if a saved draft exists for the (siteId, slug) pair, the form is pre-filled from the draft and a `<DraftRestoredBanner>` surfaces above the form with a Discard button (wipes localStorage + reloads the page so server-loaded defaults render fresh). Per Q "Restore UX" decision: auto-hydrate + banner, not modal-on-mount.
- Storage key shape: `site-setup-draft:<siteId>:<slug>:v1`. 24-hour TTL on stale entries (auto-purged on read).
- Clear semantics per Q "Clear timing" decision:
  - Step N+1 mount clears Step N's draft (server has the data after a successful Save & continue).
  - Step 9 (Confirm) mount clears ALL drafts for the site (`clearAllDraftsForSite(siteId)`).
- Failure modes covered: tab close, page refresh, browser crash, accidental navigation away. Network-error-during-save is also covered as a side effect — `useActionState` already retains form state across submission failures, so localStorage is belt + suspenders for that case. JSON-payload steps (departments / people / recipients) parse the `*_json` field back into the controlled state on hydrate.

**Demo seed updates** (`scripts/seed.ts`):
- `SiteSeed` extended with the full Phase 13 field set; SITE_SEEDS records carry realistic data — Houston (US, NAICS 332710 manufacturing, EIN 12-3456789, lat 29.7604 / long -95.3698, hazard tags confined_space + hot_work + hazardous_energy + chemicals + noise, peak 145 / avg 132), Manchester (GB, CRN 07654321, UK SIC 25620, HSE jurisdiction, lat 53.4808 / long -2.2426, RIDDOR responsible person Erin Manager, peak 65 / avg 60), child sites offset slightly from parents.
- New `ensureEmergencyContacts(sites)` and `setSiteEhsLeads(sites, users)` passes run after the user-seed pass so the FKs into profiles resolve. Idempotent — re-runs backfill existing rows via `siteUpdatePayload(seed)` helper.

**Drive-by fix** — `app/(auth)/verify-otp/page.tsx`: pre-existing Phase 12 build failure (Cache Components: "Uncached data was accessed outside of `<Suspense>`"). Wrapped the `searchParams`-consuming portion in `<Suspense>` matching the `/login` page pattern. Unblocks `next build` end-to-end.

**Smoke test** — `docs/smoke-test-phase13.md` (12 parts): RLS bug fix, slug URLs, US country branching, GB country branching, workforce computed badges, hazards multi-select, lat/long pairing, emergency contacts + EHS lead, confirm warnings, launch, **localStorage draft persistence (refresh recovery + cross-step clear + Launch clear + 24h TTL)**, RBAC gates.

**Locked decisions** (per kickoff Q&A — every recommendation in `plans/13-site-setup-osha-riddor.md`):
1. `address text` kept for one phase as denormalized legacy; admin re-splits during next walkthrough.
2. Hazard tags storage = `text[]` (constants module, not lookup table).
3. Applicable standards storage = `text[]`.
4. State Plan list = hardcoded TS constant.
5. Numeric URL backward-compat dropped.
6. Existing demo `address` text copied to `street_1` on migration; structured fields left NULL.
7. `site_ehs_lead_id` nullable schema-level, required at wizard save.
8. Annual hours editor embedded inline on Step 4 (not link-out).
9. Emergency contacts: zero allowed; Confirm warns when zero.
10. Lat/long capture = manual paste only (geocoding API deferred).

**Plan:** `plans/13-site-setup-osha-riddor.md`. **Smoke test:** `docs/smoke-test-phase13.md`. **Decisions:** `docs/SPEC.md §15`.

**Deferred to v2 (logged):** ITA portal API submission · HSE F2508 portal API submission · multi-establishment EIN handling · Cal/OSHA-, MIOSHA-specific extra fields · PSM covered-process registry beyond yes/no · hazard tag → required training derivation (Phase 14+ Templates tie-in) · address autocomplete / geocoding API · site cloning · map-view dashboard component (lat/long columns + demo data ready, the actual Leaflet/OSM render is a future phase).

`pnpm tsc --noEmit` clean. `pnpm exec next build` green (all 59 pages).

---

## Phase 9c — Argus AI Investigator (`/investigations/[id]?tab=ai`)

**Status:** shipped 2026-05-10
**Branch:** `feat/phase-9c-argus-investigator`
**Plan:** `plans/09c-argus-investigator.md`

**What landed.** New `ai` tab between Findings and Timeline on `/investigations/[id]` (Sparkles + cyan accent). Visible only when `orgs.argus_enabled = true`, caller has `argus:use` + `investigation:edit`, and the investigation is open. URL `?tab=ai` falls back to Summary in any of those misses.

**Generation pipeline.** POST `/api/argus/investigator` runs the heavy gate stack (`runArgusGates("investigator")` — 3/min/user, org daily token budget, key configured), reads the investigation + incident + existing witnesses + injured persons, redacts known names to initials, and makes one Sonnet 4.6 call with `tool_choice: { type: 'tool', name: 'propose_investigation_draft' }` so the model emits exactly one `tool_use` block with a typed `{ timeline, whys, root_cause_summary, findings, insufficient_input }` payload. SSE wire: `progress` (heartbeat) → `draft` (full payload + suggestionId) → `usage` → `done`. Half-formed JSON deltas are not streamed — UI shows a thinking indicator, then the draft lands at once.

**Review-and-edit gate.** Client renders four cards (Timeline / 5-Why / Root cause / Findings); each is editable inline; per-card Push commits via the existing `saveInvestigationText` / `saveWhy` actions (no new write paths, `investigation:edit` gate unchanged). Confirm dialog (Replace / Append / Cancel) when Pushing onto a non-empty target field; 5-Why chain is replace-only. Witnesses added in the input panel stay client-side until first Push.

**Audit.** Generate writes one `argus_suggestions` row (`surface='investigator'`, `target_kind='investigation'`, `outcome='pending'`) plus one `activity_events` row (`actor_kind='argus'`, `verb='argus.investigator_drafted'`). Each Push or Discard flips the outcome and writes a sibling `actor_kind='human'` row (`argus.investigator_pushed` / `argus.investigator_rejected`); diff payloads attached when the user edited the draft before pushing. Two new activity verbs (`verb` is `text`, no enum change).

**Hallucination defenses.** Three layers: (1) server-side input gate — pre-flight 400 when zero witnesses AND <50 words; (2) system prompt forbids invention + redactor strips known names + `insufficient_input` escape valve; (3) output gate — when the model returns `insufficient_input` non-empty, the UI renders an explanation banner and skips the four output cards.

**No schema migration.** Reuses 9a tables (`argus_suggestions`, `activity_events.actor_kind`) + Phase-2 columns (`investigations.findings`, `root_cause_summary`, `rca_whys`) + Phase-1 `witnesses`. No new permission keys — gates on existing `argus:use` (Phase 9a) and `investigation:edit`.

**Files.**

```
NEW
├ app/api/argus/investigator/route.ts
├ app/(app)/investigations/[id]/argus-actions.ts
├ lib/argus/system-prompts/investigator.md
├ lib/argus/tools/propose-investigation-draft.ts
├ components/argus/argus-investigator.tsx
├ components/argus/argus-investigator-input.tsx
├ components/argus/argus-investigator-output.tsx
├ components/argus/argus-investigator-witness.tsx
└ components/argus/use-argus-investigator-stream.ts

CHANGED
├ app/(app)/investigations/[id]/page.tsx     (fetch argus_enabled, gate, mount tab)
├ components/investigations/detail/detail-tabs.tsx (add 'ai' tab + cyan accent + argusEnabled prop)
├ lib/argus/tools/index.ts                   (export INVESTIGATOR_TOOLS)
├ docs/SPEC.md                               (§16 9c subsection — runtime reference)
├ docs/ui-flow.md                            (note new tab on /investigations/[id])
├ CLAUDE.md                                  (build status one-liner bump)
└ docs/BUILD_STATUS.md                       (this entry)
```

`pnpm tsc --noEmit` clean. `pnpm exec next build` green.

---

## Phase 9d — Argus Magic Wands + LLM provider pivot to Gemini

Shipped 2026-05-10 on `feat/phase-9d-argus-magic-wands`. Bundles two changes in one PR (two intermediate commits, single squash on merge): a foundation refactor that moves the Argus runtime off `@anthropic-ai/sdk` onto `@google/genai` 2.0.1 behind a provider-agnostic abstraction, and the five new magic-wand surfaces.

### Foundation refactor (commit 1)

- New `lib/argus/llm/`:
  - `types.ts` — provider-agnostic interface (`generateStructured`, `streamText`), normalized `ChatTurn` / `UsageNormalized` shapes, `ToolDefinition` with JSONSchema-subset `parameters`.
  - `schema.ts` — JSONSchema → Gemini OpenAPI-3.0-subset translator. Errors loudly on `oneOf` / `anyOf` / `$ref` / unsupported keys.
  - `gemini-adapter.ts` — Gemini implementation. `fast` → `gemini-2.5-flash`, `smart` → `gemini-2.5-pro`. Forced function calling via `toolConfig.functionCallingConfig = { mode: 'ANY', allowedFunctionNames }`. Normalizes Gemini's `usageMetadata` to `UsageNormalized`.
  - `index.ts` — `getLLM()` singleton. Future OpenAI adapter slots in here behind `process.env.ARGUS_PROVIDER`.
- Migrate existing `lib/argus`:
  - `client.ts` re-exports `getLLM` for back-compat.
  - `models.ts` becomes `TIER_FAST` / `TIER_SMART` + `TIER_BY_SURFACE`. The concrete model id flows through results into `argus_suggestions.model`.
  - `stream.ts` works on `StreamTextResult`, drops Anthropic types entirely.
  - `gates.ts` returns `LLMProvider` instead of `Anthropic` client.
  - `log.ts` accepts `model: string` (not the old `ArgusModel` union); old `claude-*` rows stay valid for audit.
- Tools: `input_schema` → `parameters`; `MODEL_HAIKU` → `ctx.modelUsed`; `ToolContext.modelUsed` set after first `streamText.finalMessage()` resolves.
- Route handlers rewritten:
  - `/api/argus/stream` (9a ping) — `getLLM().streamText` → `streamArgusResponse`.
  - `/api/argus/copilot` (9b agentic loop) — multi-turn loop preserved; SSE `token` / `tool_use` / `tool_result` / `usage` / `done` wire format identical. Tool results consolidated into a single `tool_results` ChatTurn so Gemini sees one user turn with multiple `functionResponse` parts.
  - `/api/argus/investigator` (9c) — `streamText` with forced function call → `generateStructured`. SSE `progress → draft → usage → done` wire format identical. `progress` event now fires once at start (Anthropic's input-token deltas don't have a Gemini equivalent); minor UX regression vs. the old streaming dots.
- Drop `@anthropic-ai/sdk` from `package.json`. `grep -rn '@anthropic-ai/sdk' .` returns zero hits outside `node_modules`.
- `.env.local.example`: `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`. `ARGUS_DEFAULT_DAILY_TOKEN_BUDGET` bumped 5M → 10M.
- Prompt caching dropped in v1 — Gemini's `cachedContents` has a 32K-token minimum that doesn't fit our ~1–2K system prompts. Note: net cost still lower thanks to Flash's lower base price.

### Wands (commit 2)

- 5 new structured-output tools in `lib/argus/tools/`:
  - `suggest-risk-matrix` (fast) — `{ likelihood, consequence, confidence, rationale, insufficient_input? }`.
  - `suggest-finding-severity` (fast) — same shape, scoped to inspection findings being escalated.
  - `suggest-verification-method` (fast) — picks one of `inspection | monitoring | audit_trend | re_interview | document_review`.
  - `assess-reportability` (smart, thinking auto) — `{ verdict, citation, confidence, rationale, threshold_met[] }` against 29 CFR 1904.7 (US) or RIDDOR Schedule 1/2/Reg 4/Reg 8 (GB).
  - `draft-capa-metadata` (smart, thinking auto) — `{ type, title, suggested_owner_role?, confidence, rationale }`.
- 5 new system prompts (`wand-*.md`) encoding SPEC §8 risk rubric, SPEC §10 verification methods, 29 CFR 1904.7 + RIDDOR Schedule 2 thresholds, and the CAPA type taxonomy.
- New `app/api/argus/wand/route.ts` — non-streaming JSON envelope (`{ ok, suggestionId, output, modelUsed, usage, cached, insufficient }`). Per-surface permission checks (`finding:escalate`, `capa:verify`, `capa:create`, etc.). Reportability has a 24h cache lookup keyed on `incident.updated_at` so unchanged incidents hit cache forever, not just for 24h. Zod-validates the model output as defence-in-depth.
- Reusable UI:
  - `<ArgusMagicWand>` — single discriminated-union component covering all five surfaces. Idle → loading → success (with surface-specific body) → outcome chip. `autoLoad` flag for the Reportability pane.
  - `<SuggestionCard>` — Accept / Edit / Reject row with cyan accent (`var(--argus-accent, #00D4FF)`); read-only variant with `Re-assess` button for Reportability.
  - `useArgusWand` — fetch hook around POST `/api/argus/wand`.
- Outcome action `app/(app)/argus-wand-actions.ts` — `acceptWandSuggestion` / `rejectWandSuggestion` flip `argus_suggestions.outcome` and write `activity_events` rows (`actor_kind='human'`, verbs `argus.wand_accepted | wand_edited | wand_rejected`).
- 5 mount points:
  - `components/incidents/wizard/step-2-details.tsx` — risk-matrix wand above the grid (originally planned Step 3 in the master plan, but the matrix lives on Step 2 in the actual code).
  - `components/inspections/finding-actions-card.tsx` — finding-severity wand below the resolve/escalate buttons. Informational only — escalation creates a fresh draft incident the user classifies; the wand provides a severity prediction so the user knows what they're committing to.
  - `components/capa/detail/verification-form.tsx` — verification-method wand next to the Method dropdown. Also flips the dropdown to a controlled component so Accept fills it programmatically.
  - `components/capa/capa-create-modal.tsx` — capa-metadata wand at the top of the form (only when context.kind === "investigation"). Type and Title flipped to controlled components.
  - `app/(app)/reports/osha-301/[incidentId]/page.tsx` and `app/(app)/reports/riddor-f2508/[incidentId]/page.tsx` — auto-loading reportability pane (`print:hidden`). Read-only.
- The reportability pane was originally planned for the OSHA-300 log table but moved to the per-incident pages — the 13-column print-friendly log row would balloon with an inline pane.
- Zero schema migration. Zero new RBAC keys. Reuses 9a's `argus_suggestions` (5 new `surface` strings) + `activity_events.actor_kind` + `argus:use`. Each wand's visibility gate combines `argus:use` + the surface's underlying write permission (`finding:escalate`, `capa:verify`, `capa:create`).

### Pre-merge

`pnpm build` clean (types check across all 22 modified files + new `lib/argus/llm/` + new wand route + UI). Live model smoke (Copilot in wizard, Investigator on `?tab=ai`, each wand on its surface) gated on `GEMINI_API_KEY` in `.env.local` — pre-merge step for the user.

---

## Workflow notes

Phase 6 polish + Phase 8 Settings + Phase 12 Auth & Onboarding + Phase 13 Site Setup OSHA + RIDDOR + Phase 9a Argus Foundation + Phase 9b Argus Copilot + Phase 9c Argus Investigator + Phase 9d Argus Magic Wands (Gemini pivot) shipped. Next per the roadmap: Phase 9e global side panel + Dashboard tiles → Phase 7 (global search backend, consumes the 6l shell) → Phase 10 (Safety Bulletin + wizard 3→4 step restructure). Every change that affects runtime behavior goes through a feature branch + PR per `.claude/rules/github-workflow.md`. Direct push to `main` is reserved for doc-only updates the user explicitly asks for.
