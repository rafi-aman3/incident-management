# Phase 19b — Sites Map on Org Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans`.

**Status:** drafted 2026-05-12 — spec: `docs/superpowers/specs/2026-05-12-org-dashboard-design.md`
**Goal:** Add a full-width Leaflet sites map to `/dashboard`, with one pin per site that has lat/long. Pin color reflects site posture (green/amber/red). Clicking a pin navigates to `/sites/[id]`.
**Estimated duration:** ~half day.
**Depends on:** **19a closed** (`/sites/[id]` route exists as the click target; `/dashboard` is org-scoped).
**Branch:** `feat/phase-19b-sites-map`
**PR target:** `main`
**New deps:** `leaflet`, `react-leaflet`, `@types/leaflet` (dev).
**Schema migration:** **none** — `sites.latitude` / `sites.longitude` already exist (Phase 13).

> **What this PR ships:**
> - `lib/dashboard/org/sites-map.ts` — aggregator that returns sites with coordinates + open S1/S2 count + stop-work flag.
> - `components/dashboard/sites-map.tsx` — Client-only Leaflet map (loaded via `dynamic({ ssr: false })`).
> - `components/dashboard/sites-map-card.tsx` — server-side card wrapper that runs the aggregator and renders the Client map or the empty state.
> - Leaflet's CSS imported once globally.
> - Mounted on `/dashboard` between the KPI strip and the Argus tiles.

