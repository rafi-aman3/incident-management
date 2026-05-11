# Phase 10 smoke test — Safety Bulletins

Run after pulling `feat/safety-bulletins`. Assumes seeded UCB org + `pnpm dev` running on `http://localhost:3000`.

## 1. Permissions & sidebar

- [ ] Sign in as `worker@demo.local`. Sidebar shows "Bulletins" between Reports and Admin. Click → `/bulletins` renders with the "No bulletins published yet" empty state. **No "New bulletin" button.**
- [ ] Sign out, sign in as `ehs@demo.local`. Sidebar shows the same entry. `/bulletins` page has a **"New bulletin"** button top-right.

## 2. Investigation CTA — gate

- [ ] As `ehs@demo.local`, find a **closed Track-A** investigation in the seed (or close one if none exists). Open `/investigations/{id}` → Summary tab shows a purple-tinted card: "Share what you learned … Draft bulletin".
- [ ] Open a **closed Track-B** or **Track-C** investigation → CTA card does **NOT** render.
- [ ] Open an **in-progress** investigation (any track) → CTA card does **NOT** render.
- [ ] Sign in as `worker@demo.local`, open the same closed Track-A investigation → CTA does **NOT** render (no `bulletin:create`).

## 3. Author from investigation

- [ ] As `ehs@demo.local`, click "Draft bulletin" on the Track-A investigation. Land on `/bulletins/new?from_investigation={id}`.
- [ ] Confirm title is pre-filled as `Lessons Learned — {incident title}`.
- [ ] Confirm body has the markdown skeleton: source-incident line, site, occurred, then `## What happened` / `## Root cause` / `## Findings` / `## What we're doing about it` / `## What every worker should do`.
- [ ] Edit the body. Add a 1-line summary. Click **"Save draft"** → redirects to `/bulletins/{id}` (read view, "Draft" badge).
- [ ] Refresh the investigation page → CTA card swapped for "Bulletin drafted: …" link.

## 4. Publish flow

- [ ] On the draft detail page, click **"Publish"** → status badge flips to Published. Click → no error toast.
- [ ] Open the dashboard → "Latest safety bulletins" section appears with this bulletin at the top.
- [ ] Open `/bulletins` → bulletin appears in "Published" filter.

## 5. Worker read-only

- [ ] Sign in as `worker@demo.local`. Open the dashboard → "Latest safety bulletins" widget visible. Click the bulletin → detail page renders. No Edit / Publish / Unpublish / Archive buttons visible.
- [ ] `/bulletins` "Published" filter shows the bulletin. "My drafts" filter is empty (worker can't author).
- [ ] Markdown body renders with headings + paragraphs (not raw text).

## 6. Edit + publish from edit

- [ ] As `ehs@demo.local`, create a fresh bulletin from scratch (no `?from_investigation`) at `/bulletins/new` — Title "Test bulletin", body "Hello world". Save draft.
- [ ] On the detail page, click "Edit". Update the title to "Test bulletin v2". Click "Save & publish" → redirects to detail with status=Published and updated title.

## 7. Archive

- [ ] On any published bulletin's detail page, click "Archive". First click shows "Archive?" confirm; second click archives. Status badge flips to Archived.
- [ ] Open `/bulletins` (Published filter) — bulletin gone.
- [ ] Switch to "Archived" filter — bulletin appears.
- [ ] Direct URL `/bulletins/{id}` still resolves and shows Archived badge.
- [ ] Dashboard widget no longer shows the archived bulletin.

## 8. Unpublish

- [ ] Publish a bulletin. On its detail page, click "Unpublish". Confirm. Status flips to Draft. Bulletin disappears from the dashboard widget. Reappears under "My drafts" for the author.

## 9. RLS leak test

- [ ] `ehs@demo.local` creates a draft bulletin. Stay on the detail page.
- [ ] In another browser/incognito, sign in as `worker@demo.local` and visit `/bulletins/{id}` for the draft → expect 404 (or "not found") because RLS only exposes published/archived rows to non-authors.
- [ ] As `worker`, the dashboard widget never shows draft rows even if they're recent.

## 10. CTA re-display after archive

- [ ] As `ehs@demo.local`, archive the bulletin sourced from the Track-A investigation. Reopen `/investigations/{id}` Summary tab.
- [ ] CTA card **returns** to "Draft bulletin" state (existence gate is non-archived only).
- [ ] Click → drafts a second bulletin. After saving, the "Bulletin drafted" swap returns.

---

Known limitations (by design — see `plans/10-safety-bulletins.md` deferrals):

- No audience targeting (site / role filters). All published bulletins are visible to every org member.
- No "I have read this" acknowledgement tracking.
- No worker "N unread bulletins" dashboard banner.
- No Argus magic-wand on the composer; the pre-fill is a plain SQL skeleton.
- No file attachments via the documents library.
- Markdown body uses default `react-markdown` set — headings, lists, links, emphasis, code, blockquotes. No raw HTML, no images.
- Edit-while-published flow requires Unpublish → Edit → Republish (intentional — protects against silent edits to published org-wide notices).
