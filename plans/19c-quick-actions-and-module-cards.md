# Phase 19c — Quick Actions Row + Module Cards Grid

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans`.

**Status:** drafted 2026-05-12 — spec: `docs/superpowers/specs/2026-05-12-org-dashboard-design.md`
**Goal:** Add the **Quick actions row** (6 permission-gated CTAs) and the **3×2 Module cards grid** (Incidents · Inspections · Hazards · JSA · CAPA · Investigations) to `/dashboard`. Org-mode wizard entry uses a small "Choose a site" Sheet picker before navigating to the relevant `/new` route.
**Estimated duration:** ~1 day (1 picker sheet + 1 quick-actions row + 6 module aggregators + 1 card primitive + grid + mount).
**Depends on:** **19a closed**.
**Branch:** `feat/phase-19c-quick-actions-module-cards`
**PR target:** `main`
**New deps:** none — shadcn `Sheet` + `Button` already in tree; lucide icons already used.
**Schema migration:** **none**.

> **What this PR ships:**
> - `components/dashboard/quick-actions-row.tsx` — 6 permission-gated CTAs in a wrap-friendly horizontal strip.
> - `components/dashboard/choose-site-sheet.tsx` — Client Sheet primitive that picks a site and continues to the requested `/new` route.
> - `lib/dashboard/org/modules/<6 files>.ts` — per-module org rollup aggregators.
> - `components/dashboard/module-card.tsx` — generic 1-card primitive (icon + tagline + two numbers + CTA).
> - `components/dashboard/module-cards-grid.tsx` — wires the 6 cards with per-module permission gates.
> - Mounted on `/dashboard`: Quick actions row under greeting; Module cards grid below Argus tiles.

> **Not in this PR:**
> - Trends charts (19d).
> - Recent activity + drafts/assets/documents (19e).
> - Per-site dashboard (19f) — but 19c's aggregators are written site-agnostic so 19f reuses them.

---

## File map

```
lib/dashboard/org/modules/
  incidents.ts                                        ← new
  inspections.ts                                      ← new
  hazards.ts                                          ← new
  jsa.ts                                              ← new
  capa.ts                                             ← new
  investigations.ts                                   ← new

components/dashboard/
  quick-actions-row.tsx                               ← new
  choose-site-sheet.tsx                               ← new
  module-card.tsx                                     ← new
  module-cards-grid.tsx                               ← new

app/(app)/dashboard/page.tsx                          ← modified
```

---

## Task 1 — Module aggregators (×6)

One function per module. Each returns the same shape so the card primitive can render them uniformly.

**Files:**
- Create: `lib/dashboard/org/modules/incidents.ts`
- Create: `lib/dashboard/org/modules/inspections.ts`
- Create: `lib/dashboard/org/modules/hazards.ts`
- Create: `lib/dashboard/org/modules/jsa.ts`
- Create: `lib/dashboard/org/modules/capa.ts`
- Create: `lib/dashboard/org/modules/investigations.ts`

- [ ] **Step 1.1 — Common type, then per-module aggregators**

Define a shared type once. Put it inline at the top of `module-card.tsx` (Task 3) — or in a small types file. We'll put it in `module-card.tsx` to keep file count low.

All six aggregators share the same signature: `(supabase, orgIdOrNull, siteIdOrNull) => Promise<ModuleCardData>` so 19f can pass a `siteId` and reuse them. When `siteId` is null, we filter by `org_id`; when `siteId` is set, we filter by `site_id` and ignore `org_id`. RLS handles cross-site permission scoping in both cases.

```ts
// lib/dashboard/org/modules/incidents.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ModuleCardData = {
  primary: { label: string; value: number };
  secondary: { label: string; value: number; tone: "neutral" | "warn" | "alert" };
};

