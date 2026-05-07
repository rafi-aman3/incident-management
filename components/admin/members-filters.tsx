"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type MembersFilterState = {
  role: string; // role_id or ""
  site: string; // site_id or ""
  q: string;
};

type RoleOpt = { id: string; name: string; key: string };
type SiteOpt = { id: string; name: string };

export function MembersFilters({
  current,
  roles,
  sites,
}: {
  current: MembersFilterState;
  roles: RoleOpt[];
  sites: SiteOpt[];
}) {
  const router = useRouter();

  const buildHref = (overrides: Partial<MembersFilterState>) => {
    const next = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (next.role) params.set("role", next.role);
    if (next.site) params.set("site", next.site);
    if (next.q) params.set("q", next.q);
    const qs = params.toString();
    return qs ? `/admin/members?${qs}` : "/admin/members";
  };

  const noFiltersActive = !current.role && !current.site && !current.q;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="All"
          active={noFiltersActive}
          href={buildHref({ role: "", site: "", q: "" })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <span>Role</span>
          <select
            value={current.role}
            onChange={(e) => router.push(buildHref({ role: e.target.value }))}
            className="rounded-md border bg-background px-2 py-1 text-foreground"
            aria-label="Filter by role"
          >
            <option value="">— any role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span>Site</span>
          <select
            value={current.site}
            onChange={(e) => router.push(buildHref({ site: e.target.value }))}
            className="rounded-md border bg-background px-2 py-1 text-foreground"
            aria-label="Filter by site"
          >
            <option value="">— any site —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="ml-auto flex flex-1 items-center gap-2">
          <span className="sr-only">Search by name or email</span>
          <input
            type="search"
            defaultValue={current.q}
            placeholder="Search by name or email…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                router.push(buildHref({ q: e.currentTarget.value }));
              }
            }}
            className="w-full max-w-sm rounded-md border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </label>
        {current.q && (
          <Link
            href={buildHref({ q: "" })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );
}
