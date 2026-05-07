"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type InvestigationFilterState = {
  severity: string | null;
  status: string | null;
  site: string;
  lead: string;
  view: "kanban" | "list";
};

type SiteOption = { id: string; name: string };
type LeadOption = { id: string; full_name: string | null; email: string };

export function InvestigationFilters({
  current,
  sites,
  leads,
  currentUserId,
}: {
  current: InvestigationFilterState;
  sites: SiteOption[];
  leads: LeadOption[];
  currentUserId: string;
}) {
  const router = useRouter();

  const buildHref = (overrides: Partial<InvestigationFilterState>) => {
    const next: InvestigationFilterState = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (next.severity) params.set("severity", next.severity);
    if (next.status) params.set("status", next.status);
    if (next.site) params.set("site", next.site);
    if (next.lead) params.set("lead", next.lead);
    if (next.view === "list") params.set("view", "list");
    const qs = params.toString();
    return qs ? `/investigations?${qs}` : "/investigations";
  };

  const noFiltersActive =
    !current.severity && !current.status && !current.site && !current.lead;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="All"
          active={noFiltersActive}
          href={buildHref({ severity: null, status: null, site: "", lead: "" })}
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
          label="Pending"
          active={current.status === "pending_assignment"}
          href={buildHref({
            status: current.status === "pending_assignment" ? null : "pending_assignment",
          })}
        />
        <FilterChip
          label="In progress"
          active={current.status === "in_progress"}
          href={buildHref({
            status: current.status === "in_progress" ? null : "in_progress",
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
            aria-current={current.view === "kanban" ? "page" : undefined}
            className={cn(
              "rounded px-2 py-1 font-medium",
              current.view === "kanban"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            Kanban
          </Link>
          <Link
            href={buildHref({ view: "list" })}
            aria-current={current.view === "list" ? "page" : undefined}
            className={cn(
              "rounded px-2 py-1 font-medium",
              current.view === "list"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            List
          </Link>
        </div>
      </div>

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
          <span>Lead</span>
          <select
            value={current.lead}
            onChange={(e) => router.push(buildHref({ lead: e.target.value }))}
            className="rounded-md border bg-background px-2 py-1 text-foreground"
            aria-label="Filter by lead"
          >
            <option value="">— anyone —</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {leads
              .filter((l) => l.id !== currentUserId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name ?? l.email}
                </option>
              ))}
          </select>
        </label>
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
