import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Pencil, UserCheck, AlertOctagon, CheckCircle } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { INCIDENT_TYPE_META, type IncidentType } from "@/lib/incidents/types";
import { SeverityBadge, TrackBadge, StatusBadge } from "@/components/incidents/badges";
import { BodyMap, BODY_PART_LABELS, type BodyPart } from "@/components/body-map/body-map";
import { TriageModals, type SiteMemberOption } from "@/components/incidents/triage-modals";
import { LinkedDocumentsSection } from "@/components/documents/linked-documents-section";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import type { ArgusPageContext } from "@/lib/argus/page-context";

type Params = Promise<{ id: string }>;

export default async function IncidentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, profile, currentSiteId } = await requireUser();

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      `
      id, ref_code, type, title, description, occurred_at, area, location,
      severity, track, status, classified_at, closed_at, is_sandbox,
      reporter_id, ppe_worn, substance, quantity_value, quantity_unit,
      equipment, dangerous_occurrence_kind, site_id, equipment_asset_id,
      deleted_at,
      asset:equipment_asset_id(id, ref_code, name, kind, condition),
      reporter:reporter_id(full_name, email),
      injured_persons(name, body_parts, treatment, fatality, hospitalized, riddor_specified_injury),
      witnesses(name, contact, statement)
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!incident) notFound();
  if (incident.deleted_at) {
    return <DeletedNotice refCode={incident.ref_code} deletedAt={incident.deleted_at} />;
  }
  if (incident.status === "draft") redirect(`/incidents/new/3?id=${incident.id}`);

  const meta = INCIDENT_TYPE_META[incident.type as IncidentType];
  const TypeIcon = meta?.icon;
  const reporter = incident.reporter;
  const isClosed = incident.status === "closed";

  const [canOverride, canAssign, canClose] = currentSiteId
    ? await Promise.all([
        can("incident:override_severity", currentSiteId),
        can("incident:assign", currentSiteId),
        can("incident:close", currentSiteId),
      ])
    : [false, false, false];

  // Aside cards + triage modal data — fan out in parallel.
  const [
    overridesRes,
    investigationRes,
    attachmentsRes,
    siteMembersRes,
  ] = await Promise.all([
    supabase
      .from("severity_overrides")
      .select(
        "original_severity, new_severity, reason, overridden_by, created_at, profile:overridden_by(full_name, email)",
      )
      .eq("incident_id", incident.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("investigations")
      .select(
        "id, ref_code, status, due_date, lead_investigator_id, lead:lead_investigator_id(full_name, email)",
      )
      .eq("incident_id", incident.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("incident_attachments")
      .select("id, file_name, storage_path, mime_type, size_bytes, created_at")
      .eq("incident_id", incident.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("site_members")
      .select("profile:profiles(id, full_name, email), role:roles(key)")
      .eq("site_id", incident.site_id),
  ]);

  const overrides = overridesRes.data ?? [];
  const investigation = investigationRes.data;
  const attachments = attachmentsRes.data;
  const siteMembersRaw = siteMembersRes.data;
  const members: SiteMemberOption[] = (siteMembersRaw ?? [])
    .filter((m) => m.profile)
    .map((m) => ({
      id: m.profile!.id,
      full_name: m.profile!.full_name,
      email: m.profile!.email,
      role_key: m.role?.key ?? "worker",
    }));

  const argusContext: ArgusPageContext = {
    route: "incident_detail",
    routeLabel: incident.ref_code ? `Incident ${incident.ref_code}` : "Incident",
    siteId: incident.site_id,
    aggregates: {
      injured_persons: incident.injured_persons?.length ?? 0,
      witnesses: incident.witnesses?.length ?? 0,
    },
    records: [
      {
        kind: "incident" as const,
        id: incident.id,
        refCode: incident.ref_code,
        title: incident.severity
          ? `${incident.severity} ${incident.type}${incident.track ? ` · Track ${incident.track}` : ""}`
          : incident.type,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <ArgusContextPayload context={argusContext} />
      <Header
        refCode={incident.ref_code}
        title={incident.title}
        type={incident.type as IncidentType}
        severity={incident.severity}
        track={incident.track}
        status={incident.status}
        isSandbox={incident.is_sandbox}
        TypeIcon={TypeIcon}
      />

      {!isClosed && (canOverride || canAssign || canClose) && (
        <TriageBar
          canOverride={canOverride}
          canAssign={canAssign}
          canClose={canClose}
          isTrackC={incident.track === "C"}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card title="What happened">
            <dl className="space-y-2 text-sm">
              <Row label="When" value={new Date(incident.occurred_at).toLocaleString()} />
              <Row
                label="Where"
                value={[incident.area, incident.location].filter(Boolean).join(" / ") || "—"}
              />
              <Row label="Reporter" value={reporter?.full_name ?? reporter?.email ?? "—"} />
            </dl>
            {incident.description && (
              <p className="mt-3 whitespace-pre-line text-sm">{incident.description}</p>
            )}
          </Card>

          {incident.injured_persons && incident.injured_persons.length > 0 && (
            <Card title={incident.type === "injury" ? "Injured persons" : "Affected persons"}>
              <ul className="space-y-4">
                {incident.injured_persons.map((p, i) => (
                  <li key={i} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs uppercase text-muted-foreground">
                        {p.treatment === "none" ? "no treatment" : p.treatment?.replace("_", " ")}
                      </span>
                    </div>
                    {(p.body_parts ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(p.body_parts as BodyPart[]).map((bp) => (
                          <span key={bp} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {BODY_PART_LABELS[bp]}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {p.hospitalized && <span>· Hospitalized</span>}
                      {p.fatality && <span className="text-destructive">· Fatality</span>}
                      {p.riddor_specified_injury && (
                        <span>· RIDDOR: {String(p.riddor_specified_injury).replace(/_/g, " ")}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(incident.substance || incident.quantity_value || incident.equipment) && (
            <Card title="Type-specific details">
              <dl className="space-y-2 text-sm">
                {incident.substance && <Row label="Substance" value={incident.substance} />}
                {incident.quantity_value !== null && (
                  <Row
                    label="Quantity"
                    value={`${incident.quantity_value} ${incident.quantity_unit ?? ""}`.trim()}
                  />
                )}
                {incident.equipment && <Row label="Equipment" value={incident.equipment} />}
                {incident.dangerous_occurrence_kind && (
                  <Row label="Schedule 2 kind" value={incident.dangerous_occurrence_kind} />
                )}
                {(incident.ppe_worn ?? []).length > 0 && (
                  <Row label="PPE worn" value={(incident.ppe_worn ?? []).join(", ")} />
                )}
              </dl>
            </Card>
          )}

          {incident.asset && (
            <Card title="Linked asset">
              <Link
                href={`/resources/assets/${incident.asset.id}`}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{incident.asset.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {incident.asset.ref_code}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {String(incident.asset.kind).replace(/_/g, " ")} ·{" "}
                  {incident.asset.condition}
                </span>
              </Link>
            </Card>
          )}

          {attachments && attachments.length > 0 && (
            <Card title="Attachments">
              <ul className="space-y-1">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{a.file_name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Direct uploads from the Report Wizard (incident-attachments bucket).
              </p>
            </Card>
          )}

          <Card title="Linked library documents">
            <LinkedDocumentsSection
              parentType="incident"
              parentId={incident.id}
              orgId={profile.org_id}
              defaultLinkRole="attachment"
              title=""
              emptyHint="No library documents linked. Use Add document to attach a SDS, SOP, or evidence file from the org library."
            />
          </Card>

          {incident.witnesses && incident.witnesses.length > 0 && (
            <Card title="Witnesses">
              <ul className="space-y-3">
                {incident.witnesses.map((w, i) => (
                  <li key={i} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="font-medium">{w.name}</div>
                    {w.contact && <div className="text-xs text-muted-foreground">{w.contact}</div>}
                    {w.statement && <p className="mt-1 text-sm whitespace-pre-line">{w.statement}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Severity">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <TrackBadge track={incident.track} />
            </div>
            {overrides.length > 0 && <OverrideHistory overrides={overrides} />}
          </Card>

          {investigation && (
            <Card title="Investigation">
              <Link
                href={`/investigations/${investigation.id}`}
                className="flex items-center justify-between gap-2 text-sm hover:underline"
              >
                <span>
                  <span className="font-mono text-xs">{investigation.ref_code}</span>{" "}
                  · {String(investigation.status).replace(/_/g, " ")}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              {investigation.lead && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Lead: {investigation.lead.full_name ?? investigation.lead.email}
                </div>
              )}
              {investigation.due_date && (
                <div className="text-xs text-muted-foreground">Due: {investigation.due_date}</div>
              )}
            </Card>
          )}

          <Card title="Reporter">
            <div className="text-sm">{reporter?.full_name ?? reporter?.email ?? "—"}</div>
            {reporter?.email && (
              <div className="text-xs text-muted-foreground">{reporter.email}</div>
            )}
          </Card>
        </aside>
      </div>

      <Suspense fallback={null}>
        <TriageModals
          incidentId={incident.id}
          currentSeverity={incident.severity as "S1" | "S2" | "S3" | "S4" | "S5" | null}
          track={incident.track as "A" | "B" | "C" | null}
          members={members}
        />
      </Suspense>
    </div>
  );
}

function Header({
  refCode,
  title,
  type,
  severity,
  track,
  status,
  isSandbox,
  TypeIcon,
}: {
  refCode: string | null;
  title: string;
  type: IncidentType;
  severity: string | null;
  track: string | null;
  status: string;
  isSandbox: boolean;
  TypeIcon: React.ComponentType<{ className?: string }> | undefined;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link href="/incidents" className="text-muted-foreground hover:underline">
          ← Incidents
        </Link>
        <span className="font-mono uppercase text-muted-foreground">{refCode ?? "—"}</span>
      </div>
      <div className="flex items-start gap-3">
        {TypeIcon && <TypeIcon className="mt-1 h-6 w-6 text-primary" />}
        <div className="flex-1 space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {INCIDENT_TYPE_META[type]?.label}
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={severity} />
            <TrackBadge track={track} />
            <StatusBadge status={status} />
            {isSandbox && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Practice (sandbox)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TriageBar({
  canOverride,
  canAssign,
  canClose,
  isTrackC,
}: {
  canOverride: boolean;
  canAssign: boolean;
  canClose: boolean;
  isTrackC: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
      {canOverride && <ActionLink href="?action=override" icon={Pencil} label="Override severity" />}
      {canAssign && <ActionLink href="?action=assign" icon={UserCheck} label="Assign owner" />}
      {canAssign && <ActionLink href="?action=escalate" icon={AlertOctagon} label="Escalate" />}
      {canClose && isTrackC && <ActionLink href="?action=close" icon={CheckCircle} label="Close" />}
    </div>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

type OverrideRow = {
  original_severity: string | null;
  new_severity: string | null;
  reason: string | null;
  created_at: string;
  profile: { full_name: string | null; email: string } | null;
};

function OverrideHistory({ overrides }: { overrides: OverrideRow[] }) {
  return (
    <details className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">
            Override history ({overrides.length})
          </span>
          <span className="text-[10px] uppercase tracking-wide">Show all</span>
        </div>
        {/* Always-visible latest entry as a preview */}
        <div className="mt-2 space-y-0.5">
          <div>
            {overrides[0].original_severity} → {overrides[0].new_severity}
          </div>
          <div>
            by {overrides[0].profile?.full_name ?? overrides[0].profile?.email ?? "—"} ·{" "}
            {new Date(overrides[0].created_at).toLocaleDateString()}
          </div>
          {overrides[0].reason && (
            <p className="italic">&quot;{overrides[0].reason}&quot;</p>
          )}
        </div>
      </summary>
      {overrides.length > 1 && (
        <ul className="mt-3 space-y-3 border-t border-border/60 pt-3">
          {overrides.slice(1).map((o, i) => (
            <li key={i} className="space-y-0.5">
              <div>
                {o.original_severity} → {o.new_severity}
              </div>
              <div>
                by {o.profile?.full_name ?? o.profile?.email ?? "—"} ·{" "}
                {new Date(o.created_at).toLocaleDateString()}
              </div>
              {o.reason && <p className="italic">&quot;{o.reason}&quot;</p>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function DeletedNotice({
  refCode,
  deletedAt,
}: {
  refCode: string | null;
  deletedAt: string;
}) {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center ring-1 ring-foreground/5">
      <h1 className="text-lg font-semibold">This incident was deleted</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {refCode && (
          <>
            <span className="font-mono">{refCode}</span> ·{" "}
          </>
        )}
        Soft-deleted by an admin on{" "}
        {new Date(deletedAt).toLocaleDateString()}. The record is retained for
        OSHA / RIDDOR retention but is no longer visible in active feeds.
      </p>
      <Link
        href="/incidents"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
      >
        ← Back to incidents
      </Link>
    </div>
  );
}
