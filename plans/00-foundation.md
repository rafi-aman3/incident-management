# Phase 0 — Foundation

**Status:** in progress
**Goal:** A logged-in user lands on a themed app shell with all routes resolving and a populated database.
**Estimated duration:** 1–2 days
**Depends on:** nothing (greenfield)

---

## Definition of done

A stakeholder dropping in unannounced after Phase 0 sees:

1. The app boots at `pnpm dev` with no errors and brand color `#626DF9`, font Montserrat
2. `/login` accepts any of the 4 demo accounts; redirects to `/dashboard` post-login
3. Sidebar nav shows correct items per role:
   - **Worker** → Dashboard, Report Incident
   - **Supervisor / EHS Manager** → Dashboard, Incidents, Investigations, CAPA, Reports
   - **Site Admin** → All of the above + Admin (stub)
4. Site switcher in topbar toggles between Houston (US) and Manchester (GB), persists in cookie
5. Every nav link resolves to a stub `<EmptyState>` placeholder (no 404s)
6. `pnpm db:seed` runs idempotently — second run does not duplicate users or rows
7. `pnpm dev` console is clean (no React hydration warnings, no Next deprecation notices)

Phase 0 explicitly does **not** include any business logic — wizard, severity engine, notifications, Kanban, etc. all wait for Phase 1+.

---

## Task list (ordered)

### 1. Install dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers \
  date-fns recharts @dnd-kit/core @dnd-kit/sortable @react-pdf/renderer
```

`recharts` and `@dnd-kit` are not strictly Phase 0 needs, but installing now avoids a second restart cycle during Phase 1/2.

### 2. Add shadcn primitives needed for Phase 0

```bash
pnpm dlx shadcn@latest add input label sidebar dropdown-menu avatar separator skeleton sonner card
```

All others (form, dialog, badge, table, etc.) installed lazily as Phase 1+ needs them.

### 3. Configure Next.js for Cache Components

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  cacheComponents: true,
};
export default nextConfig;
```

### 4. Apply design system tokens in `app/globals.css`

Source of truth: `docs/design.md` §7. Replace the radix-vega/olive `:root` and `.dark` blocks with the brand purple palette. Tasks:

- Replace all `:root` token values with the brand purple `#735CDD` palette (OKLch values in `docs/design.md` §7)
- Replace `.dark` block with the navy-canvas dark mode (full block in `docs/design.md` §7)
- Add severity tokens to `@theme inline`: `--color-sev-1` through `--color-sev-5`
- Add new semantic tokens to `@theme inline`: `--color-warning`, `--color-success`, `--color-info`
- Add radius scale: `--radius-md: 0.375rem` (inputs 6px), `--radius-xl: 0.75rem` (buttons 12px)
- Keep base `--radius: 0.5rem` (8px cards)

### 5. Wire Inter in `app/layout.tsx`

Inter is already imported in the scaffold — just simplify. Replace the current `Geist + Geist_Mono + Inter + Roboto` setup with **Inter alone**:

```tsx
import { Inter } from "next/font/google";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400","500","600","700"],
  display: "swap",
});
```

Apply `inter.variable` to `<html>`. Drop the Geist + Roboto + extra Inter binding. Update metadata `title` and `description` to "EHS Incident Management". Add `font-feature-settings: "tnum" 1` in `@layer base` for tabular numerals on `<table>`, `code`, and any `.tabular` utility class — needed for OSHA 300 Log columns and incident IDs.

### 6. Environment variables

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never NEXT_PUBLIC_
```

Add `.env.local` to `.gitignore` (already ignored by default in Next.js scaffold).

**⚠️ Blocker:** Need user to create Supabase project and provide URL + anon key. Service role key only used server-side for the seed script.

### 7. Supabase clients (✅ DONE via shadcn registry)

The Supabase shadcn registry (`pnpm dlx shadcn@latest add @supabase/supabase-client-nextjs`) auto-generated:
- `lib/supabase/client.ts` — `createClient()` browser client
- `lib/supabase/server.ts` — `createClient()` async server client (RSC + actions)
- `lib/supabase/middleware.ts` — `updateSession()` helper called from `proxy.ts`

We added on top:
- `proxy.ts` at root (Next 16 entry; calls `updateSession`) — replaces what would have been `middleware.ts`
- `lib/supabase/auth.ts` — `requireUser()` helper (returns `{ supabase, user, profile }`, redirects to `/login` if no session); kept separate so we don't mutate the auto-generated `server.ts`

Reference snippets retained below for context.

#### Original sketch (kept for reference)

`lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "./types";

