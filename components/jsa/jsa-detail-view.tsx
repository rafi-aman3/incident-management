import Link from "next/link";
import { Activity, FileText, ShieldCheck, History } from "lucide-react";
import { JsaStatusBadge } from "./jsa-status-badge";
import { JsaPromoteButton } from "./jsa-promote-button";
import { CONTROL_LEVEL_LABELS, RISK_LEVEL_LABELS } from "@/lib/risk/matrix";
import type { JsaStatus } from "@/lib/actions/jsa-schemas";
import type { RiskLevel, ControlLevel, HazardCategory } from "@/lib/risk/types";

export type JsaDetailData = {
  id: string;
  ref_code: string | null;
  title: string;
  job_description: string | null;
  area: string | null;
  site_name: string | null;
  performed_by_roles: string[];
  performed_by_workgroups: string[];
  frequency: string | null;
  estimated_duration_minutes: number | null;
  ppe_required: string[];
  permits_required: string[];
  status: JsaStatus;
  expires_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  created_by_name: string | null;
  created_at: string;
  steps: Array<{
    id: string;
    sequence: number;
    step_description: string;
    hazards: Array<{
      id: string;
      hazard_description: string;
      hazard_category: HazardCategory;
      inherent_risk_score: RiskLevel;
      residual_risk_score: RiskLevel;
      promoted_to_register: boolean;
      hazard_candidate_id: string | null;
      registered_hazard_id: string | null;
      controls: Array<{ control_level: ControlLevel; control_description: string }>;
    }>;
  }>;
  signoffs: Array<{
    id: string;
    worker_name: string | null;
    signed_at: string;
    signed_for_session: string | null;
  }>;
  linked_incidents: Array<{
    id: string;
    link_type: "causal" | "contributing" | "exposed_but_not_causal";
    incident_ref: string | null;
    incident_title: string;
    severity: RiskLevel | null;
    identified_at: string;
  }>;
};

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  as_needed: "As needed",
  one_off: "One-off",
  continuous: "Continuous",
};

const SEVERITY_COLOR: Record<RiskLevel, string> = {
  S1: "bg-sev-1 text-white",
  S2: "bg-sev-2 text-white",
  S3: "bg-sev-3 text-foreground",
  S4: "bg-sev-4 text-white",
  S5: "bg-sev-5 text-foreground",
};

const LINK_TYPE_LABEL: Record<string, string> = {
  causal: "Causal",
  contributing: "Contributing",
  exposed_but_not_causal: "Exposed (not causal)",
};

export function JsaDetailView({
  data,
  canPromote,
}: {
  data: JsaDetailData;
  canPromote: boolean;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {data.ref_code ?? data.id.slice(0, 8)}
          </p>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          {data.area || data.site_name ? (
            <p className="text-sm text-muted-foreground">
              {data.site_name ?? "—"}
              {data.area ? ` · ${data.area}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <JsaStatusBadge status={data.status} />
          {data.status === "approved" && data.expires_at && (
            <span className="rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground">
              Expires {data.expires_at}
            </span>
          )}
        </div>
      </header>

      {data.job_description && (
        <section className="rounded-lg border bg-card p-4 text-sm">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Job description
          </h2>
          <p className="whitespace-pre-wrap">{data.job_description}</p>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <MetaCard label="Frequency" value={data.frequency ? FREQ_LABEL[data.frequency] ?? data.frequency : null} />
        <MetaCard label="Estimated duration" value={data.estimated_duration_minutes ? `${data.estimated_duration_minutes} min` : null} />
        <MetaList label="Performed by (roles)" items={data.performed_by_roles} />
        <MetaList label="PPE required" items={data.ppe_required} />
        <MetaList label="Permits referenced" items={data.permits_required} hint="Metadata only — not a permit-issuance workflow" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> Steps, hazards & controls
        </h2>
        {data.steps.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No steps defined.
          </p>
        ) : (
          <ol className="space-y-3">
            {data.steps.map((s) => (
              <li key={s.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Step {s.sequence}</span>
                </div>
                <p className="mt-1 text-sm">{s.step_description}</p>
                {s.hazards.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {s.hazards.map((h) => (
                      <li key={h.id} className="rounded-md border bg-background p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{h.hazard_description}</p>
                            <p className="text-xs text-muted-foreground">{h.hazard_category}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`rounded px-2 py-0.5 font-semibold ${SEVERITY_COLOR[h.inherent_risk_score]}`}>
                              Inherent · {RISK_LEVEL_LABELS[h.inherent_risk_score]}
                            </span>
                            <span className={`rounded px-2 py-0.5 font-semibold ${SEVERITY_COLOR[h.residual_risk_score]}`}>
                              Residual · {RISK_LEVEL_LABELS[h.residual_risk_score]}
                            </span>
                          </div>
                        </div>
                        {h.controls.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs">
                            {h.controls.map((c, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="min-w-[110px] rounded bg-muted px-1.5 py-0.5 font-medium">
                                  {CONTROL_LEVEL_LABELS[c.control_level]}
                                </span>
                                <span>{c.control_description}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2">
                          {h.promoted_to_register ? (
                            <span className="text-xs text-muted-foreground">
                              Promoted to hazard register
                              {h.registered_hazard_id ? (
                                <Link
                                  href={`/hazards/${h.registered_hazard_id}`}
                                  className="ml-1 text-primary hover:underline"
                                >
                                  → view hazard
                                </Link>
                              ) : h.hazard_candidate_id ? (
                                <Link
                                  href={`/hazards/candidates/${h.hazard_candidate_id}`}
                                  className="ml-1 text-primary hover:underline"
                                >
                                  → view candidate
                                </Link>
                              ) : null}
                            </span>
                          ) : canPromote ? (
                            <JsaPromoteButton stepHazardId={h.id} />
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Sign-offs
        </h2>
        {data.signoffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-offs yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {data.signoffs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>{s.worker_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">
                  {s.signed_for_session ?? "no session"} · {new Date(s.signed_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" /> Linked incidents
        </h2>
        {data.linked_incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incidents linked to this JSA.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {data.linked_incidents.map((li) => (
              <li key={li.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <div>
                  <Link
                    href={`/incidents/${li.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {li.incident_ref ?? li.id.slice(0, 8)} — {li.incident_title}
                  </Link>
                </div>
                <span className="text-xs text-muted-foreground">
                  {LINK_TYPE_LABEL[li.link_type]} · {new Date(li.identified_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="text-xs text-muted-foreground">
        <Activity className="mr-1 inline h-3 w-3" />
        Created by {data.created_by_name ?? "—"} · {new Date(data.created_at).toLocaleDateString()}
        {data.approved_at ? (
          <>
            {" · Approved by "}
            {data.approved_by_name ?? "—"}{" "}
            {new Date(data.approved_at).toLocaleDateString()}
          </>
        ) : null}
      </section>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function MetaList({
  label,
  items,
  hint,
}: {
  label: string;
  items: string[];
  hint?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border bg-background px-2 py-0.5 text-xs"
          >
            {item}
          </span>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
