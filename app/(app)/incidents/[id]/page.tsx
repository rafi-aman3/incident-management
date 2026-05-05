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

type Params = Promise<{ id: string }>;

export default async function IncidentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, currentSiteId } = await requireUser();

  const { data: incident, error } = await supabase
    .from("incidents")
    .select(
      `
      id, ref_code, type, title, description, occurred_at, area, location,
      severity, track, status, classified_at, closed_at, is_sandbox,
      reporter_id, ppe_worn, substance, quantity_value, quantity_unit,
      equipment, dangerous_occurrence_kind, site_id,
      reporter:reporter_id(full_name, email),
      injured_persons(name, body_parts, treatment, fatality, hospitalized, riddor_specified_injury),
      witnesses(name, contact, statement)
      `
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !incident) notFound();
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

  // Latest severity-override (if any) for the audit card
  const { data: latestOverride } = await supabase
    .from("severity_overrides")
    .select("original_severity, new_severity, reason, overridden_by, created_at, profile:overridden_by(full_name, email)")
    .eq("incident_id", incident.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Linked investigation
  const { data: investigation } = await supabase
    .from("investigations")
    .select("id, ref_code, status, due_date, lead_investigator_id, lead:lead_investigator_id(full_name, email)")
    .eq("incident_id", incident.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Site members for triage modal pickers
  const { data: siteMembersRaw } = await supabase
    .from("site_members")
    .select("profile:profiles(id, full_name, email), role:roles(key)")
    .eq("site_id", incident.site_id);
  const members: SiteMemberOption[] = (siteMembersRaw ?? [])
    .filter((m) => m.profile)
    .map((m) => ({
      id: m.profile!.id,
      full_name: m.profile!.full_name,
      email: m.profile!.email,
      role_key: m.role?.key ?? "worker",
    }));

  return (
    <div className="space-y-6">
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
            {latestOverride && (
              <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-medium text-foreground">Latest override</div>
                <div>
                  {latestOverride.original_severity} → {latestOverride.new_severity}
                </div>
                <div className="mt-1">
                  by {latestOverride.profile?.full_name ?? latestOverride.profile?.email ?? "—"} ·{" "}
                  {new Date(latestOverride.created_at).toLocaleDateString()}
                </div>
                <p className="mt-1 italic">&quot;{latestOverride.reason}&quot;</p>
              </div>
            )}
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
