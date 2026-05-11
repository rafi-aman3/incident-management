import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  HazardDetailTabs,
  HAZARD_TABS,
  type HazardTabKey,
} from "@/components/hazards/hazard-detail-tabs";
import {
  RiskBadge,
  HazardStatusBadge,
  CategoryBadge,
} from "@/components/hazards/risk-badges";
import { RiskAssessmentForm } from "@/components/hazards/risk-assessment-form";
import {
  ControlsSection,
  type ControlRow,
} from "@/components/hazards/controls-section";
import type { ControlLevel, RiskLevel } from "@/lib/risk/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ id: string }>;

function pickTab(raw: string | string[] | undefined): HazardTabKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && (HAZARD_TABS as readonly string[]).includes(v) ? (v as HazardTabKey) : "overview";
}

export default async function HazardDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = pickTab(sp.tab);

  const { supabase } = await requireUser();

  type HazardDetailRow = {
    id: string;
    ref_code: string | null;
    title: string;
    description: string | null;
    area: string | null;
    hazard_category: string;
    hazard_source: string;
    status: string;
    identified_at: string;
    identified_by: string | null;
    identification_method: string | null;
    source_incident_id: string | null;
    source_candidate_id: string | null;
    source_sds_id: string | null;
    closed_at: string | null;
    closed_reason: string | null;
    site: { id: string; name: string } | null;
    current_assessment: {
      id: string;
      likelihood: string;
      consequence: string;
      inherent_risk_score: RiskLevel;
      residual_risk_score: RiskLevel;
      assessed_at: string;
      next_review_at: string | null;
    } | null;
    identifier: { full_name: string | null; email: string | null } | null;
  };
  const { data: hazard, error } = await supabase
    .from("hazards")
    .select(
      "id, ref_code, title, description, area, hazard_category, hazard_source, status, " +
        "identified_at, identified_by, identification_method, " +
        "source_incident_id, source_candidate_id, source_sds_id, " +
        "closed_at, closed_reason, " +
        "site:site_id(id, name), " +
        "current_assessment:current_risk_assessment_id(id, likelihood, consequence, inherent_risk_score, residual_risk_score, assessed_at, next_review_at), " +
        "identifier:identified_by(full_name, email)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single<HazardDetailRow>();

  if (error || !hazard) notFound();

  const site = hazard.site;
  const currentAssessment = hazard.current_assessment;
  const identifier = hazard.identifier;

  const canManage = site ? await can("hazard:manage", site.id) : false;
  const basePath = `/hazards/${id}`;

  return (
    <div className="space-y-6">
      <Link
        href="/hazards"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to hazards
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-sm text-muted-foreground">
            {hazard.ref_code ?? id.slice(0, 8)}
          </span>
          <h1 className="text-2xl font-semibold">{hazard.title}</h1>
          <HazardStatusBadge status={hazard.status as string} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <CategoryBadge category={hazard.hazard_category as string} />
          {site && <span>· {site.name}</span>}
          {hazard.area && <span>· {hazard.area as string}</span>}
          {currentAssessment?.residual_risk_score && (
            <>
              <span>·</span>
              <span>Residual</span>
              <RiskBadge score={currentAssessment.residual_risk_score} />
            </>
          )}
        </div>
      </header>

      <HazardDetailTabs current={tab} basePath={basePath} />

      {tab === "overview" && (
        <OverviewTab
          hazard={hazard}
          site={site}
          currentAssessment={currentAssessment}
          identifierName={identifier?.full_name ?? identifier?.email ?? null}
        />
      )}

      {tab === "assessments" && (
        <AssessmentsTab hazardId={id} canManage={canManage} />
      )}

      {tab === "controls" && (
        <ControlsTab hazardId={id} canManage={canManage} />
      )}

      {tab === "incidents" && (
        <LinkedIncidentsTab hazardId={id} />
      )}
    </div>
  );
}

