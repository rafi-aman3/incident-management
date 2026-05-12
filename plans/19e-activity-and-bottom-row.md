# Phase 19e — Recent Activity + Bottom Row (Drafts · Assets · Documents)

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans`.

**Status:** drafted 2026-05-12 — spec: `docs/superpowers/specs/2026-05-12-org-dashboard-design.md`
**Goal:** Ship the last two bands of the org dashboard — **Recent activity** (left, 2-col with existing `LatestBulletinsCard`) and a 3-col **bottom row** (My drafts · Recent assets · Recent documents). All 4 cards run small, independent server-side aggregators.
**Estimated duration:** ~1 day.
**Depends on:** **19a closed**.
**Branch:** `feat/phase-19e-activity-bottom-row`
**PR target:** `main`
**New deps:** none.
**Schema migration:** **none**.

> **What this PR ships:**
> - `lib/dashboard/org/recent-activity.ts` — top-10 `activity_events` org-wide.
> - `lib/dashboard/org/my-drafts.ts` — union of: draft incidents I authored · inspections in progress where I'm assigned · template_versions in draft where I'm the author.
> - `lib/dashboard/org/recent-assets.ts` — top-5 most recent `assets`.
> - `lib/dashboard/org/recent-documents.ts` — top-5 most recent `documents`.
> - `components/dashboard/recent-activity-card.tsx` — feed renderer.
> - `components/dashboard/my-drafts-card.tsx` — list with Resume → links.
> - `components/dashboard/recent-assets-card.tsx`, `recent-documents-card.tsx` — small list renderers.
> - `components/dashboard/activity-row.tsx` — 2-col wrapper (Recent activity + Latest bulletins).
> - `components/dashboard/bottom-row.tsx` — 3-col wrapper (Drafts + Assets + Documents).
> - Mounted on `/dashboard` below the Trends section.

> **Not in this PR:**
> - No acknowledgement/dismiss UX on the activity feed.
> - No filtering controls on the activity feed (e.g., "show only CAPA events").
> - No realtime updates.

---

## File map

```
lib/dashboard/org/
  recent-activity.ts                                  ← new
  my-drafts.ts                                        ← new
  recent-assets.ts                                    ← new
  recent-documents.ts                                 ← new

components/dashboard/
  recent-activity-card.tsx                            ← new
  my-drafts-card.tsx                                  ← new
  recent-assets-card.tsx                              ← new
  recent-documents-card.tsx                           ← new
  activity-row.tsx                                    ← new
  bottom-row.tsx                                      ← new

app/(app)/dashboard/page.tsx                          ← modified
```

---

## Task 1 — Aggregators (×4)

**Files:**
- Create: `lib/dashboard/org/recent-activity.ts`
- Create: `lib/dashboard/org/my-drafts.ts`
- Create: `lib/dashboard/org/recent-assets.ts`
- Create: `lib/dashboard/org/recent-documents.ts`

- [ ] **Step 1.1 — Write `recent-activity.ts`**

```ts
// lib/dashboard/org/recent-activity.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type RecentActivityRow = {
  id: string;
  verb: string;
  actor_kind: string;
  actor_name: string | null;
  subject_kind: string;
  subject_id: string | null;
  subject_label: string | null;
  occurred_at: string;
  site_id: string | null;
};

export async function getRecentActivity(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
  limit = 10,
): Promise<RecentActivityRow[]> {
  let q = supabase
    .from("activity_events")
    .select("id, verb, actor_kind, actor_name, subject_kind, subject_id, subject_label, occurred_at, site_id")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);
  const { data } = await q;
  return data ?? [];
}
```

> **Schema sanity** — `activity_events` columns shipped in Phase 9a; grep `init.sql` + `phase9a_*.sql` for the exact column list. If `subject_label` / `actor_name` aren't pre-computed columns (i.e. you have to join through the subject table to render a label), this aggregator does *not* fetch joined labels — render generic labels in the Client renderer instead ("Incident updated", "CAPA closed"). Don't expand this query into a 6-way join; keep it cheap.

- [ ] **Step 1.2 — Write `my-drafts.ts`**

```ts
// lib/dashboard/org/my-drafts.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DraftRow = {
  kind: "incident" | "inspection" | "template";
  id: string;
  label: string;
  /** Resume target route. */
  href: string;
  updated_at: string;
};

