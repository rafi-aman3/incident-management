import Link from "next/link";
import { cn } from "@/lib/utils";

export type InvestigationFilterState = {
  severity: string | null;
  status: string | null;
  view: "kanban" | "list";
};

export function InvestigationFilters({
  current,
}: {
  current: InvestigationFilterState;
}) {
  const buildHref = (overrides: Partial<InvestigationFilterState>) => {
    const next: InvestigationFilterState = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (next.severity) params.set("severity", next.severity);
    if (next.status) params.set("status", next.status);
    if (next.view === "list") params.set("view", "list");
    const qs = params.toString();
    return qs ? `/investigations?${qs}` : "/investigations";
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChip
        label="All"
        active={!current.severity && !current.status}
        href={buildHref({ severity: null, status: null })}
      />
      <FilterChip
        label="S1"
        active={current.severity === "S1"}
        href={buildHref({ severity: current.severity === "S1" ? null : "S1" })}
      />
      <FilterChip
        label="S2"
        active={current.severity === "S2"}
        href={buildHref({ severity: current.severity === "S2" ? null : "S2" })}
      />
      <FilterChip
        label="S3"
        active={current.severity === "S3"}
        href={buildHref({ severity: current.severity === "S3" ? null : "S3" })}
      />
      <span className="mx-2 h-4 w-px bg-border" aria-hidden />
      <FilterChip
        label="Open"
        active={
          current.status === "in_progress" || current.status === "pending_assignment"
        }
        href={buildHref({
          status:
            current.status === "in_progress" || current.status === "pending_assignment"
              ? null
              : "in_progress",
        })}
      />
      <FilterChip
        label="Awaiting CAPA"
        active={current.status === "awaiting_capa"}
        href={buildHref({
          status: current.status === "awaiting_capa" ? null : "awaiting_capa",
        })}
      />
      <FilterChip
        label="Closed"
        active={current.status === "closed"}
        href={buildHref({ status: current.status === "closed" ? null : "closed" })}
      />
      <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5 text-xs">
        <Link
          href={buildHref({ view: "kanban" })}
          className={cn(
            "rounded px-2 py-1 font-medium",
            current.view === "kanban"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          )}
        >
          Kanban
        </Link>
        <Link
          href={buildHref({ view: "list" })}
          className={cn(
            "rounded px-2 py-1 font-medium",
            current.view === "list"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          )}
        >
          List
        </Link>
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
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
      )}
    >
      {label}
    </Link>
  );
}
