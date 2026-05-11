# Phase 10 — Safety Bulletins (demo-grade)

**Status:** drafted 2026-05-11
**Goal:** Add a standalone Safety Bulletins module — a "lessons learned" doc EHS authors after an investigation closes, published org-wide, viewable on a list page + dashboard widget. Demo-grade: no audience targeting, no acknowledgement tracking. Per IMS_PLANNING §6.4.3 + §12.2.16.
**Branch:** `feat/safety-bulletins` (off `main`)
**PR target:** `main`
**New deps:** none.
**Schema migration:** one new migration — `safety_bulletins` table + permission keys.

> **What this PR ships:**
> - One new module at `/bulletins` — list + create + view + edit pages.
> - One new top-level sidebar entry between **Reports** and **Admin**.
> - **Investigation integration:** when a Track-A investigation is closed, the detail page surfaces a "Draft a Safety Bulletin from this investigation" CTA (gated on `bulletin:create`). One click navigates to `/bulletins/new?from_investigation={id}`, where title + body are pre-filled from the investigation's findings + root-cause summary.
> - **Dashboard widget:** "Latest bulletins" card showing the 3 most-recent published bulletins org-wide.
> - **RBAC:** two new permission keys — `bulletin:create` (granted to ehs_manager + site_admin by default) and `bulletin:publish` (same defaults). Read is implicit for any signed-in org member (RLS = org_id match + status='published' OR created_by=auth.uid()).
> - **Soft-archive only** (`archived_at`); same retention story as Documents.

