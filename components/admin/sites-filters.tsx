"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type SitesFilterState = {
  status: "active" | "archived" | "all";
  country: "US" | "GB" | "all";
  q: string;
  view: "table" | "tree";
};

export function SitesFilters({ current }: { current: SitesFilterState }) {
  const router = useRouter();

  const buildHref = (overrides: Partial<SitesFilterState>) => {
    const next = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (next.status !== "active") params.set("status", next.status);
    if (next.country !== "all") params.set("country", next.country);
    if (next.q) params.set("q", next.q);
    if (next.view !== "table") params.set("view", next.view);
    const qs = params.toString();
    return qs ? `/admin/sites?${qs}` : "/admin/sites";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="Active"
          active={current.status === "active"}
          href={buildHref({ status: "active" })}
        />
        <FilterChip
          label="Archived"
          active={current.status === "archived"}
          href={buildHref({ status: "archived" })}
        />
        <FilterChip
          label="All"
          active={current.status === "all"}
          href={buildHref({ status: "all" })}
        />

        <span className="mx-2 h-4 w-px bg-border" aria-hidden />

        <FilterChip
          label="All countries"
          active={current.country === "all"}
          href={buildHref({ country: "all" })}
        />
        <FilterChip
          label="US"
          active={current.country === "US"}
          href={buildHref({ country: current.country === "US" ? "all" : "US" })}
        />
        <FilterChip
          label="GB"
          active={current.country === "GB"}
          href={buildHref({ country: current.country === "GB" ? "all" : "GB" })}
        />

        <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5 text-xs">
          <Link
            href={buildHref({ view: "table" })}
            aria-current={current.view === "table" ? "page" : undefined}
            className={cn(
              "rounded px-2 py-1 font-medium",
              current.view === "table"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            Table
          </Link>
          <Link
            href={buildHref({ view: "tree" })}
            aria-current={current.view === "tree" ? "page" : undefined}
            className={cn(
              "rounded px-2 py-1 font-medium",
              current.view === "tree"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            Tree
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only">Search sites by name</span>
          <input
            type="search"
            defaultValue={current.q}
            placeholder="Search sites by name…"
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
            Clear search
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