export async function getIncidentsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const baseOpen = supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .neq("status", "closed");
  const baseS1S2 = supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .in("severity", ["S1", "S2"])
    .neq("status", "closed");

  const open = siteId ? baseOpen.eq("site_id", siteId) : baseOpen.eq("org_id", orgId!);
  const s1s2 = siteId ? baseS1S2.eq("site_id", siteId) : baseS1S2.eq("org_id", orgId!);

  const [openRes, s1s2Res] = await Promise.all([open, s1s2]);

  const s1s2Count = s1s2Res.count ?? 0;
  return {
    primary: { label: "Open", value: openRes.count ?? 0 },
    secondary: {
      label: "S1/S2",
      value: s1s2Count,
      tone: s1s2Count > 0 ? "alert" : "neutral",
    },
  };
}
```

```ts
// lib/dashboard/org/modules/inspections.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

export async function getInspectionsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Iso = in7.toISOString().slice(0, 10);

  const baseDueSoon = supabase
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .neq("status", "completed")
    .neq("status", "cancelled")
    .gte("due_at", today)
    .lt("due_at", in7Iso)
    .is("deleted_at", null);
  const baseOverdue = supabase
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .neq("status", "completed")
    .neq("status", "cancelled")
    .lt("due_at", today)
    .is("deleted_at", null);

  const dueSoon = siteId ? baseDueSoon.eq("site_id", siteId) : baseDueSoon.eq("org_id", orgId!);
  const overdue = siteId ? baseOverdue.eq("site_id", siteId) : baseOverdue.eq("org_id", orgId!);

  const [dueSoonRes, overdueRes] = await Promise.all([dueSoon, overdue]);
  const overdueCount = overdueRes.count ?? 0;
  return {
    primary: { label: "Due this week", value: dueSoonRes.count ?? 0 },
    secondary: {
      label: "Overdue",
      value: overdueCount,
      tone: overdueCount > 0 ? "alert" : "neutral",
    },
  };
}
```

> **Schema note** — the `inspections` table uses `due_at` and a `status` enum that includes `completed` / `cancelled`. If the column names in `lib/supabase/types.ts` differ (e.g. `scheduled_for`), align the code with the type at edit time — grep the existing `/inspections` list page for the live column name.

```ts
// lib/dashboard/org/modules/hazards.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

export async function getHazardsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const baseTotal = supabase
    .from("hazards")
    .select("id", { count: "exact", head: true })
    .is("retired_at", null);
  const baseHigh = supabase
    .from("hazards")
    .select("id", { count: "exact", head: true })
    .is("retired_at", null)
    .in("residual_severity", ["S1", "S2"]);

  const total = siteId ? baseTotal.eq("site_id", siteId) : baseTotal.eq("org_id", orgId!);
  const high = siteId ? baseHigh.eq("site_id", siteId) : baseHigh.eq("org_id", orgId!);

  const [totalRes, highRes] = await Promise.all([total, high]);
  const highCount = highRes.count ?? 0;
  return {
    primary: { label: "Total", value: totalRes.count ?? 0 },
    secondary: {
      label: "High residual",
      value: highCount,
      tone: highCount > 0 ? "warn" : "neutral",
    },
  };
}
```

```ts
// lib/dashboard/org/modules/jsa.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

export async function getJsaModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Iso = in30.toISOString().slice(0, 10);

  const baseActive = supabase
    .from("jsas")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .is("retired_at", null);
  const baseExpiring = supabase
    .from("jsas")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .is("retired_at", null)
    .lte("next_review_at", in30Iso)
    .gte("next_review_at", today);

  const active = siteId ? baseActive.eq("site_id", siteId) : baseActive.eq("org_id", orgId!);
  const expiring = siteId ? baseExpiring.eq("site_id", siteId) : baseExpiring.eq("org_id", orgId!);

  const [activeRes, expiringRes] = await Promise.all([active, expiring]);
  const expiringCount = expiringRes.count ?? 0;
  return {
    primary: { label: "Active", value: activeRes.count ?? 0 },
    secondary: {
      label: "Expiring 30d",
      value: expiringCount,
      tone: expiringCount > 0 ? "warn" : "neutral",
    },
  };
}
```

```ts
// lib/dashboard/org/modules/capa.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

