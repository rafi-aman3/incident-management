# Phase 6j — Admin polish

**Status:** drafted 2026-05-06 (Phase 6 module 10 of 10 — last)
**Goal:** Admin surfaces are seen rarely but are decision-critical when they ARE seen. The site-setup wizard must work cold (a brand-new admin lands here on first sign-in and gets a site stood up). The demo affordances at `/admin/demo` must be unambiguous (reset / sample-load / trigger-banner clearly do what they say). The admin landing must surface what an admin is most likely to need without burying it.
**Branch:** `feat/phase-6-admin-polish`
**PR target:** `main`
**Pages covered:** `/admin`, `/admin/demo`, `/admin/site-setup` + `/admin/site-setup/[step]`

> **What this PR ships:**
> - Audit + fixes per the 10-item checklist.
> - Site-setup wizard hardening (per-step server actions; refresh-survives; back button works).
> - `/admin/demo` affordance polish: reset confirms with org name typed; sample-load shows "<N> records will be created"; trigger-banner pre-fills realistic content.
> - Admin landing: surface most-likely actions (member invite, role edit, site setup, demo reset) without burying.
> - Onboarding pathway pickers honored on first dashboard render (cross-references `/dashboard`).

> **Not in this PR:**
> - **No new admin pages.** Member-invite UI may be missing — if so, log as v2 unless it's a sub-30-min fix.
> - **No new audit-trail viewer.** v2.
> - **No org settings page.** v2 (settings live ad-hoc in admin landing for v1).
> - **No SSO / SCIM / IDP integration.** v2.

---

## Pages

### 1. `/admin` (admin landing)
The landing for `site_admin` role. Surfaces: site list, member list, role list, demo affordances pointer, audit pointer.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Card grid of admin sections; brand purple on "Invite member" primary CTA | |
| 2. Empty state | TBD | Org-fresh: "Set up your first site" CTA → `/admin/site-setup`. "Invite your first member" CTA. | |
| 3. Loading state | TBD | Skeleton sections | |
| 4. Error state | TBD | RLS denial on a section (non-admin viewer): "You need <perm> to view this" inline | |
| 5. Responsive | TBD | sm: cards stack | |
| 6. A11y / keyboard | TBD | Section keyboard-navigable | |
| 7. Form-error UX | TBD | If invite-member is inline-form (vs. modal), validate email + role assignment | |
| 8. Copy | TBD | Section labels match what they DO not what they ARE ("Invite people to your org" not "Members") | |
| 9. Dark mode | TBD | | |
| 10. Cache Components | TBD | Per-org cache; revalidate on member / role change | |

**Likely small gaps:**
- Member invite — magic-link via email? confirm flow exists; if not, log as v2.
- Role editor — does the perm-checkbox grid render correctly for the 4 default roles? Custom roles created here?
- Site list — links to `/admin/site-setup/<step>` for editing existing site, or distinct edit page?
- Demo affordances pointer — clear "this is for demos only" warning in non-demo orgs (`is_demo = false` should hide this entirely).
- Audit-trail link — if no `/admin/audit` page exists, hide or log v2.
- Org-info section: name, industry, plan tier (placeholder for v2 billing).

### 2. `/admin/demo` (demo affordances)
Sandbox surface guarded by `orgs.is_demo = true`. Affordances: **Reset demo data** · **Load sample data** · **Trigger banner** (manually fire a regulatory banner for testing).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Yellow banner: "DEMO ORG — actions here only affect this demo workspace"; danger-zone styling on Reset | |
| 2. Empty state | n/a | | |
| 4. Error state | TBD | Reset failure: which step failed; safe to retry? | |
| 6. A11y / keyboard | TBD | Confirm modals trap focus; type-org-name guard reachable | |
| 7. Form-error UX | TBD | Reset confirm: type org name (e.g., "UCB") to enable; mismatch disables submit | |
| 8. Copy | TBD | Each affordance: 1-line "what this does" + 1-line "consequence" | |

