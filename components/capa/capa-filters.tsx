"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CapaTabKey } from "@/lib/capa/types";

export type CapaFilterState = {
  /** "" = current site (cookie default); "all" = all accessible; <uuid> = specific site */
  site: string;
  /** "" = any owner; <uuid> = specific owner */
  owner: string;
  /** Currently-active tab — preserved when filter chips re-build the URL */
  tab: CapaTabKey;
};

type SiteOption = { id: string; name: string };
type OwnerOption = { id: string; full_name: string | null; email: string };

/**
 * Two URL-driven filter dropdowns next to the tab strip:
 *   ?site=all|<uuid>      — default "" = current site (cookie)
 *   ?owner=<uuid>         — default "" = any owner; the Mine tab covers the
 *                           "owned by me" case so we don't add a "me" shorthand.
 *
 * Mirrors the planner-shape Site filter introduced in Phase 6c. Verifier /
 * due-window / source filters were analyzed in plans/06d-capa-polish.md and
 * deferred to v2.
 */
export function CapaFilters({
  current,
  sites,
  owners,
  currentUserId,
}: {
  current: CapaFilterState;
  sites: SiteOption[];
  owners: OwnerOption[];
  currentUserId: string;
}) {
  const router = useRouter();

  const buildHref = (overrides: Partial<CapaFilterState>) => {
    const next: CapaFilterState = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (next.tab !== "mine") params.set("tab", next.tab);
    if (next.site) params.set("site", next.site);
    if (next.owner) params.set("owner", next.owner);
    const qs = params.toString();
    return qs ? `/capa?${qs}` : "/capa";
  };

  const noFiltersActive = !current.site && !current.owner;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {sites.length > 1 && (
        <label className="flex items-center gap-1.5">
          <span>Site</span>
          <select
            value={current.site}
            onChange={(e) => router.push(buildHref({ site: e.target.value }))}
            className="rounded-md border bg-background px-2 py-1 text-foreground"
            aria-label="Filter by site"
          >
            <option value="">— current site —</option>
            <option value="all">All accessible sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-1.5">
        <span>Owner</span>
        <select
          value={current.owner}
          onChange={(e) => router.push(buildHref({ owner: e.target.value }))}
          className="rounded-md border bg-background px-2 py-1 text-foreground"
          aria-label="Filter by owner"
        >
          <option value="">— anyone —</option>
          {owners
            .filter((o) => o.id !== currentUserId)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name ?? o.email}
              </option>
            ))}
        </select>
      </label>
      {!noFiltersActive && (
        <Link
          href={buildHref({ site: "", owner: "" })}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