export async function getCapaModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const today = new Date().toISOString().slice(0, 10);

  const baseOpen = supabase
    .from("capas")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", '("verified","closed","abandoned")');
  const baseOverdue = supabase
    .from("capas")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", '("verified","closed","abandoned")')
    .lt("due_date", today);

  const open = siteId ? baseOpen.eq("site_id", siteId) : baseOpen.eq("org_id", orgId!);
  const overdue = siteId ? baseOverdue.eq("site_id", siteId) : baseOverdue.eq("org_id", orgId!);

  const [openRes, overdueRes] = await Promise.all([open, overdue]);
  const overdueCount = overdueRes.count ?? 0;
  return {
    primary: { label: "Open", value: openRes.count ?? 0 },
    secondary: {
      label: "Overdue",
      value: overdueCount,
      tone: overdueCount > 0 ? "alert" : "neutral",
    },
  };
}
```

> **CAPA status filter** — `("verified","closed","abandoned")` is PostgREST's `not in` syntax. If the project's CAPA status enum uses different names (`completed_verified`, etc.), grep the existing `/capa` list page for the live filter and align.

```ts
// lib/dashboard/org/modules/investigations.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ModuleCardData } from "./incidents";

export async function getInvestigationsModuleCard(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<ModuleCardData> {
  const today = new Date().toISOString().slice(0, 10);

  const baseOpen = supabase
    .from("investigations")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .neq("status", "closed");
  const baseOverdue = supabase
    .from("investigations")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .neq("status", "closed")
    .lt("due_date", today);

  const open = siteId ? baseOpen.eq("site_id", siteId) : baseOpen.eq("org_id", orgId!);
  const overdue = siteId ? baseOverdue.eq("site_id", siteId) : baseOverdue.eq("org_id", orgId!);

  const [openRes, overdueRes] = await Promise.all([open, overdue]);
  const overdueCount = overdueRes.count ?? 0;
  return {
    primary: { label: "Open", value: openRes.count ?? 0 },
    secondary: {
      label: "Overdue",
      value: overdueCount,
      tone: overdueCount > 0 ? "alert" : "neutral",
    },
  };
}
```

- [ ] **Step 1.2 — Commit**

```bash
git add lib/dashboard/org/modules/
git commit -m "$(cat <<'EOF'
feat(phase19c): module aggregators for 6 dashboard cards

Org/site-flexible signature so 19f's per-site dashboard reuses them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — `<ChooseSiteSheet>` picker

When a user hits a Quick action from `/dashboard` (org mode, no `currentSiteId`), we don't know which site they intend the new record to belong to. Open a small Sheet listing the user's accessible sites and continue to the requested `/new` route with the chosen site as a query param. The wizards already accept `?site=<id>` for this exact case (Step 1 of the Report Wizard, etc.).

> **Why a Sheet not a Dropdown** — per `[[feedback-inline-ui-in-mobile-sheets]]`, but more importantly because the picker may show 10+ sites with scroll. A `<Sheet>` is the right primitive for "pick from a list" on mobile too.

**Files:**
- Create: `components/dashboard/choose-site-sheet.tsx`

- [ ] **Step 2.1 — Write the component**

```tsx
// components/dashboard/choose-site-sheet.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export type ChooseSiteOption = {
  id: string;
  name: string;
};

export function ChooseSiteSheet({
  open,
  onOpenChange,
  sites,
  destination,
  destinationLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sites: ChooseSiteOption[];
  /** Format: "/incidents/new/1?site={id}". The `{id}` placeholder is replaced. */
  destination: string;
  destinationLabel: string;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState<string | null>(null);

  function go(id: string) {
    setPicking(id);
    router.push(destination.replace("{id}", id));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Choose a site</SheetTitle>
          <SheetDescription>
            Pick the site this {destinationLabel} belongs to.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-1">
          {sites.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No sites available. Create one in /admin/sites/new first.
            </p>
          )}
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              disabled={picking !== null}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="flex-1 truncate">{s.name}</span>
              {picking === s.id && (
                <span className="text-xs text-muted-foreground">…</span>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2.2 — Commit**

```bash
git add components/dashboard/choose-site-sheet.tsx
git commit -m "$(cat <<'EOF'
feat(phase19c): ChooseSiteSheet picker for org-mode wizard entry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `<QuickActionsRow>` + permission-gated buttons

**Files:**
- Create: `components/dashboard/quick-actions-row.tsx`

- [ ] **Step 3.1 — Write the component**

```tsx
// components/dashboard/quick-actions-row.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  HardHat,
  Megaphone,
} from "lucide-react";
import { ChooseSiteSheet, type ChooseSiteOption } from "./choose-site-sheet";

export type QuickActionsPermissions = {
  reportIncident: boolean;
  startInspection: boolean;
  addHazard: boolean;
  createCapa: boolean;
  createJsa: boolean;
  createBulletin: boolean;
};

type ActionKey =
  | "report"
  | "inspection"
  | "hazard"
  | "capa"
  | "jsa"
  | "bulletin";

const DEST: Record<ActionKey, { path: string; label: string; needsSite: boolean }> = {
  report: { path: "/incidents/new/1?site={id}", label: "incident", needsSite: true },
  inspection: { path: "/inspections/new?site={id}", label: "inspection", needsSite: true },
  hazard: { path: "/hazards/new?site={id}", label: "hazard", needsSite: true },
  capa: { path: "/capa/new?site={id}", label: "CAPA", needsSite: true },
  jsa: { path: "/jsa/new?site={id}", label: "JSA", needsSite: true },
  bulletin: { path: "/bulletins/new", label: "bulletin", needsSite: false },
};

export function QuickActionsRow({
  perms,
  sites,
  currentSiteId,
}: {
  perms: QuickActionsPermissions;
  sites: ChooseSiteOption[];
  /** When set (e.g. on /sites/[id] in 19f), skip the picker. */
  currentSiteId: string | null;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);

  function trigger(key: ActionKey) {
    const dest = DEST[key];
    if (!dest.needsSite) {
      router.push(dest.path);
      return;
    }
    if (currentSiteId) {
      router.push(dest.path.replace("{id}", currentSiteId));
      return;
    }
    setPendingAction(key);
  }

  const buttons: Array<{
    key: ActionKey;
    gate: boolean;
    label: string;
    Icon: typeof Plus;
    primary?: boolean;
  }> = [
    { key: "report", gate: perms.reportIncident, label: "Report incident", Icon: Plus, primary: true },
    { key: "inspection", gate: perms.startInspection, label: "Start inspection", Icon: ClipboardCheck },
    { key: "hazard", gate: perms.addHazard, label: "Add hazard", Icon: AlertTriangle },
    { key: "capa", gate: perms.createCapa, label: "New CAPA", Icon: Wrench },
    { key: "jsa", gate: perms.createJsa, label: "New JSA", Icon: HardHat },
    { key: "bulletin", gate: perms.createBulletin, label: "New bulletin", Icon: Megaphone },
  ];

  const visible = buttons.filter((b) => b.gate);
  if (visible.length === 0) return null;

  const pendingDest = pendingAction ? DEST[pendingAction] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {visible.map(({ key, label, Icon, primary }) => (
          <button
            key={key}
            type="button"
            onClick={() => trigger(key)}
            className={
              primary
                ? "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                : "inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <ChooseSiteSheet
        open={pendingAction !== null}
        onOpenChange={(v) => !v && setPendingAction(null)}
        sites={sites}
        destination={pendingDest?.path ?? ""}
        destinationLabel={pendingDest?.label ?? ""}
      />
    </>
  );
}
```

> **Wizard URL contract** — assumes `?site=<id>` is honored by the `/incidents/new/1`, `/inspections/new`, `/hazards/new`, `/capa/new`, `/jsa/new` entrypoints. If any of those don't yet accept the param, this PR includes a small follow-up (read the entrypoint's params, prefer the query param when set, fall back to the topbar's `currentSiteId`). Bulletins is org-level so no site param needed.

- [ ] **Step 3.2 — Check + extend wizard entrypoints to accept `?site=`**

For each of `/incidents/new/1`, `/inspections/new`, `/hazards/new`, `/capa/new`, `/jsa/new` — check that the page already reads `?site=` from `searchParams` and uses it for the initial site context. If not (most likely the case for some), add a small block at the top of the page:

```tsx
// example for /hazards/new/page.tsx
const sp = await searchParams;
const initialSiteId = typeof sp.site === "string" ? sp.site : null;
// Wizards should use initialSiteId in preference to topbar currentSiteId
// only on the very first render (then persist whichever the user confirms).
```

If any wizard's first step has no site picker and just relies on `currentSiteId`, this small change unblocks the dashboard Quick action. Commit the wizard tweaks separately if they require non-trivial work.

- [ ] **Step 3.3 — Commit**

```bash
git add components/dashboard/quick-actions-row.tsx
git commit -m "$(cat <<'EOF'
feat(phase19c): QuickActionsRow with permission-gated CTAs + site picker

Six actions (Report incident · Start inspection · Add hazard · New CAPA
· New JSA · New bulletin) gated by their create permissions. On
/dashboard (no currentSiteId), clicking a site-requiring action opens
the Sheet picker and continues to the wizard with ?site=<id>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `<ModuleCard>` primitive + `<ModuleCardsGrid>`

**Files:**
- Create: `components/dashboard/module-card.tsx`
- Create: `components/dashboard/module-cards-grid.tsx`

- [ ] **Step 4.1 — Write `module-card.tsx`**

```tsx
// components/dashboard/module-card.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuleCardData } from "@/lib/dashboard/org/modules/incidents";

export type { ModuleCardData } from "@/lib/dashboard/org/modules/incidents";

function toneClass(tone: ModuleCardData["secondary"]["tone"]): string {
  switch (tone) {
    case "alert":
      return "text-red-600 dark:text-red-400";
    case "warn":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-muted-foreground";
  }
}

export function ModuleCard({
  title,
  tagline,
  Icon,
  data,
  href,
}: {
  title: string;
  tagline: string;
  Icon: LucideIcon;
  data: ModuleCardData;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-md border bg-card p-4 transition hover:bg-accent"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md border bg-background p-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{tagline}</p>
        </div>
        <ArrowRight className="mt-1 h-3 w-3 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
      </div>
      <div className="mt-4 flex items-baseline gap-4">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{data.primary.value}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.primary.label}
          </div>
        </div>
        <div>
          <div className={`text-sm font-medium tabular-nums ${toneClass(data.secondary.tone)}`}>
            {data.secondary.value}
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.secondary.label}
          </div>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4.2 — Write `module-cards-grid.tsx`**

```tsx
// components/dashboard/module-cards-grid.tsx
import {
  AlertOctagon,
  ClipboardCheck,
  ShieldAlert,
  HardHat,
  Wrench,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orgCan } from "@/lib/auth/orgCan";
import { ModuleCard } from "./module-card";
import { getIncidentsModuleCard } from "@/lib/dashboard/org/modules/incidents";
import { getInspectionsModuleCard } from "@/lib/dashboard/org/modules/inspections";
import { getHazardsModuleCard } from "@/lib/dashboard/org/modules/hazards";
import { getJsaModuleCard } from "@/lib/dashboard/org/modules/jsa";
import { getCapaModuleCard } from "@/lib/dashboard/org/modules/capa";
import { getInvestigationsModuleCard } from "@/lib/dashboard/org/modules/investigations";

export async function ModuleCardsGrid({
  orgId,
  siteId,
}: {
  orgId: string;
  /** When non-null (19f), all aggregators scope to one site. */
  siteId: string | null;
}) {
  const supabase = await createClient();
  const [
    canIncidents, canInspections, canHazards, canJsa, canCapa, canInvest,
    incidents, inspections, hazards, jsa, capa, investigations,
  ] = await Promise.all([
    orgCan("incident:read_site"),
    orgCan("inspection:run"),
    orgCan("hazard:read"),
    orgCan("jsa:read"),
    orgCan("capa:complete"),
    orgCan("investigation:lead"),
    getIncidentsModuleCard(supabase, orgId, siteId),
    getInspectionsModuleCard(supabase, orgId, siteId),
    getHazardsModuleCard(supabase, orgId, siteId),
    getJsaModuleCard(supabase, orgId, siteId),
    getCapaModuleCard(supabase, orgId, siteId),
    getInvestigationsModuleCard(supabase, orgId, siteId),
  ]);

  const cards: Array<{ gate: boolean; node: React.ReactNode }> = [
    {
      gate: canIncidents,
      node: <ModuleCard key="inc" title="Incidents" tagline="Capture · classify · route" Icon={AlertOctagon} data={incidents} href="/incidents" />,
    },
    {
      gate: canInspections,
      node: <ModuleCard key="ins" title="Inspections" tagline="Templates + scheduled runs" Icon={ClipboardCheck} data={inspections} href="/inspections" />,
    },
    {
      gate: canHazards,
      node: <ModuleCard key="haz" title="Hazards" tagline="Register + residual risk" Icon={ShieldAlert} data={hazards} href="/hazards" />,
    },
    {
      gate: canJsa,
      node: <ModuleCard key="jsa" title="JSA" tagline="Job safety analyses" Icon={HardHat} data={jsa} href="/jsa" />,
    },
    {
      gate: canCapa,
      node: <ModuleCard key="cap" title="CAPA" tagline="Corrective + preventive actions" Icon={Wrench} data={capa} href="/capa" />,
    },
    {
      gate: canInvest,
      node: <ModuleCard key="inv" title="Investigations" tagline="Track-A root cause" Icon={Search} data={investigations} href="/investigations" />,
    },
  ];

  const visible = cards.filter((c) => c.gate);
  if (visible.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Modules</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => c.node)}
      </div>
    </section>
  );
}
```

> **Permission key sanity check** — `incident:read_site` / `inspection:run` / `hazard:read` / `jsa:read` / `capa:complete` / `investigation:lead` are the existing keys in `lib/auth/can.ts`. If any spelling differs, grep `lib/auth/can.ts` for the live key and align. Don't invent new keys.

- [ ] **Step 4.3 — Commit**

```bash
git add components/dashboard/module-card.tsx components/dashboard/module-cards-grid.tsx
git commit -m "$(cat <<'EOF'
feat(phase19c): ModuleCard + ModuleCardsGrid for org dashboard

Per-card permission gating; sites with no read perm hide their card.
Grid is org/site flexible so 19f reuses with siteId set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Mount on `/dashboard`

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 5.1 — Wire up sites prop for the QuickActionsRow**

At the top of the file (inside `DashboardPage`), add the small sites query:

```tsx
const sitesForPickerRes = await supabase
  .from("sites")
  .select("id, name")
  .eq("org_id", profile.org_id)
  .not("setup_completed_at", "is", null)
  .order("name", { ascending: true });
const sitesForPicker = sitesForPickerRes.data ?? [];
```

Then assemble the perm flags:

```tsx
const [
  canReport, canInspect, canHazard, canCapa, canJsa, canBulletin,
] = await Promise.all([
  orgCan("incident:report"),
  orgCan("inspection:run"),
  orgCan("hazard:create"),
  orgCan("capa:create"),
  orgCan("jsa:create"),
  orgCan("bulletin:create"),
]);
```

- [ ] **Step 5.2 — Mount the Quick actions row + Module cards grid in the JSX**

Import:

```tsx
import { QuickActionsRow } from "@/components/dashboard/quick-actions-row";
import { ModuleCardsGrid } from "@/components/dashboard/module-cards-grid";
```

In the JSX — replace today's standalone "Report incident" button block (the inline button next to the greeting from 19a) with the QuickActionsRow placed below the greeting:

```tsx
<div>
  <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
  <h1 className="text-2xl font-semibold">Hi, {firstName}</h1>
  <p className="text-sm text-muted-foreground">
    A live picture of incidents, inspections, and risk across your sites.
  </p>
</div>
<QuickActionsRow
  perms={{
    reportIncident: canReport,
    startInspection: canInspect,
    addHazard: canHazard,
    createCapa: canCapa,
    createJsa: canJsa,
    createBulletin: canBulletin,
  }}
  sites={sitesForPicker}
  currentSiteId={null}
/>
```

And below the Argus tiles block (`{argusAvailable && (...)}`), mount:

```tsx
<ModuleCardsGrid orgId={profile.org_id} siteId={null} />
```

- [ ] **Step 5.3 — Smoke test**

Open `/dashboard`:
1. Quick actions row appears under the greeting. Buttons match your permissions — primary "Report incident" is brand purple; others are outline.
2. Click "Report incident" — Sheet opens listing sites; pick one — lands at `/incidents/new/1?site=<id>` with the wizard preset to that site.
3. Click "New bulletin" — navigates directly to `/bulletins/new` (no picker).
4. Module cards grid renders 3×2 below the Argus tiles. Counts match `select count(*)` on the relevant tables filtered by your org. Hovering a card highlights it; clicking navigates to the module's list page.
5. Drop your `hazard:read` perm in `roles_permissions` for testing — reload — the Hazards card disappears.

- [ ] **Step 5.4 — Commit**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase19c): mount QuickActionsRow + ModuleCardsGrid on /dashboard

Quick actions row directly under the greeting; module cards grid below
the Argus tiles. Both use orgCan() permission gates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Verification + PR

- [ ] **Step 6.1 — Lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 6.2 — Manual smoke checklist**

- [ ] Quick actions row shows the right subset for: admin, ehs_manager, supervisor, worker.
- [ ] Sheet picker opens for site-requiring actions on /dashboard; bulletin skips it.
- [ ] Module cards each navigate to their module list.
- [ ] Counts match a direct `select count(*) from <table>` query.
- [ ] Sites the user can't read are excluded from the picker.

- [ ] **Step 6.3 — PR**

```bash
git push -u origin feat/phase-19c-quick-actions-module-cards
gh pr create --title "feat: phase 19c — quick actions + module cards grid" --body "$(cat <<'EOF'
## Summary
- Quick actions row (6 permission-gated CTAs) under the greeting.
- 3x2 module cards grid (Incidents · Inspections · Hazards · JSA · CAPA · Investigations) below Argus tiles.
- ChooseSiteSheet picker for site-requiring actions in org mode.

## Changes
- `lib/dashboard/org/modules/*.ts` — 6 aggregators (org/site flexible)
- `components/dashboard/quick-actions-row.tsx`, `choose-site-sheet.tsx`, `module-card.tsx`, `module-cards-grid.tsx`
- `app/(app)/dashboard/page.tsx` — mount both

## Test Plan
- [ ] Quick actions show the right subset per role
- [ ] Sheet picker continues to wizard with `?site=<id>`
- [ ] Module cards counts match direct SQL counts
- [ ] Cards drop when user lacks the read perm
- [ ] `pnpm lint` + `pnpm build` clean

Builds on Phase 19a (+ 19b if landed).
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

- Spec coverage: ✓ Quick actions row (c.1) including bulletin; ✓ Choose-a-site picker UX; ✓ 3×2 module grid with permission gates.
- Placeholder scan: clean — all enum filters explicit; permission-key spellings flagged for grep-check before commit.
- Type consistency: `ModuleCardData` is the single shared type; all 6 aggregators return it; `<ModuleCard>` consumes it.
