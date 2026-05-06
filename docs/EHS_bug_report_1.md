# EHS Platform — Bug Report

**Target:** `http://localhost:3001` (EHS Incident Management, v0.1 · Phase 0)
**Tested:** 2026-05-06
**Browser:** Chrome (via Claude in Chrome extension)
**Accounts used:** demo Site Admin (`admin@demo.local`), demo EHS Mgr. (`ehs@demo.local`)

Console / network were clean — no JS errors, all asset and page requests returned 200/304. All bugs below are functional / UX issues observed against the running UI.

---

## Critical

### C1. "Open 301 form" button is a dead link (404)

* **Where:** Investigation detail (e.g. `/investigations/76bc886a-…`), top yellow banner — the purple **Open 301 form** button.
* **What happens:** href is `/reports/osha-301/<incidentId>`. Visiting that URL renders the Next.js 404 page.
* **Why it matters:** The banner explicitly says *"OSHA 301 due in 2 days. Per OSHA §1904.29(b)(3), Form 301 must be completed within 7 calendar days of the incident."* The whole regulatory CTA leads to a dead page — high-visibility broken promise of the product.

### C2. "Open" status filter on `/incidents` excludes Awaiting CAPA

* **Where:** `/incidents`, status pill **Open**.
* **What happens:** The link is hard-coded to `?status=under_investigation`. Result: only 3 records are shown. Three additional non-closed records (`status=awaiting_capa`) are hidden from the "Open" view, even though they are not closed.
* **Repro:** click `Open` (3 rows) vs. visit `/incidents?status=awaiting_capa` (3 more rows that should also be "open").
* **Why it matters:** Awaiting-CAPA incidents are exactly the ones a manager needs to chase. A safety triage tool that hides them under "Open" is a real correctness bug.

---

## High

### H1. Site Admin demo account displays role as "Worker"

* **Where:** Sidebar footer (`Alex Admin · Worker`) and user-avatar dropdown (`Alex Admin / admin@demo.local / Worker`).
* **What happens:** Logging in via the **Site Admin** demo button produces a session whose displayed role label is `Worker`. Same for the **EHS Mgr.** demo (`Erin Manager … Worker`).
* **Why it matters:** Looks like a role-resolution / display bug. At minimum the label is wrong and confusing; at worst the session is actually being assigned a worker role rather than the role the demo button advertised.

### H2. Display IDs (`INC-2026-0001`) don't work as URLs

* **Where:** Anywhere a user might want to share / bookmark an incident.
* **What happens:** The list shows human-readable refs like `INC-2026-0001`, but the detail URL is `/incidents/<uuid>`. `/incidents/INC-2026-0001` 404s.
* **Why it matters:** Direct linking, copy-paste of refs into Slack/email, deep-linking from external systems — all broken.

### H3. Wizard hard-blocks any user without a site assignment

* **Where:** `/incidents/new/1` → Continue to Step 2.
* **What happens:** Step 1 submits with the error `No site selected.` even when all required fields (event type, title, when, area, description) are filled. Affects every demo account except possibly Worker (all four demo accounts show "No site assigned" in the header).
* **Why it matters:** Practice mode (sandbox) is advertised as a "real-feeling report without affecting KPIs" and is linked from the Help panel, but the demo seed leaves accounts with no site, so even sandbox submissions are impossible. The wizard should either let sandbox bypass the site check or auto-assign a default site to demo users.

### H4. Column-header sort doesn't work

* **Where:** `/incidents` — table headers (Ref / Type / Title / Occurred / Severity / Track / Status / Reporter).
* **What happens:** The page tagline says *"Filter, sort, and triage from here"*, but clicking any column header has no effect. Headers are not interactive (no cursor change, no `aria-sort`, no URL update).
* **Why it matters:** Documented feature is missing.

---

## Medium

### M1. Investigation tabs swallow first click after route compile

* **Where:** Investigation detail tabs (Summary / 5-Why / Evidence / Findings / Timeline).
* **What happens:** First click on a tab right after the page mounts/compiles has no effect (URL doesn't update, content doesn't switch). A second click — or direct navigation to `?tab=…` — works fine.
* **Likely cause:** Next.js dev "Compiling…" indicator was visible during the click; the dev-mode chunk for the target route hadn't loaded yet, so the `<Link>` click was eaten. Should be retested on a production build to confirm whether it persists outside dev.

### M2. Evidence tab promises an upload control that isn't there

