# Phase 16 — SDS Manager Stub (§SDS-INTEGRATION)

**Status:** drafted 2026-05-11 — informed by `docs/superpowers/specs/2026-05-11-v2-phases-14-16-research.md`
**Goal:** Ship the demo-grade SDS Manager integration stub per SPEC §SDS-INTEGRATION: a 6-chemical hardcoded catalog, an `/admin/integrations` card with an external link, and an "Import from SDS Manager" modal on `/hazards/candidates` that batch-creates `hazard_candidates` rows with `proposed_metadata.suggested_controls` pre-populated for §HZ to consume on conversion.
**Branch:** `feat/phase-16-sds-manager-stub` (off `main`) — **combinable with Phase 14** per research §SDS.R7 (~300-500 LOC, 0 migrations, writes into Phase-14 tables only).
**PR target:** `main`
**Hard dep:** Phase 14 must be on `main` (or in the same combined PR). Writes into `hazard_candidates` which only exists after Phase 14.
**New deps:** none.
**Schema migration:** **none** — this phase writes into the §HZ `hazard_candidates` table only.

> **What this PR ships:**
> - One new route `/admin/integrations` with one card ("SDS Manager") and one external link to a configurable `NEXT_PUBLIC_SDS_MANAGER_URL`.
> - One new modal `<SdsImportModal>` mounted on `/hazards/candidates` via an "Import from SDS Manager" button.
> - One hardcoded TypeScript catalog `lib/sds/dummy-catalog.ts` of 6 chemicals (Toluene · Sulfuric Acid · Hydraulic Oil · Isopropanol · Acetone · Sodium Hydroxide) with realistic GHS pictograms · CAS · H-statements · signal word · suggested controls.
> - One server action `actions/sds.ts::importSdsHazards(siteId, sdsIds[])` that creates 1 `hazard_candidate` row per H-statement per selected chemical.
> - **GHS pictograms passed through into `proposed_metadata.pictograms`** so the §HZ candidate review queue can render them (SPEC delta from research §SDS.R5).
> - Zero new tables. Zero migrations.

> **Not in this PR (deferred to v2.5 / real-API phase):**
> - No `sds_records` table (no tracking of which SDSs imported).
> - No `sds_chemical_uses` table (no usage tracking).
> - No SDS revision history / "this SDS was updated by the manufacturer" workflow.
> - No live API calls to a real SDS Manager backend.
> - No inventory / container-level tracking.
> - No mobile SDS lookup or QR codes.
> - No multi-language SDS body.
> - No secondary-container / GHS workplace label generation.
> - No storage-compatibility / segregation alerts.
> - No chemical-substitution workflow.
> - No worker-training tie-in.

---

## Why this scope

Research validated that the locked stub spec hits the **single most differentiated SDS feature**: H-statement → control measure auto-mapping. EcoOnline is the only major competitor that explicitly documents this; our `suggested_controls` array on each catalog chemical IS that pattern. The other competitor features (millions-scale SDS library, inventory tracking, label generation) require a real API and are correctly deferred.

One spec delta from research worth landing now: pass GHS pictograms through into `proposed_metadata.pictograms`. The spec already mentions "realistic GHS pictograms" on each catalog row but is silent on whether they pass into the candidate. Passing them through costs zero and dramatically improves the candidate review queue's visual demo quality — when the EHS Manager opens a candidate from an SDS import, they see the same GHS chips they'd see on a real SDS PDF.

The stub is **genuinely small (~300-500 LOC)** because it writes into Phase 14's tables and reuses Phase 14's RBAC. Recommendation in the research doc was to ship it in the same PR as Phase 14; this plan supports that path explicitly.

---

## Pre-flight deps

- **Phase 14 must be on `main` (or in the same combined PR).** `hazard_candidates` table is created by Phase 14. `proposed_metadata` jsonb shape is locked in Phase 14.
- **`hazard_candidates.source_type` enum must include `'sds_import'`** — Phase 14 migration already ships this per SPEC §HZ.2.
- **`hazard_candidate:create` (or equivalent) RLS write policy must exist on `hazard_candidates`** — Phase 14 ships this via the existing `hazard:report` permission, granted to `supervisor` and above.

---

## Spec deltas from research

One addition to SPEC §SDS-INTEGRATION that ships with this plan:

1. **§SDS.4 — pass GHS pictograms through into `proposed_metadata`.** The `importSdsHazards` action's `proposed_metadata` payload gains a `pictograms: string[]` field alongside the existing `sds_id` / `product_name` / `cas_number` / `h_statement` / `suggested_controls` fields. Costs zero; demo value high.

---

## Decision: ship combined with Phase 14, or separately?

**Recommended: combined PR with Phase 14**, branch `feat/phase-14-hazard-register` carries both phases' files. Rationale per research §SDS.R7:

