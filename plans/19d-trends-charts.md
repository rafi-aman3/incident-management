# Phase 19d — Trends Section (Charts)

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans`.

**Status:** drafted 2026-05-12 — spec: `docs/superpowers/specs/2026-05-12-org-dashboard-design.md`
**Goal:** Add a 2-col **Trends** section to `/dashboard`: left chart is incidents-per-month for the last 12 months stacked by severity (recharts line); right chart is severity-distribution YTD (recharts donut). Both org-scoped with org/site-flexible aggregators (so 19f reuses them).
**Estimated duration:** ~half day.
**Depends on:** **19a closed**.
**Branch:** `feat/phase-19d-trends-charts`
**PR target:** `main`
**New deps:** none — `recharts` already in tree.
**Schema migration:** **none**.

> **What this PR ships:**
> - `lib/dashboard/org/incidents-trend.ts` — last-12-months grouped query (server-side reduce because Supabase REST doesn't do `date_trunc`).
> - `lib/dashboard/org/severity-distribution.ts` — YTD count per severity.
> - `components/dashboard/incidents-trend-chart.tsx` — recharts stacked line/area.
> - `components/dashboard/severity-distribution-chart.tsx` — recharts donut.
> - `components/dashboard/trends-section.tsx` — wraps both 2-col.
> - Mounted on `/dashboard` between the module cards grid and the Latest bulletins section.

> **Not in this PR:**
> - No CAPA-on-time or inspection-compliance charts. Out of scope; parked.
> - No interactivity (drill-down on click). Static read-only charts.

---

## File map

```
lib/dashboard/org/
  incidents-trend.ts                                  ← new
  severity-distribution.ts                            ← new

components/dashboard/
  incidents-trend-chart.tsx                           ← new (Client)
  severity-distribution-chart.tsx                     ← new (Client)
  trends-section.tsx                                  ← new (Server wrapper)

app/(app)/dashboard/page.tsx                          ← modified
```

---

## Task 1 — Aggregators

**Files:**
- Create: `lib/dashboard/org/incidents-trend.ts`
- Create: `lib/dashboard/org/severity-distribution.ts`

- [ ] **Step 1.1 — Write `incidents-trend.ts`**

We pull every incident's `occurred_at` + `severity` for the last 12 calendar months and reduce server-side into `{ month: '2026-04', S1: 0, S2: 1, S3: 0, S4: 2 }` rows. ~12 months × maybe a few hundred incidents max is negligible payload.

```ts
// lib/dashboard/org/incidents-trend.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type TrendRow = {
  month: string; // 'YYYY-MM'
  monthLabel: string; // 'Apr 2026'
  S1: number;
  S2: number;
  S3: number;
  S4: number;
};

const SEV_KEYS = ["S1", "S2", "S3", "S4"] as const;
type SevKey = (typeof SEV_KEYS)[number];

export async function getIncidentsTrend(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<TrendRow[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startIso = start.toISOString();

  let q = supabase
    .from("incidents")
    .select("occurred_at, severity")
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .gte("occurred_at", startIso)
    .not("severity", "is", null);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);

  const { data } = await q;
  const rows = data ?? [];

  // Pre-seed 12 buckets so empty months render zero, not "missing".
  const buckets = new Map<string, TrendRow>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    buckets.set(month, { month, monthLabel, S1: 0, S2: 0, S3: 0, S4: 0 });
  }

  for (const r of rows) {
    if (!r.occurred_at || !r.severity) continue;
    const d = new Date(r.occurred_at);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(month);
    if (!bucket) continue;
    if ((SEV_KEYS as readonly string[]).includes(r.severity)) {
      bucket[r.severity as SevKey] += 1;
    }
  }

  return Array.from(buckets.values());
}
```

- [ ] **Step 1.2 — Write `severity-distribution.ts`**

```ts
// lib/dashboard/org/severity-distribution.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type SeverityDistributionRow = {
  severity: "S1" | "S2" | "S3" | "S4";
  count: number;
};

export async function getSeverityDistributionYtd(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
): Promise<SeverityDistributionRow[]> {
  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  let q = supabase
    .from("incidents")
    .select("severity")
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .not("severity", "is", null);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);

  const { data } = await q;
  const counts: Record<"S1" | "S2" | "S3" | "S4", number> = { S1: 0, S2: 0, S3: 0, S4: 0 };
  (data ?? []).forEach((r) => {
    if (r.severity === "S1" || r.severity === "S2" || r.severity === "S3" || r.severity === "S4") {
      counts[r.severity] += 1;
    }
  });
  return (["S1", "S2", "S3", "S4"] as const).map((s) => ({ severity: s, count: counts[s] }));
}
```

- [ ] **Step 1.3 — Commit**

```bash
git add lib/dashboard/org/incidents-trend.ts lib/dashboard/org/severity-distribution.ts
git commit -m "$(cat <<'EOF'
feat(phase19d): trends + severity-distribution aggregators

Org/site flexible; pre-seed 12 buckets so empty months render zero.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Chart components

**Files:**
- Create: `components/dashboard/incidents-trend-chart.tsx`
- Create: `components/dashboard/severity-distribution-chart.tsx`

- [ ] **Step 2.1 — Write `incidents-trend-chart.tsx`**