export async function getMyDrafts(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
  siteId: string | null,
): Promise<DraftRow[]> {
  // Three small queries, max 5 rows each. Single Promise.all batch.
  let qI = supabase
    .from("incidents")
    .select("id, ref_code, type, title, updated_at, current_step")
    .eq("created_by", userId)
    .eq("status", "draft")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (siteId) qI = qI.eq("site_id", siteId);
  else qI = qI.eq("org_id", orgId);

  let qInsp = supabase
    .from("inspections")
    .select("id, ref_code, title, updated_at, inspection_assignees!inner(user_id)")
    .eq("inspection_assignees.user_id", userId)
    .eq("status", "in_progress")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (siteId) qInsp = qInsp.eq("site_id", siteId);
  else qInsp = qInsp.eq("org_id", orgId);

  const qTpl = supabase
    .from("template_versions")
    .select("id, version_number, template:templates!inner(id, title, org_id)")
    .eq("created_by", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(5);

  const [inc, insp, tpl] = await Promise.all([qI, qInsp, qTpl]);

  const out: DraftRow[] = [];

  (inc.data ?? []).forEach((r) => {
    out.push({
      kind: "incident",
      id: r.id,
      label: r.title ?? `${r.ref_code ?? "Incident"} (draft)`,
      href: `/incidents/new/${r.current_step ?? 1}?id=${r.id}`,
      updated_at: r.updated_at,
    });
  });
  (insp.data ?? []).forEach((r) => {
    out.push({
      kind: "inspection",
      id: r.id,
      label: r.title ?? `${r.ref_code ?? "Inspection"} (in progress)`,
      href: `/inspections/${r.id}/run`,
      updated_at: r.updated_at,
    });
  });
  (tpl.data ?? []).forEach((r) => {
    const tpl = (r as unknown as { template: { id: string; title: string; org_id: string } | null }).template;
    if (!tpl || tpl.org_id !== orgId) return;
    out.push({
      kind: "template",
      id: r.id,
      label: `${tpl.title} v${r.version_number} (draft)`,
      href: `/templates/${tpl.id}/edit?version=${r.id}`,
      updated_at: r.updated_at,
    });
  });

  // Sort all combined drafts by recency; cap at 8 visible.
  return out
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 8);
}
```

> **`current_step` on incidents** — if the column doesn't exist (it was a planning concept; some phases moved to `setup_progress` JSON), default the resume URL to `/incidents/new/1?id={id}` and let the wizard's first-step page detect the existing draft and jump the user to the right step. Read `app/(app)/incidents/new/[step]/page.tsx` to confirm the actual contract before merging.
>
> **`template_versions.created_by`** — flagged in the spec as a verification step. If the column doesn't exist on `template_versions` (only on `templates`), drop the template entry from `DraftRow` and the union covers incidents + inspections only. Don't ship a broken query.

- [ ] **Step 1.3 — Write `recent-assets.ts`**

```ts
// lib/dashboard/org/recent-assets.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type RecentAssetRow = {
  id: string;
  name: string;
  kind: string | null;
  site_name: string | null;
  created_at: string;
};

export async function getRecentAssets(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
  limit = 5,
): Promise<RecentAssetRow[]> {
  let q = supabase
    .from("assets")
    .select("id, name, kind, created_at, site:sites!inner(name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind ?? null,
    site_name: (r as unknown as { site: { name: string } | null }).site?.name ?? null,
    created_at: r.created_at,
  }));
}
```

- [ ] **Step 1.4 — Write `recent-documents.ts`**

```ts
// lib/dashboard/org/recent-documents.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type RecentDocumentRow = {
  id: string;
  title: string;
  doc_type: string | null;
  site_name: string | null;
  created_at: string;
};

export async function getRecentDocuments(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
  limit = 5,
): Promise<RecentDocumentRow[]> {
  let q = supabase
    .from("documents")
    .select("id, title, doc_type, created_at, site:sites(name)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    doc_type: r.doc_type ?? null,
    site_name: (r as unknown as { site: { name: string } | null }).site?.name ?? null,
    created_at: r.created_at,
  }));
}
```

> **Documents may be org-scoped (not site-scoped) for some `parent_kind`s.** If the live `documents` schema doesn't have a `site_id` column at the row level (it might attach via `document_links`), simplify the query to drop the join and skip the per-row site name. Grep `phase4_resources_schema.sql` to confirm.

- [ ] **Step 1.5 — Commit**

```bash
git add lib/dashboard/org/recent-activity.ts lib/dashboard/org/my-drafts.ts lib/dashboard/org/recent-assets.ts lib/dashboard/org/recent-documents.ts
git commit -m "$(cat <<'EOF'
feat(phase19e): aggregators for activity + drafts + recent assets/documents

Org/site flexible signatures so 19f's per-site dashboard reuses.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Card components

**Files:**
- Create: `components/dashboard/recent-activity-card.tsx`
- Create: `components/dashboard/my-drafts-card.tsx`
- Create: `components/dashboard/recent-assets-card.tsx`
- Create: `components/dashboard/recent-documents-card.tsx`

- [ ] **Step 2.1 — Write `recent-activity-card.tsx`**