- The stub writes into Phase-14-only tables. Shipping standalone means a window where Phase 14 is on `main` but the candidate queue is bare for non-manual sources.
- `proposed_metadata.suggested_controls` shape is the riskiest interface in the spec — co-designing it with the §HZ `convertCandidate` form that consumes it (in the same PR) prevents drift.
- Zero migrations and ~300-500 LOC means the PR doesn't balloon meaningfully (Phase 14 is already a substantial PR; +400 LOC for the stub is well within review tolerance).

**Alternative: ship as separate Phase 16 PR** off `feat/phase-16-sds-manager-stub` branched from `main` after Phase 14 merges. Use this path only if the Phase 14 PR is already at review-burden capacity.

This plan is written to support **either path**. File list is the same; the only difference is which branch carries it.

---

## File structure

```
lib/sds/
  dummy-catalog.ts                   — typed const, 6 chemicals (~250 lines incl GHS data)
  types.ts                           — DummySds type (re-exports HazardCategory, ControlLevel from lib/risk/types)

actions/
  sds.ts                             — importSdsHazards server action (~80 lines)

components/admin/
  sds-integration-card.tsx           — server component for /admin/integrations card

components/sds/
  sds-import-modal.tsx               — client component: multi-select dialog, submit -> action
  sds-chemical-row.tsx               — one row in the modal list (pictograms + signal-word badge + hazard count)
  ghs-pictogram.tsx                  — small reusable component rendering one GHS pictogram by code

app/(app)/admin/integrations/
  page.tsx                           — server component: lists integration cards (just SDS Manager for now)

app/(app)/hazards/candidates/
  page.tsx                           — MODIFIED: add "Import from SDS Manager" button next to existing filter chips
```

**One env var added** (in `.env.local.example` + Vercel config):
```
NEXT_PUBLIC_SDS_MANAGER_URL=https://sds.placeholder.example
```

---

## The dummy catalog

**File:** `lib/sds/dummy-catalog.ts` — verbatim from SPEC §SDS.2. Six chemicals covering three hazard families:

| ID | Name | Pictograms | Signal | H-statements | Controls suggested |
|---|---|---|---|---|---|
| `SDS-TOL-001` | Toluene | GHS02 / GHS07 / GHS08 | Danger | H225, H315, H361d, H336 | 4 (eng × 2 / admin / ppe) |
| `SDS-SUL-001` | Sulfuric Acid 98% | GHS05 | Danger | H290, H314 | 4 (eng × 2 / admin / ppe) |
| `SDS-HYD-001` | Hydraulic Oil ISO VG 46 | — | Warning | H319, H413, n/a slip | 3 (eng / admin / ppe) |
| `SDS-IPA-001` | Isopropanol 99% | GHS02 / GHS07 | Danger | H225, H319, H336 | 4 (eng × 2 / admin / ppe) |
| `SDS-ACE-001` | Acetone | GHS02 / GHS07 | Danger | H225, H319, H336 | 3 (eng / admin / ppe) |
| `SDS-NAH-001` | Sodium Hydroxide 50% | GHS05 | Danger | H290, H314 | 4 (eng × 2 / admin / ppe) |

**Catalog realism note (from research §SDS.R6):** the 6-chemical set is acceptable for v1 but biased toward labs/manufacturing. If we want maximum pictogram coverage in a single demo, swap one of `{IPA, Acetone}` for **Formaldehyde** (adds health-hazard pictogram + healthcare relevance) or **Compressed Nitrogen** (adds gas-cylinder pictogram). **Not blocking** — flagged for a polish PR after first user feedback.

**Type:**

```typescript
// lib/sds/types.ts
import type { HazardCategory, ControlLevel } from '@/lib/risk/types';

export type GhsPictogramCode =
  | 'GHS01'|'GHS02'|'GHS03'|'GHS04'|'GHS05'
  | 'GHS06'|'GHS07'|'GHS08'|'GHS09';

export type DummySds = {
  id: string;
  product_name: string;
  manufacturer: string;
  cas_number: string;
  ghs_pictograms: GhsPictogramCode[];
  signal_word: 'danger' | 'warning';
  hazards: {
    category: HazardCategory;
    title: string;
    description: string;
    h_statement: string;
  }[];
  suggested_controls: {
    level: ControlLevel;
    description: string;
  }[];
};
```

---

## Server action

**File:** `actions/sds.ts`

