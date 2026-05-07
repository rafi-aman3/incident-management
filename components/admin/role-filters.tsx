"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type RoleFilterState = {
  type: "system" | "custom" | "";
  q: string;
};

export function RoleFilters({ current }: { current: RoleFilterState }) {
  const router = useRouter();

  const buildHref = (overrides: Partial<RoleFilterState>) => {
    const next = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (next.type) params.set("type", next.type);
    if (next.q) params.set("q", next.q);
    const qs = params.toString();
    return qs ? `/admin/roles?${qs}` : "/admin/roles";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="All" active={current.type === ""} href={buildHref({ type: "" })} />
        <FilterChip
          label="System"
          active={current.type === "system"}
          href={buildHref({ type: "system" })}
        />
        <FilterChip
          label="Custom"
          active={current.type === "custom"}
          href={buildHref({ type: "custom" })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="ml-auto flex flex-1 items-center gap-2">
          <span className="sr-only">Search by name</span>
          <input
            type="search"
            defaultValue={current.q}
            placeholder="Search by name…"
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