* **Where:** Investigation detail → Evidence tab (empty state).
* **What happens:** Empty state reads *"No evidence yet — upload photos, maintenance logs, SDS sheets, or PDF reports."* — but there is no upload button, no drop zone, no input. Nothing on the page is interactive in this state.
* **Why it matters:** Misleads users into thinking the feature works.

### M3. Incident row click target is just the title

* **Where:** `/incidents` table.
* **What happens:** Only the title cell is a link; clicking elsewhere on the row (Ref, Type icon, Severity pill, etc.) does nothing. The cursor doesn't even change to a pointer outside the title.
* **Why it matters:** Standard data-table pattern is whole-row click. Current behavior is hit-or-miss and harms scanability.

### M4. Investigation header says "Pending Assignment / 0 members" while incident card claims "Lead: Erin Manager"

* **Where:** `/incidents/<uuid>` (incident detail) shows *Investigation: INV-2026-0001 · pending assignment · Lead: Erin Manager · Due: 2026-05-19*. The corresponding `/investigations/<uuid>` page shows *Pending Assignment* in the title and *Team: 0 members · No team members yet.* in the right rail.
* **Why it matters:** Two views disagree on whether a lead has been assigned. Either the incident card is showing stale/seed data or the investigation page is failing to render the lead.

### M5. Wizard form state is reset on validation failure

* **Where:** `/incidents/new/1` after clicking Continue and getting "No site selected".
* **What happens:** All previously entered fields (Short title, Area, etc.) appear cleared on the next render; the user has to retype.
* **Why it matters:** Painful for any first-time reporter who hits any server-side validation.

---

## Low / cosmetic

### L1. Next.js dev-tools "N" badge overlaps the sidebar user info

* **Where:** Bottom-left of every authenticated page.
* **What happens:** The dark round Next.js dev indicator sits on top of the user name + role label (e.g. partially covers "Alex Admin / Worker"). On collapsed sidebar it overlaps the `E` brand mark.
* **Note:** This is a Next.js dev-only artifact; it disappears in production builds. Worth noting if you ever screenshot the dev build for a demo.

### L2. Version banner inconsistency

* **Where:** Sidebar header shows `v0.1 · Phase 0`. Help panel footer shows `EHS Operations Platform · v0.2 · Phase 2`.
* **Why it matters:** Two version strings shipping in the same render — pick one and propagate.

### L3. Reports / CAPA / Investigations all show generic "You don't have access" copy

* **Where:** `/reports`, `/capa`, `/investigations` for accounts with no site.
* **What:** The empty state and the "no access" state look identical. A user genuinely lacking a role gets the same message as a user whose tenant just isn't seeded. Consider distinguishing "no site assigned to your account → contact admin" from "you don't have permission".

### L4. Sidebar shows only "Dashboard" — discoverability of the other modules is zero

* **Where:** Left nav, all roles tested.
* **What:** The app actually has `Incidents / Investigations / CAPA / Reports / Admin` modules, but only `Dashboard` is exposed in the sidebar. They are reachable only by typing URLs or by following links from the help panel and from inside an incident.
* **Note:** This may be intentional for Phase 0, but it makes the app feel broken on first login.

### L5. `/incidents/new/1` "Practice mode" toggle is disabled and not sandbox-capable for demo users

* `Practice mode (sandbox)` checkbox is present, but ticking it does not bypass the `No site selected` server-side check. So even the documented sandbox path is unusable for the bundled demo accounts.

---

## Things that did work correctly

To keep the report balanced:

* No console errors and no failed network requests across all visited pages.
* Severity filters S1 / S2 work and combine cleanly with status filters via querystring.
* `Closed` status filter works.
* Investigation tabs (`?tab=why|evidence|findings|timeline`) all render their respective UIs when navigated directly.
* OSHA 301 deadline math is correct (incident 5/1, today 5/6, "due in 2 days" → 5/8 = +7 calendar days).
* `← Investigations` back link, Help drawer, Notifications popover, sandbox query toggle (`Show sandbox`), and the user dropdown all work.
* Empty/missing-draft state on `/incidents/new/2` and `/incidents/new/3` is handled gracefully ("Missing draft id — start over from Step 1.").

---

## Suggested priorities

1. **C1** OSHA 301 form route — ship the page or remove the CTA.
2. **C2** Fix the "Open" filter to mean `status != closed`.
3. **H1** Verify whether the role display is just a label bug or a real RBAC bug — RBAC bugs are scary in a regulatory tool.
4. **H3 / H4** Either ship the missing functionality (sortable headers, sandbox bypass) or remove the copy that promises them.
5. **M2 / M4** are small but visible — empty Evidence state needs an upload control, and the lead/team mismatch needs reconciling.
