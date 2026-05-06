# Phase 6k — Sidebar polish (pin + hover-drawer)

**Status:** drafted 2026-05-06 (Phase 6 module 11 — added post-hoc to the original 10-module roster)
**Goal:** Replace the current "always-expanded sidebar" UX with a pin/hover-drawer model. Default to a collapsed icon rail; hovering on an unpinned sidebar slides out an overlay drawer above the content (no layout shift); the user can click a pin button at the top of the sidebar to lock it open, at which point it takes layout space again. State persists via cookie so a refresh keeps the user's pin choice.
**Branch:** `feat/phase-6-sidebar-polish` (off `main`)
**PR target:** `main`
**Pages affected:** All app pages — the sidebar lives in `app/(app)/layout.tsx` and renders globally. Visual change is global.

> **What this PR ships:**
> - Pin/unpin state stored in a `sidebar_pinned` cookie (SSR-friendly, mirrors `selected_site` pattern).
> - Default: **unpinned + collapsed** (icon-only ~80px rail).
> - Hover-to-expand for unpinned: overlay drawer slides over content, no layout shift, ~150ms enter delay, immediate close on mouse-leave.
> - Pin button at the top of the sidebar (Pin / PinOff lucide icons) — click toggles pinned state. Pinned = expanded inline (~240px), takes layout space, content shifts.
> - Mobile (sm breakpoint): unchanged — existing shadcn mobile drawer behavior; pin button hidden because pinning is meaningless when the sidebar is already drawer-mode.
> - Polish-checklist items per the shared 10-item rubric for the sidebar surface specifically.

> **Not in this PR (deferred to v2):**
> - **No keyboard shortcut to pin/unpin.** Cmd+B style toggle is nice-to-have; defer.
> - **No remembering "expanded but unpinned"** between sessions. Pinned is the only persistent flag; hover-expand is ephemeral.
> - **No per-section collapse** within the expanded sidebar. v2.
> - **No animation tuning beyond CSS transitions.** No spring physics, no fancy easing.
> - **No "auto-pin if pointer rests for X seconds"**. Strict click-to-pin.
> - **No shrink-on-scroll.** Sidebar height is full viewport always.

---

## Why this UX

Three problems with the current always-expanded sidebar:

1. **Wastes ~240px of horizontal space** on every page even when the user isn't navigating. Dashboard KPIs, planner calendar, template builder all benefit from the recovered width.
2. **Pinned-by-default doesn't match how navigation is actually used** — most users navigate < 10% of the time and stare at content > 90% of the time. Default-collapsed matches reality.
3. **Power users want a stable layout** — that's what the pin is for. They pay the 240px cost in exchange for never-mis-clicking. Casual users get the hover-drawer that disappears when they're done.

This pattern is well-established (Linear, Notion, Figma, GitHub all ship some variant). It's not a redesign — `docs/design.md` §6.5 already specifies "Sidebar (collapsed default — 80px, expanded 240px)". This PR delivers what `design.md` already claimed but the shipped code didn't honor.

---

## Audit — what's there now

`components/app-shell/app-sidebar.tsx` uses `<Sidebar collapsible="icon">` from shadcn primitives. The `(app)/layout.tsx` wraps in `<SidebarProvider defaultOpen>` — so today the sidebar starts **expanded** and the user must click the trigger to collapse. That's the inverse of the desired default.

The shadcn sidebar primitive supports:
- `collapsible="icon"` — collapses to icons (current setting) ✅
- `collapsible="offcanvas"` — slides off-screen entirely (overlay style) — **closest to what we want for the hover-drawer state**
- `defaultOpen` prop on `SidebarProvider` — controls initial open state

Strategy: keep the shadcn primitive but layer our own pin-aware controller that swaps `defaultOpen` and the collapsible mode based on pin state, and adds a hover-trigger overlay for the unpinned case.

---

## Behavior matrix