function OverviewTab({
  hazard,
  site,
  currentAssessment,
  identifierName,
}: {
  hazard: { description: string | null; identification_method: string | null; identified_at: string; hazard_source: string };
  site: { id: string; name: string } | null;
  currentAssessment: {
    id?: string;
    inherent_risk_score?: RiskLevel | null;
    residual_risk_score?: RiskLevel | null;
    assessed_at?: string;
    next_review_at?: string | null;
  } | null;
  identifierName: string | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-lg border bg-card p-4 lg:col-span-2">
        <h2 className="text-sm font-semibold">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {hazard.description ?? "No description provided."}
        </p>
      </section>
      <aside className="space-y-2 rounded-lg border bg-card p-4 text-sm">
        <h2 className="text-sm font-semibold">Provenance</h2>
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between"><dt className="text-muted-foreground">Site</dt><dd>{site?.name ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Source</dt><dd>{hazard.hazard_source.replace(/_/g, " ")}</dd></div>
          {hazard.identification_method && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Method</dt><dd>{hazard.identification_method}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-muted-foreground">Identified by</dt><dd>{identifierName ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Identified</dt><dd>{new Date(hazard.identified_at).toLocaleString()}</dd></div>
        </dl>
        {currentAssessment?.id && (
          <>
            <div className="my-2 border-t border-border" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current assessment</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Inherent</span>
              <RiskBadge score={currentAssessment.inherent_risk_score ?? null} />
              <span className="text-muted-foreground">→</span>
              <span className="text-muted-foreground">Residual</span>
              <RiskBadge score={currentAssessment.residual_risk_score ?? null} />
            </div>
            <p className="text-xs text-muted-foreground">
              {currentAssessment.assessed_at && `Assessed ${new Date(currentAssessment.assessed_at).toLocaleDateString()}`}
              {currentAssessment.next_review_at && ` · review by ${new Date(currentAssessment.next_review_at).toLocaleDateString()}`}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

type AssessmentRow = {
  id: string;
  likelihood: string;
  consequence: string;
  inherent_risk_score: RiskLevel;
  residual_risk_score: RiskLevel;
  trigger_type: string;
  rationale: string | null;
  assessed_at: string;
  superseded_at: string | null;
  next_review_at: string | null;
  assessor: { full_name: string | null; email: string | null } | null;
};

async function AssessmentsTab({ hazardId, canManage }: { hazardId: string; canManage: boolean }) {
  const { supabase } = await requireUser();
  const { data: ras } = await supabase
    .from("hazard_risk_assessments")
    .select(
      "id, likelihood, consequence, inherent_risk_score, residual_risk_score, trigger_type, " +
        "rationale, assessed_at, superseded_at, next_review_at, assessor:assessor_id(full_name, email)",
    )
    .eq("hazard_id", hazardId)
    .is("deleted_at", null)
    .order("assessed_at", { ascending: false })
    .limit(50)
    .returns<AssessmentRow[]>();

  return (
    <div className="space-y-6">
      {canManage && <RiskAssessmentForm hazardId={hazardId} />}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Assessment history</h3>
        {(ras ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No assessments yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {(ras ?? []).map((r) => {
              const isCurrent = !r.superseded_at;
              return (
                <li key={r.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {r.trigger_type.replace(/_/g, " ")}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Current</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <RiskBadge score={r.inherent_risk_score} />
                      <span className="text-muted-foreground">→</span>
                      <RiskBadge score={r.residual_risk_score} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.likelihood.replace(/_/g, " ")} × {r.consequence.replace(/_/g, " ")}
                    {r.assessor && ` · by ${r.assessor.full_name ?? r.assessor.email}`}
                    {r.assessed_at && ` · ${new Date(r.assessed_at).toLocaleString()}`}
                  </p>
                  {r.rationale && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{r.rationale}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

async function ControlsTab({ hazardId, canManage }: { hazardId: string; canManage: boolean }) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("hazard_controls")
    .select(
      "id, control_level, control_description, effectiveness, last_verified_at, next_verification_at, next_control_review_at, origin",
    )
    .eq("hazard_id", hazardId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const controls: ControlRow[] = (data ?? []).map((c) => ({
    id: c.id as string,
    control_level: c.control_level as ControlLevel,
    control_description: c.control_description as string,
    effectiveness: c.effectiveness as ControlRow["effectiveness"],
    last_verified_at: (c.last_verified_at as string | null) ?? null,
    next_verification_at: (c.next_verification_at as string | null) ?? null,
    next_control_review_at: (c.next_control_review_at as string | null) ?? null,
    origin: c.origin as string,
  }));

  return <ControlsSection hazardId={hazardId} controls={controls} canManage={canManage} />;
}

type IncidentLinkRow = {
  id: string;
  link_type: string;
  was_in_register_at_time: boolean;
  triggered_reassessment: boolean;
  identified_at: string;
  incident: { id: string; ref_code: string | null; title: string; severity: string | null; occurred_at: string } | null;
};

async function LinkedIncidentsTab({ hazardId }: { hazardId: string }) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("incident_hazard_links")
    .select(
      "id, link_type, was_in_register_at_time, triggered_reassessment, identified_at, " +
        "incident:incident_id(id, ref_code, title, severity, occurred_at)",
    )
    .eq("hazard_id", hazardId)
    .order("identified_at", { ascending: false })
    .returns<IncidentLinkRow[]>();

  const links = data ?? [];
  if (links.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
        <h3 className="text-sm font-semibold">No incidents linked yet</h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          When an investigation team identifies this hazard as a contributing factor, the link appears here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((l) => {
        const inc = l.incident;
        return (
          <li key={l.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {inc ? (
                <Link href={`/investigations/${inc.id}`} className="font-medium hover:underline">
                  {inc.ref_code ?? inc.id.slice(0, 8)} · {inc.title}
                </Link>
              ) : (
                <span className="text-muted-foreground">Linked incident (no access)</span>
              )}
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-medium " +
                  (l.link_type === "causal"
                    ? "bg-destructive/15 text-destructive"
                    : l.link_type === "contributing"
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground")
                }
              >
                {l.link_type.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {inc?.occurred_at && `Occurred ${new Date(inc.occurred_at).toLocaleDateString()}`}
              {l.was_in_register_at_time ? " · was in register at time" : " · added to register after incident"}
              {l.triggered_reassessment ? " · triggered reassessment" : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