export async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

export async function requireUser() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb
    .from("profiles")
    .select("*, sites(*)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  return { sb, user, profile };
}
```

`lib/supabase/client.ts`:

```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

`lib/supabase/proxy.ts` (helper for the `proxy.ts` root file):

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/auth") || path === "/";
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}
```

### 8. Create `proxy.ts` at root (NOT `middleware.ts`)

```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
```

### 9. Schema migration

`supabase/migrations/0001_init.sql` — full DDL per `docs/SPEC.md` §10. Includes:
- All enums
- All tables with FKs and indexes
- `current_role()` and `current_site()` SQL helper functions
- RLS enabled on every table + policies per role per operation
- Storage bucket creation: `incident-attachments`, `investigation-evidence`
- Storage RLS policies keyed on path prefix
- Sequences/triggers for `INC-YYYY-NNNN` and `CAPA-YYYY-NNNN` ref codes
- `REVOKE UPDATE, DELETE ON severity_overrides FROM PUBLIC` (immutability)

### 10. Generate TypeScript types

```bash
pnpm dlx supabase gen types typescript --local > lib/supabase/types.ts
```

### 11. Seed script

`supabase/seed.sql` for static data:
- 2 sites: Houston (US), Manchester (GB)
- ~30 historical incidents spanning all 8 types and S1–S5 across last 12 months (for TRIR/DART math)
- 5 investigations in different Kanban columns
- 8 CAPAs at various lifecycle stages (1 overdue, 1 pending verification, 1 closed, others active)
- 2 active OSHA/RIDDOR notifications, 1 resolved
- Activity events to make timelines look real

`scripts/seed.ts` for auth users (service-role-only, can't be done in pure SQL):
- `worker@demo.local` / `Demo!2026` → role=worker, site=Houston
- `supervisor@demo.local` / `Demo!2026` → role=supervisor, site=Houston
- `ehs@demo.local` / `Demo!2026` → role=ehs_manager, site=Houston
- `admin@demo.local` / `Demo!2026` → role=site_admin, site=Houston
- Creates auth.users via service role, then inserts matching `profiles` rows

Add `package.json` scripts:
```json
"db:reset": "supabase db reset",
"db:seed": "tsx scripts/seed.ts",
"db:types": "supabase gen types typescript --local > lib/supabase/types.ts"
```

Add `tsx` to devDependencies if not present.

### 12. Auth pages

`app/(auth)/layout.tsx` — centered card, neutral background, brand mark.

`app/(auth)/login/page.tsx` — email + password form (simpler than magic link for the demo). Server action calls `supabase.auth.signInWithPassword`. On success, redirect to `/dashboard`. Show inline error on bad creds.

`app/(auth)/callback/route.ts` — handles auth code exchange (for if we add magic link later). Does `supabase.auth.exchangeCodeForSession` and redirects to `next` param or `/dashboard`.

### 13. App shell — `app/(app)/layout.tsx`

Server component. Calls `requireUser()` (redirects to `/login` if no session). Renders:
- `<Sidebar profile={profile}/>` — role-aware nav, collapsible to 80px
- `<Topbar profile={profile}/>` — site switcher, notification bell stub, user menu
- `<main className="flex-1">{children}</main>`

Components in `components/app-shell/`:
- `Sidebar.tsx` — client component (collapse state); reads role; uses Lucide icons + label nav
- `Topbar.tsx` — server component
- `SiteSwitcher.tsx` — client component; writes `selected_site` cookie; refreshes route
- `UserMenu.tsx` — client component; sign-out action
- `NotificationBell.tsx` — server component; just an icon stub for Phase 0

### 14. Stub all 8 nav routes

Each is a server component rendering a shared `<EmptyState>` placeholder with a friendly "Coming in Phase X" message:

- `app/(app)/dashboard/page.tsx`
- `app/(app)/incidents/page.tsx`
- `app/(app)/incidents/new/[step]/page.tsx`
- `app/(app)/incidents/[id]/page.tsx`
- `app/(app)/investigations/page.tsx`
- `app/(app)/investigations/[id]/page.tsx`
- `app/(app)/capa/page.tsx`
- `app/(app)/capa/[id]/page.tsx`
- `app/(app)/reports/page.tsx`

`components/EmptyState.tsx`:

```tsx
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {body && <p className="text-muted-foreground max-w-md">{body}</p>}
    </div>
  );
}
```

### 15. Replace landing `app/page.tsx`

Server component that redirects to `/dashboard` (or `/login` if no session). Removes the create-next-app boilerplate.

### 16. Add Sonner toaster

In `app/layout.tsx`, render `<Toaster />` from `sonner` for global toasts (used heavily in Phase 1 actions, but install root provider now).

---

## File deltas (Phase 0)

### New files
- `next.config.ts`
- `proxy.ts`
- `.env.local.example`
- `supabase/migrations/0001_init.sql`
- `supabase/seed.sql`
- `scripts/seed.ts`
- `lib/supabase/{server,client,proxy,types}.ts`
- `components/EmptyState.tsx`
- `components/app-shell/{Sidebar,Topbar,UserMenu,SiteSwitcher,NotificationBell}.tsx`
- `app/(auth)/{layout,login/page}.tsx`
- `app/(auth)/callback/route.ts`
- `app/(app)/layout.tsx`
- `app/(app)/dashboard/page.tsx` + 8 other route stubs

### Modified files
- `app/layout.tsx` — Montserrat font swap, metadata, `<Toaster/>`
- `app/globals.css` — palette remap, +3 theme tokens
- `app/page.tsx` — redirect to dashboard
- `package.json` — `db:reset`, `db:seed`, `db:types` scripts
- `components.json` — confirm `tsx: true`, no other changes

---

## Risks & unknowns

1. **Supabase SSR cookie API** has changed several times. Pin `@supabase/ssr` to a known-good version and confirm the `getAll` / `setAll` pattern still works with Next 16.2.4.
2. **Cache Components + auth-bound pages.** `requireUser()` in a layout that uses `'use cache'` will trap us — never cache user-bound data. Phase 0 layouts are uncached by default; flag this for Phase 1 when KPI/list caching kicks in.
3. **shadcn `radix-vega` style** + the `radix-ui` umbrella package on npm. Confirm `pnpm dlx shadcn add input` actually works against this style without errors before we go deep.
4. **Service role key in seed script.** Must only be loaded via `tsx scripts/seed.ts`, never imported into anything Next renders. Keep `scripts/` outside `app/` and `lib/`.
5. **Migration ordering.** `supabase db reset` applies migrations then seed. If `seed.sql` references demo user IDs, those have to come from `scripts/seed.ts` first. Resolve by: run `tsx scripts/seed.ts` (creates users), then have script invoke `supabase db reset --no-seed` to apply migrations on a fresh DB, then run static seed inserts that reference user IDs by email lookup.

---

## Smoke test checklist

- [ ] `pnpm install` finishes without warnings
- [ ] `supabase start` runs locally (or remote project credentials work)
- [ ] `pnpm db:seed` succeeds; running it twice does not error or duplicate
- [ ] `pnpm dev` boots; visit `/` → redirects to `/login`
- [ ] Sign in as each of 4 demo accounts; sidebar matches role
- [ ] Site switcher in topbar toggles between Houston and Manchester
- [ ] All 9 nav routes resolve to an `EmptyState` (no 500/404)
- [ ] Sign out returns to `/login`
- [ ] `pnpm build` succeeds
- [ ] Browser DevTools shows brand color is `#626DF9` (computed) and font-family is Montserrat
- [ ] Console clean: no React hydration warnings, no Next.js deprecation warnings

---

## Out of scope (defer to Phase 1+)

- Actual incident reporting wizard
- Severity engine, routing, notification engine
- Risk matrix UI
- Body map UI
- File uploads (storage buckets exist but we don't write to them yet)
- Dashboard KPIs (TRIR/DART) — stub card only
- Charts
- Drag-and-drop on Kanban
- 5-Why component
- CAPA verification flow
- Reports rendering
- Email notifications
- Vercel cron job