```typescript
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/can';
import { DUMMY_SDS_CATALOG } from '@/lib/sds/dummy-catalog';
import type { ActionResult } from '@/lib/actions/result';

const ImportSchema = z.object({
  siteId: z.string().uuid(),
  sdsIds: z.array(z.string().min(1)).min(1).max(20),
});

export async function importSdsHazards(
  input: z.infer<typeof ImportSchema>
): Promise<ActionResult<{ count: number }>> {
  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  // RBAC: writing into hazard_candidates uses the same permission as worker-report hazard creation
  if (!await can(user.id, 'hazard:report', parsed.data.siteId)) {
    return { ok: false, error: 'Permission denied' };
  }

  const rows = [];
  for (const sdsId of parsed.data.sdsIds) {
    const sds = DUMMY_SDS_CATALOG.find(s => s.id === sdsId);
    if (!sds) continue;  // silently skip unknown IDs; defensive
    for (const hazard of sds.hazards) {
      rows.push({
        source_type: 'sds_import' as const,
        source_reference_id: sds.id,
        site_id: parsed.data.siteId,
        proposed_title: hazard.title,
        proposed_category: hazard.category,
        proposed_description: `${hazard.description}\n\n(H-statement: ${hazard.h_statement})`,
        proposed_metadata: {
          sds_id: sds.id,
          product_name: sds.product_name,
          cas_number: sds.cas_number,
          h_statement: hazard.h_statement,
          pictograms: sds.ghs_pictograms,                  // SPEC delta from research
          signal_word: sds.signal_word,
          suggested_controls: sds.suggested_controls,
        },
        status: 'pending_review' as const,
      });
    }
  }

  if (rows.length === 0) {
    return { ok: false, error: 'No valid chemicals selected' };
  }

  const { error } = await supabase.from('hazard_candidates').insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/hazards/candidates');
  return { ok: true, data: { count: rows.length } };
}
```

**Notes:**
- No new RBAC key. `hazard:report` (granted to `supervisor` + above by Phase 14) is the gate — same as a manually-reported hazard candidate. Site-scoped via the `siteId` parameter.
- Defensive `if (!sds) continue` covers the catalog-drift case (someone removes a chemical between modal-render and submit).
- `proposed_metadata` is a single jsonb blob; jsonb is forward-compatible for future real-API fields (revision date, expiry, manufacturer URL).

---

## Components

### `<SdsIntegrationCard>` — `components/admin/sds-integration-card.tsx`

Server component. Renders a shadcn `<Card>` with:
- Header: "SDS Manager" with a small `<ExternalLink>` icon
- Body: 2-sentence description ("SDS Manager is SDS Manager's chemical inventory and Safety Data Sheet platform. Import chemicals from your SDS Manager catalog to seed hazards in the register.")
- Two buttons:
  - **"Open SDS Manager"** — `<a target="_blank" rel="noopener">` to `process.env.NEXT_PUBLIC_SDS_MANAGER_URL` (or `https://sds.placeholder.example` fallback)
  - **"Import chemicals"** — `<Link>` to `/hazards/candidates?action=import-sds` (the candidates page reads `searchParams.action` and auto-opens the modal)

### `<SdsImportModal>` — `components/sds/sds-import-modal.tsx`