> **Not in this PR:**
> - No clustering / heatmap. Pin-per-site is enough at typical customer scale.
> - No "edit coordinates" inline UX. Users edit at `/admin/site-setup` (already supported).
> - No map on `/sites/[id]` (single site doesn't need a map — would just be one pin).

---

## File map

```
package.json                                          ← modified (new deps)
app/globals.css                                       ← modified (import leaflet.css)
lib/dashboard/org/sites-map.ts                        ← new
components/dashboard/
  sites-map.tsx                                       ← new (Client)
  sites-map-card.tsx                                  ← new (Server wrapper)
app/(app)/dashboard/page.tsx                          ← modified (mount the card)
```

---

## Task 1 — Add dependencies

**Files:**
- Modify: `package.json` + `pnpm-lock.yaml`

- [ ] **Step 1.1 — Install**

```bash
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet
```

Expected: three packages added. `leaflet@1.x`, `react-leaflet@4.x` (or whatever current). Lockfile updates.

- [ ] **Step 1.2 — Verify versions are compatible with React 19**

`react-leaflet` v4 supports React 18+. If `pnpm install` warns about an unmet peer for React 19, pin to the latest `react-leaflet@^4.x` — it works fine in practice. Don't downgrade React.

- [ ] **Step 1.3 — Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(phase19b): add leaflet + react-leaflet + @types/leaflet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Import Leaflet's CSS once

Leaflet ships with a stylesheet that controls tile sizing, attribution, zoom controls. Import it once at app boot.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 2.1 — Add the import at the top of `app/globals.css`**

```css
@import "leaflet/dist/leaflet.css";
```

Place it as the first `@import` so Tailwind's `@import "tailwindcss"` line comes after. Tailwind v4 doesn't care about order for theme, but keeping Leaflet first means our utility classes can override Leaflet's defaults.

- [ ] **Step 2.2 — Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
chore(phase19b): import leaflet css in globals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `sites-map` aggregator

Returns one row per site with coordinates, plus the rollup flags we need to color the pin.

**Files:**
- Create: `lib/dashboard/org/sites-map.ts`

- [ ] **Step 3.1 — Write the aggregator**

```ts
// lib/dashboard/org/sites-map.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type SiteMapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Open S1/S2 incident count (any incident with severity in (S1,S2) and status != closed). */
  criticalOpen: number;
  /** True if any incident at the site has stop_work=true and stop_work_lifted_at IS NULL. */
  stopWorkActive: boolean;
};

export type SitesMapPayload = {
  markers: SiteMapMarker[];
  /** Number of sites in the org with NULL lat or NULL lng — render a footnote when > 0. */
  hiddenForMissingCoords: number;
};

export async function getSitesMapPayload(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<SitesMapPayload> {
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  const rows = sites ?? [];
  const withCoords = rows.filter(
    (s): s is typeof s & { latitude: number; longitude: number } =>
      s.latitude !== null && s.longitude !== null,
  );
  const hiddenForMissingCoords = rows.length - withCoords.length;

  if (withCoords.length === 0) {
    return { markers: [], hiddenForMissingCoords };
  }

  const ids = withCoords.map((s) => s.id);

  // Rollups — one query each, both cheap because they hit indexed columns.
  const [s1s2Res, stopRes] = await Promise.all([
    supabase
      .from("incidents")
      .select("site_id")
      .in("site_id", ids)
      .in("severity", ["S1", "S2"])
      .neq("status", "closed")
      .eq("is_sandbox", false)
      .is("deleted_at", null),
    supabase
      .from("incidents")
      .select("site_id")
      .in("site_id", ids)
      .eq("stop_work", true)
      .is("stop_work_lifted_at", null)
      .eq("is_sandbox", false)
      .is("deleted_at", null),
  ]);

  const criticalBySite = new Map<string, number>();
  (s1s2Res.data ?? []).forEach((r) => {
    criticalBySite.set(r.site_id, (criticalBySite.get(r.site_id) ?? 0) + 1);
  });
  const stopWorkSites = new Set((stopRes.data ?? []).map((r) => r.site_id));

  const markers: SiteMapMarker[] = withCoords.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.latitude,
    lng: s.longitude,
    criticalOpen: criticalBySite.get(s.id) ?? 0,
    stopWorkActive: stopWorkSites.has(s.id),
  }));

  return { markers, hiddenForMissingCoords };
}
```

> **Why a single `in()` query for each rollup** — we already have the site IDs in memory; a 2-query approach is faster + cheaper than N per-site count queries, and RLS still scopes both queries to the caller's accessible sites.

- [ ] **Step 3.2 — Commit**

```bash
git add lib/dashboard/org/sites-map.ts
git commit -m "$(cat <<'EOF'
feat(phase19b): sites-map aggregator with critical + stop-work rollups

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Client `<SitesMap>` component

Leaflet imports `window` at module load, so this MUST be a Client Component and the consuming server file MUST load it via `dynamic({ ssr: false })`. Don't render `<MapContainer>` from a Server Component.

**Files:**
- Create: `components/dashboard/sites-map.tsx`

- [ ] **Step 4.1 — Write the component**

```tsx
// components/dashboard/sites-map.tsx
"use client";

import L from "leaflet";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import type { SiteMapMarker } from "@/lib/dashboard/org/sites-map";

// Fix Leaflet's default icon URLs (Next bundling clobbers them). We use
// CircleMarker instead of Marker so default icons are not needed — but the
// patch is cheap insurance for anyone who later switches to <Marker>.
// @ts-expect-error — _getIconUrl is internal but conventional to patch.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

function colorFor(marker: SiteMapMarker): string {
  if (marker.stopWorkActive) return "#dc2626"; // red-600
  if (marker.criticalOpen > 0) return "#d97706"; // amber-600
  return "#16a34a"; // success green (per CLAUDE.md hard rule)
}

export function SitesMap({ markers }: { markers: SiteMapMarker[] }) {
  const router = useRouter();
  // Compute bounding box for fit-bounds. With one marker, Leaflet
  // refuses to fit a 0-area box — fall back to a manual zoom.
  const bounds: L.LatLngBoundsExpression | undefined =
    markers.length >= 2
      ? markers.map((m) => [m.lat, m.lng] as [number, number])
      : undefined;
  const center: [number, number] =
    markers.length === 1 ? [markers[0].lat, markers[0].lng] : [20, 0];
  const zoom = markers.length === 1 ? 10 : 2;

  return (
    <MapContainer
      bounds={bounds}
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-[360px] w-full rounded-md border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={9}
          pathOptions={{
            color: colorFor(m),
            fillColor: colorFor(m),
            fillOpacity: 0.7,
            weight: 2,
          }}
          eventHandlers={{
            click: () => router.push(`/sites/${m.id}`),
            keydown: (e) => {
              const ke = e.originalEvent as KeyboardEvent;
              if (ke.key === "Enter" || ke.key === " ") {
                router.push(`/sites/${m.id}`);
              }
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={false}>
            <div className="text-xs">
              <div className="font-semibold">{m.name}</div>
              {m.stopWorkActive && (
                <div className="text-red-600">Stop-work active</div>
              )}
              {!m.stopWorkActive && m.criticalOpen > 0 && (
                <div className="text-amber-700">
                  {m.criticalOpen} critical open
                </div>
              )}
              {!m.stopWorkActive && m.criticalOpen === 0 && (
                <div className="text-green-700">Clean</div>
              )}
              <div className="text-muted-foreground">Click to open →</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 4.2 — Stage the default marker images** (defensive — only needed if a future change swaps to `<Marker>`)

```bash
mkdir -p public/leaflet
cp node_modules/leaflet/dist/images/marker-icon.png public/leaflet/marker-icon.png
cp node_modules/leaflet/dist/images/marker-icon-2x.png public/leaflet/marker-icon-2x.png
cp node_modules/leaflet/dist/images/marker-shadow.png public/leaflet/marker-shadow.png
```

These are static assets, ~3KB each, no licensing concern (Leaflet is BSD-2). The patch on `L.Icon.Default` above keeps the option open even though we use `CircleMarker` today.

- [ ] **Step 4.3 — Commit**

```bash
git add components/dashboard/sites-map.tsx public/leaflet/
git commit -m "$(cat <<'EOF'
feat(phase19b): client-only Leaflet sites map with colored pins

Pins are CircleMarker (no icon assets needed). Click navigates to
/sites/[id]. Color: green = clean, amber = open S1/S2, red = stop-work
active. Default icon assets staged for future <Marker> usage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Server-side `<SitesMapCard>` wrapper

A small Server Component that runs the aggregator, renders the empty state when no coordinates, and otherwise dynamically loads the Client map.

**Files:**
- Create: `components/dashboard/sites-map-card.tsx`

- [ ] **Step 5.1 — Write the wrapper**

```tsx
// components/dashboard/sites-map-card.tsx
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSitesMapPayload } from "@/lib/dashboard/org/sites-map";

const SitesMap = dynamic(
  () => import("./sites-map").then((m) => m.SitesMap),
  { ssr: false, loading: () => <div className="h-[360px] w-full rounded-md border bg-muted/30" /> },
);

export async function SitesMapCard({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const payload = await getSitesMapPayload(supabase, orgId);

  if (payload.markers.length === 0) {
    return (
      <section className="rounded-md border bg-card p-6">
        <h2 className="text-sm font-semibold">Sites map</h2>
        <div className="mt-4 flex flex-col items-center gap-3 rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            No sites have coordinates yet. Add latitude/longitude in site setup
            to see your sites on the map.
          </p>
          <Link
            href="/admin/site-setup"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Open site setup →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Sites map</h2>
        {payload.hiddenForMissingCoords > 0 && (
          <p className="text-xs text-muted-foreground">
            {payload.hiddenForMissingCoords} site
            {payload.hiddenForMissingCoords === 1 ? "" : "s"} hidden — missing
            coordinates
          </p>
        )}
      </div>
      <SitesMap markers={payload.markers} />
    </section>
  );
}
```

> **Why `ssr: false` on the dynamic import:** Leaflet calls `window` at module load. Importing it server-side throws `ReferenceError: window is not defined`. The skeleton fallback keeps the layout stable while the Client chunk loads.

- [ ] **Step 5.2 — Commit**

```bash
git add components/dashboard/sites-map-card.tsx
git commit -m "$(cat <<'EOF'
feat(phase19b): server-side sites-map card with empty state

Wraps the Client Leaflet map with a Server Component that runs the
aggregator and renders the empty state when no coordinates exist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Mount on `/dashboard`

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 6.1 — Import + mount between KPIs and Argus tiles**

Near the top of the file:

```tsx
import { SitesMapCard } from "@/components/dashboard/sites-map-card";
```

In the JSX, between the KPI strip block (`<div className="grid grid-cols-2 ...">`) and the Argus tiles block (`{argusAvailable && (...)}`), add:

```tsx
<SitesMapCard orgId={profile.org_id} />
```

- [ ] **Step 6.2 — Smoke test**

```bash
pnpm dev
```

Open `/dashboard`:
1. Map renders below the KPI strip, above the Argus tiles.
2. Each site with coordinates shows a pin. Hovering shows a tooltip with the site name + posture. Click navigates to `/sites/[id]` (the stub from 19a).
3. If your demo org has no coordinates, the empty-state card renders with the "Open site setup →" CTA.
4. To test the partial-coverage footnote: in Supabase Studio set one site's `latitude` to NULL — reload, the footnote "1 site hidden — missing coordinates" appears above the map.
5. Pin colors: a site with no critical incidents = green. Add an incident with severity S1 → reload → pin turns amber. Set `stop_work = true` on that incident → red.

- [ ] **Step 6.3 — Commit**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase19b): mount sites map between KPI strip and Argus tiles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — Self-verification + PR

- [ ] **Step 7.1 — Lint + build**

```bash
pnpm lint
pnpm build
```

Build will produce a larger client bundle on `/dashboard` because of Leaflet. That's expected and matches the spec's documented ~50KB gzip cost.

- [ ] **Step 7.2 — Manual checklist**

- [ ] Map renders on `/dashboard`, empty state on orgs with no coordinates.
- [ ] Pin click navigates to `/sites/[id]`.
- [ ] Tooltip hover shows site name + posture; keyboard Enter on a focused pin navigates.
- [ ] Hidden-coords footnote appears when a subset of sites lack lat/lng.
- [ ] No `window is not defined` errors in server logs.

- [ ] **Step 7.3 — PR**

```bash
git push -u origin feat/phase-19b-sites-map

gh pr create --title "feat: phase 19b — sites map on org dashboard" --body "$(cat <<'EOF'
## Summary
- Full-width Leaflet sites map on `/dashboard` between KPI strip and Argus tiles.
- Pin color reflects posture: green = clean, amber = open S1/S2, red = stop-work.
- Click → `/sites/[id]`; empty state when no coordinates; footnote when partial.

## Changes
- New deps: `leaflet`, `react-leaflet`, `@types/leaflet`
- `lib/dashboard/org/sites-map.ts` — aggregator
- `components/dashboard/sites-map.tsx` — Client Leaflet
- `components/dashboard/sites-map-card.tsx` — server wrapper
- `app/globals.css` — import leaflet.css
- `app/(app)/dashboard/page.tsx` — mount card

## Test Plan
- [ ] Map renders + empty state works
- [ ] Pin click → /sites/[id]
- [ ] Pin colors correct for clean/critical/stop-work
- [ ] `pnpm lint` + `pnpm build` clean

Builds on Phase 19a.
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

- Spec coverage: ✓ Section (e) map; ✓ pin color rules; ✓ empty state; ✓ partial-coverage footnote; ✓ Leaflet+OSM provider; ✓ click → /sites/[id].
- Placeholder scan: clean.
- Type consistency: `SiteMapMarker` shape matches between aggregator return and component props.
