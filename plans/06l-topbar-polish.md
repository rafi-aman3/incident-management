# Phase 6l — Topbar polish (search shell + responsive + profile menu)

**Status:** drafted 2026-05-07 (Phase 6 module 12 — added post-hoc, follows 6k)
**Goal:** Tighten the topbar to a real SaaS shell. Drop the redundant sidebar toggle on desktop, add a Cmd+K-style search trigger in the centre, expand the profile dropdown with Settings + Members links, and add a hamburger that opens the sidebar as a sheet on tablet-portrait + phone widths.
**Branch:** `feat/phase-6-topbar-polish` (off `main`)
**PR target:** `main`
**Pages affected:** All app pages — `components/app-shell/topbar.tsx` renders globally inside `app/(app)/layout.tsx`. Two new stub routes: `/settings` and `/members`.

> **What this PR ships:**
> - **Removes** the desktop sidebar collapse/expand toggle. Phase 6k's pin + hover-drawer model replaces it; the icon was dead weight on `lg+`.
> - **Adds a centred search trigger** — `<button>` styled as a SaaS-standard search input ("Search…  ⌘K") that opens a `<Dialog>` modal. **The modal is a UI shell only** — no query input, no results, no keyboard shortcut wiring yet. Modal body shows a "Coming soon — global search lands in Phase 07" placeholder. Phase 07 will hydrate it.
> - **Expands the profile dropdown** (rightmost in the topbar) with two new entries: `Settings` and `Members`, both routing to stub pages. Order: profile header → `Settings` → `Members` → separator → `Sign out`.
> - **Stub routes** at `/settings` and `/members` rendering a placeholder card ("Settings page lands in Phase 08" / "Members page lands in Phase 08"). Both are wrapped in the existing `(app)/layout` shell so the topbar + sidebar render around them. No permission gates beyond the existing layout-level auth check; Phase 08 will add the real RBAC.
> - **Responsive shell**: at viewport width `< lg` (1024px) the sidebar hides and a hamburger button appears at the **left** of the topbar. Clicking it opens the sidebar as a shadcn `<Sheet>` overlay (existing primitive behavior). At `lg+` the hamburger is hidden and the sidebar is back to the 6k pin-or-hover-drawer rail.
> - 6l polish-checklist sweep on the topbar surface only — search trigger keyboard-focusable, dropdown items get proper icons (`Settings`, `Users`, `LogOut`), dropdown order matches the rest of the app's menus (header → primary nav items → separator → destructive action).

> **Not in this PR (deferred):**
> - **No working search.** The modal is a shell. Indexing, query input, results pane, navigation-on-select, recent searches, and the actual `⌘K` / `Ctrl+K` keyboard shortcut all land in **Phase 07**.
> - **No real Settings or Members pages.** The stub routes exist so the dropdown items go somewhere, but the page bodies are placeholder cards. Real content lands in **Phase 08**.
> - **No team-member invite flow, role editor, profile edit form** — all Phase 08.
> - **No notification-bell or help-drawer changes** — they stay where 6a left them.
> - **No site-switcher changes** beyond making sure it doesn't collide with the new search trigger on narrow widths (it's already responsive).
> - **No telemetry on dropdown clicks or search-trigger clicks.**

---

## Why this scope

Three problems with the current topbar:

1. **The sidebar trigger on the left is now redundant on desktop.** Phase 6k introduced pin + hover-drawer, so the user no longer needs a topbar button to toggle the sidebar — they hover the rail or click the in-sidebar pin. The trigger still ships, taking visual weight without earning it.
2. **There's no search.** Every SaaS app of comparable shape (Linear, GitHub, Vercel, Notion) has a centre-topbar search. The current shell has none. Even an inert shell signals "search is a thing here" and reserves the layout slot so 07 doesn't have to renegotiate the topbar geometry.
3. **The profile menu is a single sign-out button.** Two of the most-requested settings surfaces (workspace settings and team members) have no entry point, so users hunt for them. Adding the entries now — even pointing at stubs — fixes the discovery problem and gives 08 a stable target route to fill in.

And one separate concern:

4. **The app is unusable at iPad-portrait widths and below.** The fixed sidebar rail eats too much of a 768px viewport. We need the standard hamburger pattern below `lg`. shadcn's sidebar primitive already supports this via `<Sheet>` mode when `useIsMobile` returns true; we just need to point the hook at the right breakpoint and surface the trigger.

---

## Audit — what's there now

`components/app-shell/topbar.tsx` (47 lines):

```
<header sticky top-0 z-30 ...>
  <SidebarTrigger className="-ml-1" />          ← always rendered, redundant on lg+
  <Separator vertical />
  <SiteSwitcher />
  <div ml-auto>
    <HelpDrawer />
    <NotificationBell />
    <UserMenu />                                  ← only "Sign out"
  </div>
</header>
```