```tsx
// components/dashboard/recent-activity-card.tsx
import Link from "next/link";
import { Sparkles, User2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RecentActivityRow } from "@/lib/dashboard/org/recent-activity";

function subjectHref(row: RecentActivityRow): string | null {
  switch (row.subject_kind) {
    case "incident":
      return row.subject_id ? `/incidents/${row.subject_id}` : null;
    case "investigation":
      return row.subject_id ? `/investigations/${row.subject_id}` : null;
    case "capa":
      return row.subject_id ? `/capa/${row.subject_id}` : null;
    case "inspection":
      return row.subject_id ? `/inspections/${row.subject_id}` : null;
    case "hazard":
      return row.subject_id ? `/hazards/${row.subject_id}` : null;
    case "jsa":
      return row.subject_id ? `/jsa/${row.subject_id}` : null;
    case "bulletin":
      return row.subject_id ? `/bulletins/${row.subject_id}` : null;
    default:
      return null;
  }
}

export function RecentActivityCard({ rows }: { rows: RecentActivityRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <span className="text-xs text-muted-foreground">{rows.length} latest</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No activity yet.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const href = subjectHref(row);
            const isArgus = row.actor_kind === "argus";
            return (
              <li key={row.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="shrink-0">
                  {isArgus ? (
                    <Sparkles className="h-4 w-4 text-cyan-600" aria-hidden />
                  ) : (
                    <User2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{row.actor_name ?? (isArgus ? "Argus" : "Someone")}</span>{" "}
                    <span className="text-muted-foreground">{row.verb}</span>{" "}
                    {href ? (
                      <Link href={href} className="font-medium hover:underline">
                        {row.subject_label ?? row.subject_kind}
                      </Link>
                    ) : (
                      <span className="font-medium">{row.subject_label ?? row.subject_kind}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.occurred_at), { addSuffix: true })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2.2 — Write `my-drafts-card.tsx`**

```tsx
// components/dashboard/my-drafts-card.tsx
import Link from "next/link";
import { FileEdit, ClipboardList, FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DraftRow } from "@/lib/dashboard/org/my-drafts";

function iconFor(kind: DraftRow["kind"]) {
  if (kind === "incident") return FileEdit;
  if (kind === "inspection") return ClipboardList;
  return FileText;
}