| Pin state | Collapsed/Expanded | Hover behavior | Layout impact |
|---|---|---|---|
| **Unpinned + collapsed** (default) | Icon rail visible, labels hidden | Hovering the rail slides an overlay drawer right over content | Content takes full width minus icon rail |
| **Unpinned + hover-expanded** | Drawer is open (transient) | Mouse-leave → drawer collapses back to icon rail | Drawer is `position: absolute`/`fixed`, no shift |
| **Pinned + expanded** | Full ~240px sidebar visible inline | Hover does nothing extra (already expanded) | Content takes full width minus expanded sidebar |
| **Mobile (sm)** | Always drawer, opened via `SidebarTrigger` | n/a — touch, not hover | Drawer overlays; pin button hidden |

State source of truth is a `sidebar_pinned` cookie (`true` / absent). On the SSR pass, `(app)/layout.tsx` reads it and passes `defaultPinned` to a client wrapper. Client wrapper manages the in-session pin state + the hover-expand overlay locally.

---

## Implementation notes

### A. Cookie + server read (`(app)/layout.tsx`)

```ts
// in (app)/layout.tsx
import { cookies } from "next/headers";
const cookieStore = await cookies();
const sidebarPinned = cookieStore.get("sidebar_pinned")?.value === "true";
```

Pass `sidebarPinned` to the `<AppSidebar />` (or to a new `<AppShell />` wrapper that owns the SidebarProvider + sidebar + pin coordination).

### B. Pin toggle action (server action)

`components/app-shell/sidebar-actions.ts`:

```ts
"use server";
import { cookies } from "next/headers";
export async function setSidebarPinned(pinned: boolean) {
  const store = await cookies();
  store.set("sidebar_pinned", pinned ? "true" : "false", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
```

### C. Client wrapper (`components/app-shell/sidebar-shell.tsx`)

A new client component that:
1. Receives `defaultPinned: boolean` as a prop.
2. Holds `pinned` state (initialized from prop, mutated by pin button click).
3. Holds `hovered` state (true while mouse over the sidebar trigger area, with a 150ms enter debounce).
4. Computes `expanded = pinned || hovered`.
5. Wraps `<SidebarProvider open={expanded}>` and renders `<Sidebar>` with appropriate `collapsible` mode.
6. On pin toggle: calls `setSidebarPinned()` server action + `router.refresh()` so the cookie persists.

### D. The "overlay drawer" effect

shadcn's sidebar primitive normally takes layout space when expanded. To make the unpinned-expanded state overlay instead of push, we use one of two approaches:

**Option 1 — `position: fixed` override on unpinned-expanded:**
```tsx
<Sidebar
  collapsible="icon"
  className={cn(
    "transition-all duration-200",
    !pinned && expanded && "fixed inset-y-0 left-0 z-40 shadow-xl"
  )}
>
```
Pros: simple, uses shadcn primitive as-is. Cons: absolute positioning + shadcn's CSS variables may fight; may need `--sidebar-width` overrides.

**Option 2 — render two sidebars:**
- An icon-only rail that's always in the layout flow.
- An overlay drawer (separate `<Sheet>` or absolute-positioned div) that mirrors the rail's items, shown on hover when unpinned.

Pros: clean separation. Cons: 2x the DOM, harder to keep in sync.

**Default to Option 1.** Fall back to Option 2 if the shadcn primitive can't be coaxed into the absolute-positioned variant cleanly.

### E. Pin button

Top of `<SidebarHeader>` — small ghost icon button:
- `Pin` icon when unpinned (suggests the action: "click to pin")
- `PinOff` icon when pinned (suggests the action: "click to unpin")
- `aria-label="Pin sidebar"` / `"Unpin sidebar"`
- `aria-pressed={pinned}`
- Tooltip via shadcn `<Tooltip>` showing the current state + action

### F. Hover trigger area