No search. No responsive logic on the topbar. The middle is empty space pushed to the right by `ml-auto`.

`components/app-shell/user-menu.tsx`: dropdown has `DropdownMenuLabel` (name/email/role) → `Separator` → single `DropdownMenuItem` wrapping a `<form action={signOut}>`.

`hooks/use-mobile.ts`: `MOBILE_BREAKPOINT = 768`. The shadcn sidebar primitive consumes this hook; below that width it renders as a `<Sheet>` opened by `SidebarTrigger`'s `toggleSidebar()`. Above it, it's the inline rail.

Implication: if we **bump** `MOBILE_BREAKPOINT` to **1024**, the entire shadcn sidebar primitive flips to Sheet mode at `< lg`, and `SidebarTrigger` automatically becomes the hamburger that opens the sheet. No new component required — just visibility wiring.

`components/app-shell/sidebar-shell.tsx` (Phase 6k): pin/hover state runs on top of `<SidebarProvider>`. We need to verify that the pin/hover overlay logic gracefully no-ops on mobile (it should — `SidebarProvider`'s mobile branch uses `openMobile` state, not `open`). Plan calls for an explicit smoke check.

Two callers of `SidebarTrigger` in app code: `topbar.tsx` only (no others — `grep` confirmed).

---

## Behavior matrix

| Viewport | Hamburger (left of topbar) | Search trigger (centre) | Sidebar |
|---|---|---|---|
| **`lg+` (≥ 1024px)** | Hidden | Visible (max-w ~520px, centred) | 6k rail (pinned or hover-drawer) |
| **`md` … `lg-` (768–1023px)** | Visible | Visible (shrinks, max-w ~360px) | Hidden inline; shadcn `<Sheet>` opens via hamburger |
| **`< md` (< 768px)** | Visible | **Hidden** — too cramped; defer to a search icon-button that opens the same modal | Hidden inline; `<Sheet>` overlay |

Open trade-off, flagged for review: at `< md` we could keep the search bar shrunken instead of swapping to an icon. I'm recommending icon-only because the SiteSwitcher + NotificationBell + UserMenu already crowd the right side, and a too-narrow search input degrades to a non-interactive sliver. **Proposing a `<Search />` icon-button at `< md` that opens the same `<Dialog>`.** Confirm or override.

---

## Component changes

### 1. `components/app-shell/topbar.tsx` (edit)

- Wrap the existing `SidebarTrigger` in `lg:hidden` so it disappears on desktop. (It still renders on `< lg` and triggers Sheet mode because the breakpoint bump puts the sidebar primitive in mobile mode there.)
- Insert `<SearchTrigger />` between the `SiteSwitcher` and the right-side cluster, with `mx-auto` + responsive max-widths.
- No prop changes; `topbar.tsx` is server-rendered, so the search trigger is the only new client island.

### 2. `components/app-shell/search-trigger.tsx` (new, ~60 lines, client)

- Button styled as a search input: rounded, muted bg, search icon left, "Search…" placeholder text, `⌘K` kbd badge right (rendered via `<kbd>` styled with the existing token).
- Click opens a `<Dialog>` (shadcn) — content is a placeholder card: "Global search · Coming soon. This shell ships in Phase 6l so the geometry is locked; Phase 07 hydrates the search backend, query input, and results pane."
- **No keyboard shortcut wiring** — the kbd badge is decorative. (07 wires it.) Document explicitly in the JSX so the next reader doesn't break it.
- At `< md`, render an icon-only variant (square `<Button variant="ghost">` with `<Search />`) that opens the same dialog. Toggle via Tailwind responsive classes inside one component, not two.

### 3. `components/app-shell/user-menu.tsx` (edit)

Add two `DropdownMenuItem`s between the existing profile-header label and the `Sign out` row:

```
<DropdownMenuItem asChild>
  <Link href="/settings"><Settings className="h-4 w-4" /> Settings</Link>
</DropdownMenuItem>
<DropdownMenuItem asChild>
  <Link href="/members"><Users className="h-4 w-4" /> Members</Link>
</DropdownMenuItem>
<DropdownMenuSeparator />
{/* Sign out as before */}
```

Icons from `lucide-react` (`Settings`, `Users`). No permission gating yet — Phase 08 adds `if (can('member:invite', siteId))` or similar.

### 4. `app/(app)/settings/page.tsx` (new, stub)

Placeholder page rendering a single `<Card>`: "Settings · Coming in Phase 08". No client logic. Returns inside the existing `(app)/layout` so topbar + sidebar render around it.

### 5. `app/(app)/members/page.tsx` (new, stub)

Same shape — placeholder card. "Members · Coming in Phase 08".

### 6. `hooks/use-mobile.ts` (edit, 1-line)

Bump `MOBILE_BREAKPOINT` from `768` to `1024`. **One open question**: any other consumers of `useIsMobile`? `grep` shows only `components/ui/sidebar.tsx` (3 sites). All three sites are sidebar-internal and benefit from the bump (they switch the sidebar to Sheet mode below `lg`, which is exactly what we want). Safe to bump.

If review prefers not to touch the shared hook, fallback is to fork a local `useIsBelowLg()` and rewire the sidebar primitive — much more code. Recommending the bump.

### 7. `components/app-shell/sidebar-shell.tsx` (sanity-check, possibly no-op)

Verify pin/hover overlay logic doesn't fire when `isMobile` is true. shadcn's `SidebarProvider` already routes mobile to `openMobile`, so `pinned || hovered` (which controls the desktop `open` prop) becomes irrelevant in mobile mode. Expected outcome: no code change. If the smoke test surfaces a bug (e.g. hover-drawer glitches on a tablet viewport that's halfway between modes), gate `handleMouseEnter` on `!isMobile`.

---

## Acceptance criteria

- [ ] At `lg+`, no sidebar toggle in topbar; search trigger visible centred; profile dropdown shows Settings + Members + Sign out in that order.
- [ ] At `md`–`lg-`, hamburger appears top-left, sidebar gone inline, clicking hamburger opens shadcn Sheet.
- [ ] At `< md`, hamburger still visible; search collapses to icon-only button that opens same dialog.
- [ ] Clicking the search trigger opens a dialog with the "Coming soon" placeholder. Keyboard `⌘K` does **nothing** (intentionally — wired in 07). The kbd badge in the trigger is decorative.
- [ ] `/settings` and `/members` render placeholder cards inside the app shell. Both are reachable from the profile dropdown. No 404. No permission errors for any seeded role.
- [ ] No regressions on the dashboard, planner, incident detail, template editor — all of which sit in unusual width contexts. Eyeball each.
- [ ] Pin + hover-drawer (Phase 6k) still works at `lg+`. At `< lg` the rail is gone; pin/unpin button is irrelevant (sidebar is in Sheet mode).
- [ ] Topbar height stays `h-14` — search trigger does not push the topbar taller.

---

## Smoke test (will write `docs/smoke-test-phase6l.md` during execution)

1. Sign in at desktop ≥ 1280px → confirm no sidebar trigger in topbar, search trigger centred, profile dropdown has 3 items above Sign out.
2. Resize to 800px (between md and lg) → hamburger appears, sidebar inline disappears, click hamburger → Sheet opens. Click an item in the sheet → navigates and sheet closes.
3. Resize to 600px → search trigger collapses to icon button. Click it → dialog opens. Click outside → dialog closes.
4. Click `Settings` from profile dropdown at desktop → `/settings` placeholder renders inside app shell.
5. Click `Members` → `/members` placeholder renders.
6. Click search trigger → dialog opens with "Coming soon" copy. Press `⌘K` → nothing happens (correct).
7. At `lg+`, hover the unpinned sidebar rail → hover-drawer still slides out. Pin → still pins. Confirm 6k unaffected.
8. At `< lg`, open the sheet, click pin button — pin button hidden in sheet mode. Confirm 6k pin UI doesn't bleed into mobile.
9. iPad-portrait (768px) confirm: clean hamburger pattern, no double sidebar, no layout shift.

---

## Out of scope (will be revisited in 07 / 08)

- **Phase 07 — Global search**: backend index, query input + debounce, results panel (incidents / inspections / templates / assets / documents / pages), keyboard shortcut wiring, recent-searches, navigation-on-select, search-permission filtering. The 6l shell hands 07 a stable `<Dialog>` to render into.
- **Phase 08 — Settings + Members pages**: workspace settings (org name, logo, industry, default site, regulatory profile), per-user profile edit, role editor, team member list + invite flow, role assignment UI, permission audit. Both stub pages will be replaced wholesale by 08.

---

## Risks

- **Breakpoint bump (768 → 1024)** ripples through any other `useIsMobile` consumer. Audit before merge: only sidebar primitive uses it today, but Phase 6 polish PRs from 6b–6j may have introduced new callers — re-grep at PR time.
- **Search-trigger geometry on narrow desktop (1024–1280px)**: SiteSwitcher + search + 3 right-cluster buttons may overlap. Cap search at `max-w-[420px]` in the `lg`-only band, expand to `520px` only at `xl+`.
- **`<Dialog>` z-index** — the existing app uses `z-50` for dialogs and the sidebar overlay is also `z-50` (Phase 6k). Confirm dialog renders above sidebar overlay (Radix renders to a portal at body-end, so it should win). Smoke test step.
- **Stub pages without auth gating** — they render for any signed-in user. This is fine for placeholders; Phase 08 hardens them. Add a `// TODO(phase-08): gate with can('settings:read', orgId)` comment so the gap is visible.