export function MyDraftsCard({ rows }: { rows: DraftRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">My drafts</h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Nothing in progress.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => {
            const Icon = iconFor(r.kind);
            return (
              <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 p-3 text-sm">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.kind} · {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <Link
                  href={r.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Resume <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2.3 — Write `recent-assets-card.tsx`**

```tsx
// components/dashboard/recent-assets-card.tsx
import Link from "next/link";
import { Boxes, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RecentAssetRow } from "@/lib/dashboard/org/recent-assets";

export function RecentAssetsCard({ rows }: { rows: RecentAssetRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Recent assets</h2>
        <Link href="/resources" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No assets yet.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
              <Boxes className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.kind, r.site_name].filter(Boolean).join(" · ")}
                  {" · "}
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
              </div>
              <Link
                href={`/resources/assets/${r.id}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2.4 — Write `recent-documents-card.tsx`**

```tsx
// components/dashboard/recent-documents-card.tsx
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RecentDocumentRow } from "@/lib/dashboard/org/recent-documents";

export function RecentDocumentsCard({ rows }: { rows: RecentDocumentRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Recent documents</h2>
        <Link href="/resources/documents" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No documents yet.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.doc_type, r.site_name].filter(Boolean).join(" · ")}
                  {" · "}
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
              </div>
              <Link
                href={`/resources/documents/${r.id}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

> **Resource module route names** — `/resources`, `/resources/assets/<id>`, `/resources/documents/<id>` are the conventional names; if the actual routes differ (e.g. `/assets`, `/documents`), align with what's already in the sidebar nav config.

- [ ] **Step 2.5 — Commit**

```bash
git add components/dashboard/recent-activity-card.tsx components/dashboard/my-drafts-card.tsx components/dashboard/recent-assets-card.tsx components/dashboard/recent-documents-card.tsx
git commit -m "$(cat <<'EOF'
feat(phase19e): card components for activity + drafts + assets + documents

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Section wrappers + mount

**Files:**
- Create: `components/dashboard/activity-row.tsx`
- Create: `components/dashboard/bottom-row.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 3.1 — Write `activity-row.tsx`**

```tsx
// components/dashboard/activity-row.tsx
import { createClient } from "@/lib/supabase/server";
import { getRecentActivity } from "@/lib/dashboard/org/recent-activity";
import { RecentActivityCard } from "./recent-activity-card";
import { LatestBulletinsCard } from "./latest-bulletins-card";

export async function ActivityRow({
  orgId,
  siteId,
}: {
  orgId: string;
  siteId: string | null;
}) {
  const supabase = await createClient();
  const rows = await getRecentActivity(supabase, orgId, siteId);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <RecentActivityCard rows={rows} />
      <LatestBulletinsCard />
    </div>
  );
}
```

- [ ] **Step 3.2 — Write `bottom-row.tsx`**

```tsx
// components/dashboard/bottom-row.tsx
import { createClient } from "@/lib/supabase/server";
import { getMyDrafts } from "@/lib/dashboard/org/my-drafts";
import { getRecentAssets } from "@/lib/dashboard/org/recent-assets";
import { getRecentDocuments } from "@/lib/dashboard/org/recent-documents";
import { MyDraftsCard } from "./my-drafts-card";
import { RecentAssetsCard } from "./recent-assets-card";
import { RecentDocumentsCard } from "./recent-documents-card";

export async function BottomRow({
  orgId,
  siteId,
  userId,
}: {
  orgId: string;
  siteId: string | null;
  userId: string;
}) {
  const supabase = await createClient();
  const [drafts, assets, documents] = await Promise.all([
    getMyDrafts(supabase, userId, orgId, siteId),
    getRecentAssets(supabase, orgId, siteId),
    getRecentDocuments(supabase, orgId, siteId),
  ]);
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <MyDraftsCard rows={drafts} />
      <RecentAssetsCard rows={assets} />
      <RecentDocumentsCard rows={documents} />
    </div>
  );
}
```

- [ ] **Step 3.3 — Mount on `/dashboard`**

In `app/(app)/dashboard/page.tsx`:

```tsx
import { ActivityRow } from "@/components/dashboard/activity-row";
import { BottomRow } from "@/components/dashboard/bottom-row";
```

Replace the standalone `<LatestBulletinsCard />` mount with `<ActivityRow ... />` (Latest bulletins is now embedded inside it). Below `<ActivityRow>` mount `<BottomRow>`.

```tsx
<TrendsSection orgId={profile.org_id} siteId={null} />
<ActivityRow orgId={profile.org_id} siteId={null} />
<BottomRow orgId={profile.org_id} siteId={null} userId={profile.id} />
```

- [ ] **Step 3.4 — Smoke test**

Open `/dashboard`:
1. Recent activity card on the left, Latest bulletins on the right at `lg+`. Stacks vertically below `lg`.
2. Activity feed shows the 10 most recent events; Argus events have the cyan Sparkles icon, human events have the User2 icon.
3. Click a subject link in an activity row — navigates to the correct module detail page.
4. My drafts card shows your in-progress incidents/inspections/templates. Clicking "Resume →" lands on the appropriate wizard URL.
5. Recent assets / Recent documents each show up to 5 latest, ordered by `created_at desc`.

- [ ] **Step 3.5 — Commit**

```bash
git add components/dashboard/activity-row.tsx components/dashboard/bottom-row.tsx app/(app)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase19e): mount activity row + bottom row on /dashboard

Activity row pairs recent activity with existing LatestBulletinsCard.
Bottom row is 3-col: My drafts · Recent assets · Recent documents.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Verification + PR

- [ ] **Step 4.1 — Lint + build + manual**

```bash
pnpm lint && pnpm build
```

Manual: feed shows events in the right order; clicking activity subjects routes correctly; My drafts shows only your own drafts (test by switching users); Recent assets/documents stop at 5 rows each.

- [ ] **Step 4.2 — PR**

```bash
git push -u origin feat/phase-19e-activity-bottom-row
gh pr create --title "feat: phase 19e — recent activity + drafts/assets/documents bottom row" --body "$(cat <<'EOF'
## Summary
- Recent activity card (top-10 `activity_events`) paired with existing Latest bulletins.
- 3-col bottom row: My drafts (incidents · inspections · templates) · Recent assets · Recent documents.

## Changes
- `lib/dashboard/org/recent-activity.ts`, `my-drafts.ts`, `recent-assets.ts`, `recent-documents.ts`
- `components/dashboard/{recent-activity,my-drafts,recent-assets,recent-documents}-card.tsx`
- `components/dashboard/activity-row.tsx`, `bottom-row.tsx`
- `app/(app)/dashboard/page.tsx` — mount

## Test Plan
- [ ] Activity feed renders correct events with correct icons
- [ ] My drafts surfaces only the current user's drafts
- [ ] Recent assets + documents stop at 5
- [ ] `pnpm lint` + `pnpm build` clean

Builds on Phase 19a.
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

- Spec coverage: ✓ (i) Recent activity + Latest bulletins, ✓ (j) Drafts + Assets + Documents 3-col.
- Placeholder scan: clean — schema-uncertain fields (template_versions.created_by, documents.site_id) flagged as verification gates in callouts.
- Type consistency: `RecentActivityRow`, `DraftRow`, `RecentAssetRow`, `RecentDocumentRow` shared between aggregator and Client.