Client component. Opens from the "Import from SDS Manager" button on `/hazards/candidates`. Structure:
- shadcn `<Dialog>` with header "Import from SDS Manager"
- Site picker (defaults to the user's most-recently-active site from `useActiveSite()`)
- Scrollable list of 6 chemicals, each row is `<SdsChemicalRow>`:
  - Checkbox
  - Product name + CAS number
  - Signal-word badge (Danger = red / Warning = amber)
  - Pictogram chips via `<GhsPictogram>`
  - "N hazards" pill (count of `hazard[]`)
- Footer: "Import N candidates" button (disabled when no chemicals selected); count is `selected.reduce((sum, sds) => sum + sds.hazards.length, 0)`
- On submit: calls `importSdsHazards` server action via `useActionState`; on success, toast `"N hazard candidates created"` + close modal + revalidate list

### `<GhsPictogram>` — `components/sds/ghs-pictogram.tsx`

Tiny reusable component. Renders one GHS pictogram by code (GHS01–GHS09). For v2 stub, uses SVG-icon component (one per code, ~9 small files) — public-domain GHS pictograms ([Wikipedia GHS pictograms](https://commons.wikimedia.org/wiki/Category:GHS_pictograms) are CC0). Sized at 24×24 default with size prop. Wrapped in `<Tooltip>` with the pictogram name on hover ("Flame" / "Skull and crossbones" / etc.).

---

## Routes + UI integration

### `/admin/integrations`

**File:** `app/(app)/admin/integrations/page.tsx`

```typescript
// Server component
import { SdsIntegrationCard } from '@/components/admin/sds-integration-card';

export default async function IntegrationsPage() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground">Connect external systems to your EHS data.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SdsIntegrationCard />
        {/* Future: training providers, HSE/OSHA APIs, etc. */}
      </div>
    </div>
  );
}
```

**Sidebar entry:** Under the **Admin** group (existing sidebar group from Phase 11), add a new nav item:

```typescript
{ href: '/admin/integrations', label: 'Integrations', icon: Plug, perm: 'org:admin' }
```

(`org:admin` is the existing permission key from Phase 11 that gates the admin section.)

### `/hazards/candidates` modification

`app/(app)/hazards/candidates/page.tsx` (created by Phase 14) gets one button next to the existing filter chips:

```typescript
<Button variant="outline" onClick={() => setImportModalOpen(true)}>
  <Plug className="mr-2 h-4 w-4" />
  Import from SDS Manager
</Button>
<SdsImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
```

Auto-open behavior: if `searchParams.action === 'import-sds'`, modal opens on mount. Lets the `/admin/integrations` "Import chemicals" link deep-link straight into the modal.

---

## Verification steps

Local boot (assuming Phase 14 is on `main` or in the same PR):

```bash
pnpm install
pnpm dev
```

**Acceptance checks (manual):**

1. **`/admin/integrations` renders.** As `site_admin`, navigate to `/admin/integrations` → SDS Manager card visible with both buttons.
2. **External link works.** Click "Open SDS Manager" → opens `https://sds.placeholder.example` in a new tab.
3. **Env override works.** Set `NEXT_PUBLIC_SDS_MANAGER_URL=https://example.com/sds` in `.env.local` → restart dev → link target updates.
4. **Deep-link to modal.** Click "Import chemicals" → lands on `/hazards/candidates?action=import-sds` with the modal pre-opened.
5. **Modal shows 6 chemicals.** Each row has product name + CAS + signal-word badge + pictograms + hazard count.
6. **Single-chemical import.** Select Toluene only → click "Import 4 candidates" → 4 rows appear in `hazard_candidates` (one per H-statement: H225, H315, H361d, H336). Each carries `source_type='sds_import'`, `source_reference_id='SDS-TOL-001'`, full `proposed_metadata` with pictograms array.
7. **Multi-chemical import.** Select Toluene + Sulfuric Acid → click Import → 6 rows created (4 + 2). Toast confirms count.
8. **Candidate review pre-fills suggested controls.** Open one of the new candidates → Convert form → controls section pre-populated from `proposed_metadata.suggested_controls`. Saves through to the new hazard's `hazard_controls` rows on conversion.
9. **GHS pictograms render in candidate row.** The §HZ candidate queue (Phase 14) displays the pictograms from `proposed_metadata.pictograms` on each SDS-imported candidate.
10. **RLS.** A `worker` cannot open `/admin/integrations` (no `org:admin`). A `supervisor` can import (has `hazard:report`); a `worker` cannot (the modal's submit button is hidden or returns "Permission denied").

---

## Out-of-scope (explicit deferrals)

- `sds_records` table (v2.5 / real-API phase)
- `sds_chemical_uses` table (v2.5)
- SDS revision history (v2.5)
- Live API calls to SDS Manager backend (v2.5)
- Inventory / container-level tracking (separate module)
- Mobile SDS lookup + QR codes (separate module)
- Multi-language SDS body (v3)
- GHS workplace label generation (v3)
- Storage-compatibility / segregation alerts (separate module)
- Chemical-substitution workflow (v2.5)
- Worker-training tie-in (depends on Training module, v3)
- Catalog swap for broader pictogram coverage (Formaldehyde / Compressed Nitrogen) — v2 polish PR

---

## Open questions for kickoff Q&A

1. **Combine with Phase 14 PR or ship standalone?** Default: **combine** per research §SDS.R7 (small scope, mechanical dep, co-design value on `proposed_metadata`). Override only if Phase 14 PR is already at review-burden capacity.
2. **Catalog swap for broader pictogram coverage.** Default: **keep all 6 as-is** for v1 demo. Swap one of `{IPA, Acetone}` for **Formaldehyde** if healthcare demo is the priority, or **Compressed Nitrogen** if manufacturing is. Easy polish PR after first user feedback; not blocking.
3. **Sidebar location for `/admin/integrations`.** Default: under the **Admin** sidebar group (where Sites / Members / Roles already live). Alternative: top-level. Going admin-grouped — integrations are org-admin concerns, not daily operational ones.
4. **Modal site picker default.** Default: most-recently-active site from `useActiveSite()`. Alternative: all sites the user has `hazard:report` on, shown as a multi-select for batch-importing across sites. Going single-site — keeps the demo flow tight; cross-site batch is a v2 polish if demand surfaces.
5. **Pictogram asset bundling.** Default: 9 inline SVG components in `components/sds/pictograms/` (one per code). Alternative: `<Image src='/ghs/GHS02.svg'>`. Going inline SVG — no public-asset path management, no flash-of-unstyled at small sizes, tree-shakeable per pictogram.