Mouse-enter on the icon rail expands. Mouse-leave on the (expanded) sidebar collapses. Edge cases:
- User moves mouse from rail into expanded drawer → still hovering, stay open.
- User clicks an item → navigation fires; on the new page, the drawer closes on mouse-leave (sometimes immediately if the user's cursor moves to content).
- User pauses on the boundary → 150ms enter delay protects against jitter; close should be near-instant (<50ms) for responsiveness.

Implement with a single `onMouseEnter` / `onMouseLeave` handler at the sidebar root, gated by a 150ms `setTimeout` for enter.

### G. A11y considerations

- The collapsed-icon-only rail must keep tooltips on each item (already the case via shadcn `tooltip={item.label}` prop in `app-sidebar.tsx`).
- Hover-expansion must NOT be the only way to reach the labels — keyboard users tab through the rail, and the active item gets `aria-current`.
- Pin button is keyboard-reachable, has `aria-pressed`.
- Focus ring on rail items respects the collapsed state.
- Screen readers announce sidebar state via the existing shadcn ARIA wiring.

---

## Audit table — sidebar surface

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ⚠️ shipped | Today's sidebar is always-expanded — `defaultOpen` on the SidebarProvider. Does not match `docs/design.md` §6.5 ("collapsed default — 80px"). | Default to collapsed; honor `design.md` widths. |
| 2. Empty state | n/a | Sidebar always renders the same nav items. | n/a |
| 3. Loading state | ✅ | The `(app)/layout.tsx` Suspense fallback already includes a skeleton sidebar. | Verify skeleton matches collapsed-default look. |
| 4. Error state | n/a | Sidebar doesn't fetch its own data — items come from `NAV_ITEMS` const. | n/a |
| 5. Responsive | ✅ shadcn handles | sm breakpoint already uses the offcanvas drawer via shadcn defaults. | Verify pin button is hidden on mobile. |
| 6. A11y / keyboard | ⚠️ verify | Tooltips on icons; tab order; pin button needs `aria-pressed`; ESC closes hover-drawer? | Audit + add `aria-pressed`; ESC closes hover-drawer. |
| 7. Form-error UX | n/a | | n/a |
| 8. Copy | ✅ | Icons + labels are clear. Pin tooltip needs precise verb: "Pin sidebar (keeps it open)" / "Unpin sidebar (auto-collapses)". | Add precise tooltips. |
| 9. Dark mode | ✅ | Tokens pass through shadcn primitives. | Verify hover-drawer shadow renders in dark. |
| 10. Cache Components | ✅ | Cookie read is per-request; sidebar items are static. | n/c. |

---

## Definition of done — Sidebar PR

1. **Default state is collapsed** — first-time visitors land with the icon-only rail.
2. **Hover-expand works** for the unpinned sidebar: 150ms in, immediate out, overlays content (no layout shift).
3. **Pin toggle persists** via the `sidebar_pinned` cookie; refreshing the page preserves pinned state.
4. **Pinned mode** keeps the sidebar expanded inline; content shifts to the right.
5. **Mobile** (sm) is unchanged — drawer behavior; pin button hidden.
6. **Keyboard accessibility:** tab to pin button, Enter toggles. Tab through rail items even when collapsed. ESC closes hover-drawer (when unpinned).
7. **Tooltip precision:** pin button shows "Pin sidebar (keeps it open)" or "Unpin sidebar (auto-collapses)" matching state.
8. **No layout flicker** on first paint — SSR reads the cookie and renders the right initial state.
9. **`pnpm dev` console clean** — no hydration warnings between server-rendered (cookie-read) state and first client render.
10. **Dark mode parity** — hover-drawer shadow, pin button, all states.

PR description includes:
- 30s screen recording of the hover-drawer in action (unpinned).
- Before/after screenshot of dashboard with sidebar collapsed (showing reclaimed width).
- Click-to-pin → refresh demo (state persists).
- Mobile screenshot (pin button hidden, drawer behavior intact).

---

## Open questions (resolve before kickoff)

1. **Should hovering the icon-only rail expand even when pinned-collapsed is impossible** (i.e., pinned always means expanded)? Current proposal: yes, pin = expanded only. There's no "pinned + collapsed" state.
2. **Hover delay tuning** — 150ms enter is a guess. Default to 150ms; if it feels jittery in practice, tune to 200–250ms.
3. **Should the pin button live in the SidebarHeader (current proposal) or floating at the top-right of the sidebar?** Header is conventional; floating is more "pin"-aware visually. Default to header for keyboard order simplicity.
4. **Cookie name `sidebar_pinned` OR namespace it `ehs_sidebar_pinned`?** No collision risk in this app; default to `sidebar_pinned`.
5. **Telemetry** — out of scope for v1, but worth a v2 note: track pin/unpin events to inform whether default-collapsed is right for our users.