> **Not in this PR (deferred to Phase 10.5 / v2):**
> - **No audience targeting** — bulletins are org-wide in v1. No site / role audience picker, no `safety_bulletin_audiences` table.
> - **No acknowledgements** — no "I have read this" button, no `safety_bulletin_acknowledgements` table, no compliance dashboard tile. (IMS_PLANNING §6.4.3 lists these as full-spec; we'll add them as Phase 10.5 if the demo warrants.)
> - **No worker "unread bulletins" banner.**
> - **No "create toolbox talk" cross-link** (IMS_PLANNING §15.7 — that's a separate module that doesn't exist yet).
> - **No Argus integration** — the investigation-link CTA pre-fills from `investigations.root_cause_summary` and `investigations.findings` via plain SELECT, no model call. (An Argus "magic wand" on the bulletin compose page that drafts body from findings is a one-day follow-up using the Phase 9d wand framework. Easy to add if you want it in scope; pulled from v1 to keep the phase tight.)
> - **No Report Wizard "Step 4"** — the BUILD_STATUS line "wizard 3→4 step restructure" is dropped. Reason: bulletins describe lessons learned, which workers don't know at report time; authoring belongs after investigation closure. SPEC §15 gets a divergence note. Confirm before merge.
> - **No file attachments** beyond markdown links to documents that already exist in the Documents library.

---

## Why this scope

IMS_PLANNING §6.4.3 spec'd bulletins as a post-investigation module: "After a serious incident (usually Track A), the EHS team writes a one-page 'lessons learned' document and pushes it to all affected workers." It explicitly calls out an "Auto-suggest hook" that fires when a Track-A investigation closes — that's the integration point.

BUILD_STATUS.md framed Phase 10 as "Safety Bulletin step + wizard 3→4 step restructure," which would put bulletin authoring inside the Report Wizard. That conflicts with the spec: at report time the worker doesn't know root cause, doesn't have findings, and is mid-flow on a stop-the-bleeding workflow. The wizard reading produces empty drafts.

We're going with the spec reading. Phase 10 is a standalone module + an investigation CTA. The wizard restructure goes away.

Demo-grade scope (just author + list + view) matches Phase 7's pattern: ship the visible surface fast, defer audience-management + acknowledgement-tracking to a follow-up if the demo signals demand. The full IMS_PLANNING spec is recoverable in 10.5 — none of these v1 decisions paint us into a corner.

---

## Data model

### One new table

```sql
create table safety_bulletins (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references orgs(id) on delete cascade,
  source_incident_id       uuid references incidents(id) on delete set null,
  source_investigation_id  uuid references investigations(id) on delete set null,
  title                    text not null,
  summary                  text,                      -- 1-line tagline; nullable
  body                     text not null default '',  -- markdown
  status                   safety_bulletin_status not null default 'draft',
  created_by               uuid references profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  published_at             timestamptz,
  archived_at              timestamptz,
  constraint published_requires_timestamp
    check (status <> 'published' or published_at is not null)
);
create type safety_bulletin_status as enum ('draft','published','archived');
```

Indexes:
- `safety_bulletins_org_published_idx on (org_id, published_at desc) where archived_at is null and status = 'published'` — dashboard widget query.
- `safety_bulletins_org_status_idx on (org_id, status) where archived_at is null` — list-page filters.
- `safety_bulletins_source_inv_idx on (source_investigation_id) where source_investigation_id is not null` — to find "has a bulletin already been drafted from this investigation?" on the CTA.

RLS:
- `select`: `org_id = current_org() AND (status = 'published' OR created_by = auth.uid())` — published bulletins are visible to everyone in the org; drafts are visible only to their author.
- `insert`: gated on `bulletin:create` permission via the resolver.
- `update`: author can edit their own draft; `bulletin:publish` holders can publish or unpublish.
- `delete`: blocked (soft-archive only via `archived_at`).

### No audience / acknowledgement tables

Out of scope. Adding them later doesn't require touching `safety_bulletins`; the FKs go the other way (audience rows reference bulletin_id).

### Two new permission keys

In `lib/rbac/permissions.ts`:
```ts
"bulletin:create",
"bulletin:publish",
```

In the seeded role permission sets (`supabase/migrations/<existing>_seed_roles.sql` or equivalent):
- `worker`: nothing — read is implicit via RLS.
- `supervisor`: nothing — read-only.
- `ehs_manager`: `bulletin:create` + `bulletin:publish`.
- `site_admin`: `bulletin:create` + `bulletin:publish`.

---

## Routes & components

### Pages (Server Components by default)

| Path | What it does |
|---|---|
| `/bulletins` | List page. Filters: status (Published / My drafts / Archived). Empty state nudges "Bulletins surface lessons learned from closed investigations. Close a Track-A investigation to draft one." |
| `/bulletins/new` | Compose page. Server Component shell with a client `<BulletinComposer>`. Accepts `?from_investigation={id}` to pre-fill title + body. |
| `/bulletins/[id]` | Detail page. Read-only if status≠draft OR viewer≠author. Shows source-incident + source-investigation chips linking back. "Publish" button when status=draft (gated on `bulletin:publish`). "Archive" button when status=published. |
| `/bulletins/[id]/edit` | Edit page. Drafts only. Same composer component. |

### Components (new)

- `components/bulletins/bulletin-composer.tsx` — client form (react-hook-form + Zod). Fields: Title, Summary (optional), Body (markdown — plain `<textarea>` for v1; no rich editor). Buttons: Save draft / Publish (the latter gated on permission, disabled with tooltip if missing).
- `components/bulletins/bulletin-card.tsx` — list-row card. Title, summary, "Source: incident IR-### · investigation INV-###" line, published-by, published-at relative time.
- `components/dashboard/latest-bulletins-card.tsx` — dashboard widget. Top-3 published bulletins org-wide, "See all" → `/bulletins`. Empty state matches the rest of the dashboard tone.
- `components/investigations/bulletin-cta.tsx` — the post-investigation prompt. Renders only when: investigation status = `closed` AND incident track = `A` AND viewer holds `bulletin:create` AND no `safety_bulletins` row exists with this `source_investigation_id`. Renders inline at the top of the investigation Summary tab as a dismissible card.

### Server actions

`app/(app)/bulletins/actions.ts`:
- `createBulletin({ title, summary, body, source_incident_id?, source_investigation_id? })` — inserts, returns `{ id }`.
- `updateBulletin(id, { title, summary, body })` — drafts only; author-only.
- `publishBulletin(id)` — sets `status='published'`, `published_at=now()`. Gated.
- `archiveBulletin(id)` — sets `archived_at=now()`. Gated on `bulletin:publish`.
- `unpublishBulletin(id)` — sets `status='draft'`, `published_at=null`. Gated. (Recoverable in case of mistakes.)

All return the `{ ok: true, data } | { ok: false, error, fieldErrors? }` shape per project convention.

### Sidebar entry

`components/app-shell/nav-config.ts`:
```ts
{ href: "/bulletins", label: "Bulletins", icon: Megaphone, permission: undefined },
```
Position: between **Reports** and **Admin** (matches IMS_PLANNING §6.4.3 layout note). `permission: undefined` because read is implicit (any signed-in user sees the link; the page itself returns published-only content for non-authors via RLS).

### Dashboard widget mount

Add `<LatestBulletinsCard>` to the dashboard layout, in the right column under existing cards (or wherever the Argus Insight Tiles aren't — coordinate with `app/(app)/dashboard/page.tsx`'s existing grid).

---

## Investigation page integration

Edit `app/(app)/investigations/[id]/page.tsx` (Summary tab):

- Above the existing summary header, render `<BulletinCta />` (server component) when the gate conditions match.
- Gate is computed server-side: `closedAt != null && incident.track === 'A' && hasPermission('bulletin:create', siteId) && bulletinAlreadyExists === false`.
- If a bulletin already exists for this investigation, render a smaller "Bulletin drafted: 'Title here'" link card instead.

The pre-fill payload passed via `?from_investigation={id}` is unpacked server-side in `/bulletins/new`:
- Title: `"Lessons Learned — {incident.title}"` (or just `incident.title` if you prefer a tighter default).
- Body: a markdown skeleton:
  ```
  **Source incident:** {ref_code} — {title}
  **Site:** {site name}
  **Occurred:** {date}

  ## What happened
  {incident.description}

  ## Root cause
  {investigation.root_cause_summary}

  ## Findings
  {investigation.findings}

  ## What we're doing about it
  _(EHS to fill — list the CAPAs and any procedural changes.)_

  ## What every worker should do
  _(EHS to fill.)_
  ```
- Summary: left blank — EHS writes a 1-line tagline themselves.

PII concerns: `incident.description` may contain names (CLAUDE.md notes that Argus's redactor is defence-in-depth). The composer prompts the author to review for names before publishing. No automatic redaction in v1.

---

## Acceptance criteria

- [ ] Migration applies cleanly on a fresh DB and on top of the current `main` migration set.
- [ ] `worker` + `supervisor` users see the sidebar entry but get **only** published bulletins on `/bulletins`; their own drafts (they can't create any) don't appear.
- [ ] `ehs_manager` and `site_admin` users see a "New bulletin" button on `/bulletins` and can create + publish + archive.
- [ ] On a closed Track-A investigation, `ehs_manager` sees the `<BulletinCta />` card; on a closed Track-B/C investigation, the card does **not** render. Same for an in-progress investigation.
- [ ] Clicking the CTA → lands on `/bulletins/new` with title + body pre-filled per the markdown skeleton; submitting saves a draft.
- [ ] After publishing, the bulletin appears in the dashboard's "Latest bulletins" widget for all org members on next page load.
- [ ] Archiving removes a bulletin from the list page default filter and from the dashboard widget; it remains accessible by direct URL.
- [ ] The investigation page swaps the CTA card for a "Bulletin drafted: …" link card once a draft exists with `source_investigation_id` set.
- [ ] No console errors. No regressions in the existing investigation Summary tab.
- [ ] `pnpm build` passes; `pnpm db:types` regen reflects the new table + enum.

---

## Smoke test (will write `docs/smoke-test-phase10.md` during execution)

1. Sign in as `ehs@demo.local`. Navigate to a closed Track-A investigation in the seed. Confirm the bulletin CTA card renders at the top of the Summary tab.
2. Click "Draft a bulletin" → land on `/bulletins/new` with pre-filled title + body. Edit the body. Click "Save draft" → redirects to `/bulletins/{id}` (read view shows the draft).
3. Click "Publish" → `published_at` populated; status badge flips to Published.
4. Open the dashboard → "Latest bulletins" card shows this bulletin first.
5. Sign out, sign in as `worker@demo.local`. Navigate to `/bulletins` → the published bulletin appears in the list. Click → detail page renders read-only. No "Edit" / "Publish" / "Archive" buttons visible.
6. Sign back in as `ehs@demo.local`. Open the bulletin's detail page → click "Archive". Confirm it disappears from `/bulletins` (default filter) and from the dashboard widget. Confirm direct URL still renders the detail page with an "Archived" badge.
7. Return to the closed Track-A investigation. CTA card now shows "Bulletin drafted: 'Title'" linking to the archived bulletin's detail page. (Existence check is on archived rows too — a single bulletin per investigation in v1.)
8. Create a second draft from the same investigation — `<BulletinCta />` still renders for `ehs_manager` because the gate checks for **non-archived** bulletins only. (Or: tighten the gate to "any draft exists" — confirm preference during execution.)
9. RLS leak test: as `worker@demo.local`, try `GET /api/...` to fetch a draft directly. Confirm 404 or empty.
10. Markdown rendering test: paste markdown body with headings + lists + links → detail page renders them correctly (use the existing markdown renderer if one exists — otherwise just `<pre>` for v1; flag during execution).

---

## Open questions to resolve during execution

- **Markdown renderer:** does the codebase already include one (`react-markdown`? `remark`?)? If not, do we add one (small dep) or render `<pre>` in v1? Default plan: check first, add `react-markdown` only if no existing path. (Likely small enough to justify.)
- **`<BulletinCta />` re-display rule:** once a draft exists, hide the CTA permanently, or always show "Draft another"? Default plan: hide if **any non-archived** bulletin references this investigation; revisit if the demo wants multiple bulletins per investigation.
- **Argus magic wand on the composer:** declined for v1. If you want to add it, it's a new `surface: 'draft_bulletin_body'` on `<ArgusMagicWand>` powered by the 9d wand framework — one prompt-cache miss + one structured-output schema. ~80 LOC. Easy follow-up; not a blocker.

---

## Risks

- **Investigation `findings` column is markdown-free text** — pre-fill skeleton inserts it as a paragraph. If a future migration normalizes findings into a structured shape, the skeleton template will need a re-render. Cheap fix: a single `lib/bulletins/seed-from-investigation.ts` helper centralizes the markdown skeleton so changes happen in one place.
- **No PII redaction on pre-fill** — author is responsible. Add a `<p className="text-sm text-muted-foreground">Review for personal names before publishing.</p>` line above the body field on the composer.
- **Soft-archive vs hard-delete confusion** — Archive = `archived_at`; "delete" doesn't exist for bulletins. The UI uses the word "Archive" exclusively. Aligns with Documents and matches the project's append-only retention philosophy.
- **`source_incident_id` set to NULL when an incident is hard-deleted** — Incidents are soft-delete only per CLAUDE.md hard rules, but `on delete set null` is a defence-in-depth choice. Same pattern as `documents.uploaded_by`.
- **Adding a sidebar entry shifts the nav** — make sure the existing 6k pin/hover-drawer state survives the addition (it should — the rail is height-flexible).
- **Permission migration in production** — Phase 11c shipped the user-facing role editor, so any org admin who customized their role permission sets will need to manually add `bulletin:create` / `bulletin:publish` to non-default roles. The seed migration only handles the four default roles; this is a known v1 limitation of role-editor + permission additions, not Phase-10-specific.
- **The IMS_PLANNING §6.4.3 spec mentions a worker-facing "Unread bulletins" dashboard banner.** We're deferring it to 10.5. Phase 10 still ships a value to workers (the list page + the dashboard "Latest" widget), so workers aren't blind to bulletins — they just don't get a nudge.

---

## Out of scope (revisit in Phase 10.5)

- **Audience targeting**: `safety_bulletin_audiences (bulletin_id, scope_kind {site|role|all}, scope_value)`. Filters the dashboard widget + list page per viewer's site/role.
- **Acknowledgements**: `safety_bulletin_acknowledgements (bulletin_id, profile_id, acknowledged_at)` with an "I have read this" button on the detail page. Dashboard manager tile: "Bulletin acknowledgement rate" — percent of audience that has confirmed reading the latest bulletin.
- **Worker "you have N unread bulletins" banner** on the dashboard.
- **Argus draft-from-findings wand** on the composer.
- **Cross-link to Toolbox Talks** (out of scope until that module exists — IMS_PLANNING phase 11).
- **File attachments via Documents library** linked from a bulletin (we already have polymorphic `document_links`, so this is a small extension — added when the demo asks for it).
- **Markdown WYSIWYG editor**. Plain textarea is fine for v1.