**Likely small gaps:**
- **Reset confirm:** text input "Type 'UCB' to confirm" — disable submit until match. Per `feedback_brand_color.md` precision style.
- **Sample-load preview:** "This will create approximately <N> incidents, <N> inspections, <N> documents". Audit the seeded counts vs. shipped reality.
- **Trigger-banner:** dropdown of regulatory kinds (OSHA-fatality / OSHA-amputation / RIDDOR-immediate / etc.); runs notifications.fire(...) for the kind.
- **Visibility:** entire `/admin/demo` route gated by `is_demo`; non-demo orgs hitting this URL get a 404 or "not available" notice.
- **Activity log:** every demo action logs to `activity_events` so the audit trail shows the demo manipulation.
- **Twice-daily Vercel Cron:** sandbox-cleanup runs twice-daily UTC; surface "Last cleanup: <when>" so demo team knows when stale data clears.

### 3. `/admin/site-setup` and `/admin/site-setup/[step]` (multi-step wizard)
Step layout (`app/(app)/admin/site-setup/layout.tsx`) wraps the per-step pages. Step content covers: org info → first site → site hierarchy → invite first member → done.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Step pill row top; primary purple on "Next"; secondary on "Back" | |
| 2. Empty state | TBD | Step 1 entry: pre-populated with org name from signup if available | |
| 3. Loading state | TBD | First-step load creates draft state? Or persists per-step on Next? Confirm pattern matches Wizard. | |
| 4. Error state | TBD | Per-step server action error: field-level + form-level | |
| 5. Responsive | TBD | sm: step pills wrap; form fields full-width | |
| 6. A11y / keyboard | TBD | Tab order through steps; ESC doesn't kill the wizard | |
| 7. Form-error UX | TBD | Per-step: validate before allowing Next; back is always allowed | |
| 8. Copy | TBD | Step pill labels: short verbs ("Org info" / "First site" / "Hierarchy" / "Invite") | |
| 9. Dark mode | TBD | Step pill states (current / done / pending) | |
| 10. Cache Components | TBD | Wizard never cached (per-user state) | |

**Likely small gaps:**
- **Refresh survival:** kill the tab on Step 2 → reopen → land on Step 2 with state. Verify per-step server actions persist correctly.
- **Skip vs. complete:** can the user skip "Invite first member"? If yes, "Skip" affordance + "You can do this later from /admin".
- **Hierarchy step:** UI for `parent_site_id` should be a tree picker, not a free-text input.
- **Pathway picker:** at the end (or beginning), user picks pathway from `report_incidents` / `run_inspections` / `manage_assets` / `compliance_reports` / `manage_documents` (per `CLAUDE.md`). Persists to user prefs and personalizes dashboard.
- **Done step:** clear "What's next" with deep-links: "Browse template presets" / "File a test incident in sandbox" / "Invite teammates" / etc.
- **Re-entry:** what happens if an admin who already completed setup hits `/admin/site-setup`? Either redirect to `/admin` or show a "You've completed setup" landing with "Edit anyway" affordance.

---

## Definition of done — Admin PR

1. 10-item checklist passes for all 4 admin pages (incl. layout).
2. Site-setup wizard refresh-survives at every step.
3. Demo reset requires type-org-name confirmation.
4. Demo affordances hidden in non-demo orgs (404 or notice).
5. Admin landing surfaces "most-likely-next" actions without burying.
6. Pathway picker honored on first dashboard render.
7. Member invite flow exists OR is logged in `docs/SPEC.md` §15 with v2 deferral note.
8. Smoke-test guide for admin flow documented (currently absent — add as `docs/smoke-test-admin.md` ~5-step walkthrough).
9. PR description includes:
   - Site-setup walkthrough screen recording (cold start to done).
   - Demo reset confirm UX before/after.
   - Before/after for admin landing.

---

## Phase-6 closeout (after this PR merges)

After the Admin PR merges, Phase 6 is complete. Update:
- `CLAUDE.md` build-status block: add 1 line per merged module PR plus a closing line "V1 polish-complete. Surfaces audited and fixed across all 35 routes."
- `docs/SPEC.md` §15: ensure all 10 deferred-to-v2 entries are logged.
- `MEMORY.md` or `project_overview.md`: bump status to "V1 feature-complete and polished, ready for stakeholder cycle 2".
- `plans/06-frontend-polish.md`: add a "Closed" status line + summary of merged PRs.