```tsx
// components/dashboard/incidents-trend-chart.tsx
"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { TrendRow } from "@/lib/dashboard/org/incidents-trend";

const SEVERITY_COLORS = {
  S1: "#dc2626", // red-600
  S2: "#d97706", // amber-600
  S3: "#eab308", // yellow-500
  S4: "#16a34a", // success green
};

export function IncidentsTrendChart({ data }: { data: TrendRow[] }) {
  const isEmpty = data.every((r) => r.S1 + r.S2 + r.S3 + r.S4 === 0);
  if (isEmpty) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        No incidents in the last 12 months
      </div>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="circle"
            iconSize={8}
          />
          <Area type="monotone" dataKey="S4" stackId="1" stroke={SEVERITY_COLORS.S4} fill={SEVERITY_COLORS.S4} fillOpacity={0.4} />
          <Area type="monotone" dataKey="S3" stackId="1" stroke={SEVERITY_COLORS.S3} fill={SEVERITY_COLORS.S3} fillOpacity={0.4} />
          <Area type="monotone" dataKey="S2" stackId="1" stroke={SEVERITY_COLORS.S2} fill={SEVERITY_COLORS.S2} fillOpacity={0.4} />
          <Area type="monotone" dataKey="S1" stackId="1" stroke={SEVERITY_COLORS.S1} fill={SEVERITY_COLORS.S1} fillOpacity={0.4} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2.2 — Write `severity-distribution-chart.tsx`**

```tsx
// components/dashboard/severity-distribution-chart.tsx
"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import type { SeverityDistributionRow } from "@/lib/dashboard/org/severity-distribution";

const COLORS: Record<SeverityDistributionRow["severity"], string> = {
  S1: "#dc2626",
  S2: "#d97706",
  S3: "#eab308",
  S4: "#16a34a",
};

export function SeverityDistributionChart({ data }: { data: SeverityDistributionRow[] }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        No incidents this year yet
      </div>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="severity"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((row) => (
              <Cell key={row.severity} fill={COLORS[row.severity]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 6, border: "1px solid hsl(var(--border))", fontSize: 12 }}
            formatter={(value: number, name: string) => [`${value} incidents`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2.3 — Commit**

```bash
git add components/dashboard/incidents-trend-chart.tsx components/dashboard/severity-distribution-chart.tsx
git commit -m "$(cat <<'EOF'
feat(phase19d): recharts trend + severity donut

Both charts render a muted empty-state when there's no data instead
of an empty axes shell.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `<TrendsSection>` server wrapper

**Files:**
- Create: `components/dashboard/trends-section.tsx`

- [ ] **Step 3.1 — Write the section**

```tsx
// components/dashboard/trends-section.tsx
import { createClient } from "@/lib/supabase/server";
import { getIncidentsTrend } from "@/lib/dashboard/org/incidents-trend";
import { getSeverityDistributionYtd } from "@/lib/dashboard/org/severity-distribution";
import { IncidentsTrendChart } from "./incidents-trend-chart";
import { SeverityDistributionChart } from "./severity-distribution-chart";

export async function TrendsSection({
  orgId,
  siteId,
}: {
  orgId: string;
  siteId: string | null;
}) {
  const supabase = await createClient();
  const [trend, sev] = await Promise.all([
    getIncidentsTrend(supabase, orgId, siteId),
    getSeverityDistributionYtd(supabase, orgId, siteId),
  ]);

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-md border bg-card p-4">
        <h3 className="text-sm font-semibold">Incidents — last 12 months</h3>
        <p className="text-xs text-muted-foreground">Stacked by severity</p>
        <div className="mt-3">
          <IncidentsTrendChart data={trend} />
        </div>
      </div>
      <div className="rounded-md border bg-card p-4">
        <h3 className="text-sm font-semibold">Severity distribution (YTD)</h3>
        <p className="text-xs text-muted-foreground">{new Date().getFullYear()} incidents by severity</p>
        <div className="mt-3">
          <SeverityDistributionChart data={sev} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3.2 — Commit**

```bash
git add components/dashboard/trends-section.tsx
git commit -m "$(cat <<'EOF'
feat(phase19d): TrendsSection server wrapper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Mount on `/dashboard`

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 4.1 — Mount between module cards and LatestBulletinsCard**

```tsx
import { TrendsSection } from "@/components/dashboard/trends-section";

// In the JSX, after <ModuleCardsGrid>, before <LatestBulletinsCard>:
<TrendsSection orgId={profile.org_id} siteId={null} />
```

- [ ] **Step 4.2 — Smoke test**

Open `/dashboard`. The Trends section renders as two cards side-by-side at `lg+`. Hover the area chart — tooltip shows month + per-severity counts. Hover the donut — tooltip shows "N incidents — S2" etc.

Empty-state test: in a fresh-org Supabase Studio, set `org_id` to an org with zero incidents. Refresh. Both charts show their muted empty-state cards.

- [ ] **Step 4.3 — Commit + PR**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase19d): mount TrendsSection on /dashboard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git push -u origin feat/phase-19d-trends-charts
gh pr create --title "feat: phase 19d — trends section on dashboard" --body "$(cat <<'EOF'
## Summary
- Stacked area chart: incidents per month over the last 12 months by severity.
- Donut chart: severity distribution YTD.
- 2-col layout on lg+; muted empty states when no data.

## Changes
- `lib/dashboard/org/incidents-trend.ts`, `severity-distribution.ts`
- `components/dashboard/incidents-trend-chart.tsx`, `severity-distribution-chart.tsx`, `trends-section.tsx`
- `app/(app)/dashboard/page.tsx` — mount

## Test Plan
- [ ] Charts render with real data
- [ ] Empty state renders cleanly when no incidents
- [ ] `pnpm lint` + `pnpm build` clean

Builds on Phase 19a.
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

- Spec coverage: ✓ (h) Trends — 2-col line + donut, severity-colored, empty states.
- Placeholder scan: clean — color hex values explicit, no "appropriate styling" handwaves.
- Type consistency: `TrendRow` / `SeverityDistributionRow` shared between aggregator and Client chart.
