import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge, TrackBadge, StatusBadge } from "@/components/incidents/badges";
import { INCIDENT_TYPE_META, INCIDENT_TYPES } from "@/lib/incidents/types";
import { can } from "@/lib/auth/can";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IncidentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { supabase, currentSiteId } = await requireUser();

  const showSandbox = sp.sandbox === "1";
  const typeFilter = typeof sp.type === "string" ? sp.type : null;
  const statusFilter = typeof sp.status === "string" ? sp.status : null;
  const severityFilter = typeof sp.severity === "string" ? sp.severity : null;

  const canReportIncident = currentSiteId ? await can("incident:report", currentSiteId) : false;

  type IncidentTypeEnum = (typeof INCIDENT_TYPES)[number];
  type StatusEnum = "draft" | "submitted" | "classified" | "under_investigation" | "awaiting_capa" | "closed";
  type SeverityEnum = "S1" | "S2" | "S3" | "S4" | "S5";

  let query = supabase
    .from("incidents")
    .select(
      "id, ref_code, type, title, severity, track, status, occurred_at, is_sandbox, reporter_id, reporter:reporter_id(full_name, email)"
    )
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (currentSiteId) query = query.eq("site_id", currentSiteId);
  if (!showSandbox) query = query.eq("is_sandbox", false);
  if (typeFilter && (INCIDENT_TYPES as readonly string[]).includes(typeFilter)) {
    query = query.eq("type", typeFilter as IncidentTypeEnum);
  }
  if (statusFilter) query = query.eq("status", statusFilter as StatusEnum);
  if (severityFilter) query = query.eq("severity", severityFilter as SeverityEnum);

  const { data: incidents, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Module 1</p>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            Site-scoped feed of every reported event. Filter, sort, and triage from here.
          </p>
        </div>
        {canReportIncident && (
          <Link
            href="/incidents/new/1"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Report incident
          </Link>
        )}
      </div>

      <Filters current={{ type: typeFilter, status: statusFilter, severity: severityFilter, showSandbox }} />

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {incidents && incidents.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">No incidents yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Once your team starts reporting, this view fills up.
          </p>
          {canReportIncident && (
            <Link
              href="/incidents/new/1"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Report your first incident
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Occurred</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Track</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reporter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents?.map((row) => {
                const meta = INCIDENT_TYPE_META[row.type as keyof typeof INCIDENT_TYPE_META];
                const TypeIcon = meta?.icon;
                const reporter = row.reporter;
                const reporterName = reporter?.full_name ?? reporter?.email ?? "—";
                return (
                  <TableRow key={row.id} className="hover:bg-accent">
                    <TableCell className="tabular-nums font-mono text-xs">
                      <Link href={`/incidents/${row.id}`} className="hover:underline">
                        {row.ref_code ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {TypeIcon && <TypeIcon className="h-4 w-4 text-muted-foreground" />}
                        {meta?.label}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <Link href={`/incidents/${row.id}`} className="hover:underline">
                        <div className="font-medium">{row.title}</div>
                        {row.is_sandbox && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">(practice)</div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {row.occurred_at ? new Date(row.occurred_at).toLocaleDateString() : "—"}
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
                    <TableCell className="text-sm text-muted-foreground">{reporterName}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Filters({
  current,
}: {
  current: { type: string | null; status: string | null; severity: string | null; showSandbox: boolean };
}) {
  const buildHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const t = overrides.type !== undefined ? overrides.type : current.type;
    const s = overrides.status !== undefined ? overrides.status : current.status;
    const sev = overrides.severity !== undefined ? overrides.severity : current.severity;
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
        href={buildHref({ severity: current.severity === "S1" ? null : "S1" })}
      />
      <FilterChip
        label="S2"
        active={current.severity === "S2"}
        href={buildHref({ severity: current.severity === "S2" ? null : "S2" })}
      />
      <FilterChip
        label="Open"
        active={current.status === "under_investigation"}
        href={buildHref({
          status: current.status === "under_investigation" ? null : "under_investigation",
        })}
      />
      <FilterChip
        label="Closed"
        active={current.status === "closed"}
        href={buildHref({ status: current.status === "closed" ? null : "closed" })}
      />
      <span className="ml-auto text-xs text-muted-foreground">
        <Link
          href={current.showSandbox ? "/incidents" : "/incidents?sandbox=1"}
          className="hover:underline"
        >
          {current.showSandbox ? "Hide sandbox" : "Show sandbox"}
        </Link>
      </span>
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
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
