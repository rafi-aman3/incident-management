import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SeverityBadge,
  TrackBadge,
  StatusBadge,
} from "@/components/incidents/badges";
import { INCIDENT_TYPE_META } from "@/lib/incidents/types";

export type ListRow = {
  id: string;
  ref_code: string | null;
  type: string;
  title: string | null;
  severity: string | null;
  track: string | null;
  status: string | null;
  occurred_at: string | null;
  is_sandbox: boolean | null;
  reporter: { full_name: string | null; email: string } | null;
  site: { name: string | null } | null;
};

export type ListFilters = {
  type: string | null;
  status: string | null;
  severity: string | null;
  showSandbox: boolean;
};

export function IncidentsListSurface({
  rows,
  filters,
  canViewSandbox,
}: {
  rows: ListRow[];
  filters: ListFilters;
  canViewSandbox: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <ListFilters current={filters} canViewSandbox={canViewSandbox} />
      <div className="mt-3 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Occurred</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Track</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reporter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No incidents match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const meta =
                  INCIDENT_TYPE_META[
                    row.type as keyof typeof INCIDENT_TYPE_META
                  ];
                const TypeIcon = meta?.icon;
                const reporterName =
                  row.reporter?.full_name ?? row.reporter?.email ?? "—";
                return (
                  <TableRow key={row.id} className="hover:bg-accent">
                    <TableCell className="tabular-nums font-mono text-xs">
                      <Link
                        href={`/incidents/${row.id}`}
                        className="hover:underline"
                      >
                        {row.ref_code ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {TypeIcon && (
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        {meta?.label}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <Link
                        href={`/incidents/${row.id}`}
                        className="hover:underline"
                      >
                        <div className="font-medium">{row.title}</div>
                        {row.is_sandbox && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            (practice)
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.site?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {row.occurred_at
                        ? new Date(row.occurred_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={row.severity ?? null} />
                    </TableCell>
                    <TableCell>
                      <TrackBadge track={row.track ?? null} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status ?? "draft"} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {reporterName}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ListFilters({
  current,
  canViewSandbox,
}: {
  current: ListFilters;
  canViewSandbox: boolean;
}) {
  const buildHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const t = overrides.type !== undefined ? overrides.type : current.type;
    const s =
      overrides.status !== undefined ? overrides.status : current.status;
    const sev =
      overrides.severity !== undefined ? overrides.severity : current.severity;
    if (t) params.set("type", t);
    if (s) params.set("status", s);
    if (sev) params.set("severity", sev);
    if (current.showSandbox) params.set("sandbox", "1");
    const qs = params.toString();
    return qs ? `/incidents?${qs}` : "/incidents";
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChip
        label="All"
        active={!current.type && !current.status && !current.severity}
        href="/incidents"
      />
      <FilterChip
        label="S1"
        active={current.severity === "S1"}
        href={buildHref({
          severity: current.severity === "S1" ? null : "S1",
        })}
      />
      <FilterChip
        label="S2"
        active={current.severity === "S2"}
        href={buildHref({
          severity: current.severity === "S2" ? null : "S2",
        })}
      />
      <FilterChip
        label="Open"
        active={current.status === "under_investigation"}
        href={buildHref({
          status:
            current.status === "under_investigation" ? null : "under_investigation",
        })}
      />
      <FilterChip
        label="Closed"
        active={current.status === "closed"}
        href={buildHref({ status: current.status === "closed" ? null : "closed" })}
      />
      {canViewSandbox && (
        <span className="ml-auto text-xs text-muted-foreground">
          <Link
            href={
              current.showSandbox ? "/incidents" : "/incidents?sandbox=1"
            }
            className="hover:underline"
          >
            {current.showSandbox ? "Hide sandbox" : "Show sandbox"}
          </Link>
        </span>
      )}
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
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );
}
