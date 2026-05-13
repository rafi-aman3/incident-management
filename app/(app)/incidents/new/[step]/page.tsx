import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { Step1WhatHappened } from "@/components/incidents/wizard/step-1-what-happened";
import { Step2Details } from "@/components/incidents/wizard/step-2-details";
import { Step3Review } from "@/components/incidents/wizard/step-3-review";
import { WizardProgress } from "@/components/incidents/wizard/wizard-progress";
import { ArgusFormAssistant } from "@/components/argus/argus-form-assistant";
import { ensureBlankDraft } from "./actions";
import type { IncidentType } from "@/lib/incidents/types";
import type { Treatment } from "@/lib/workflow/routing";
import type { MatrixCoord } from "@/lib/workflow/severity";

type Params = Promise<{ step: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportWizardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { step } = await params;
  const sp = await searchParams;

  const stepNum = Number.parseInt(step, 10);
  if (![1, 2, 3].includes(stepNum)) notFound();

  let incidentId = typeof sp.id === "string" ? sp.id : null;
  const initialSandbox = sp.sandbox === "true";

  // Phase 9b: Step 1 always has an incident row (created on first load) so
  // the Argus Form Assistant can target an incidentId. Steps 2 + 3 require
  // the user to come from Step 1's submit (which redirected with ?id=).
  if (stepNum === 1 && !incidentId) {
    const draftId = await ensureBlankDraft();
    redirect(`/incidents/new/1?id=${draftId}${initialSandbox ? "&sandbox=true" : ""}`);
  }

  return (
    <div className="relative isolate space-y-4">
      {/* Aurora gradient backdrop — destructive/amber blobs, decorative.
          Sets a quiet "important task" tone without panic. */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[420px] overflow-hidden" aria-hidden>
        <div
          className="aurora-blob -left-20 top-0 h-[360px] w-[480px] rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--destructive), transparent 70%)", opacity: 0.32 }}
        />
        <div
          className="aurora-blob right-[-8%] top-16 h-[320px] w-[420px] rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--warning), transparent 70%)", animationDelay: "-7s", opacity: 0.28 }}
        />
        <div
          className="aurora-blob left-1/3 top-32 h-[260px] w-[360px] rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--brand), transparent 70%)", animationDelay: "-13s", opacity: 0.22 }}
        />
      </div>

      <div
        className="dashboard-enter relative overflow-hidden rounded-xl border border-destructive/25 bg-gradient-to-br from-destructive/10 via-card to-card p-5 shadow-sm ring-1 ring-foreground/5"
        style={{ ["--d" as string]: "0ms" }}
      >
        <span className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-destructive/15 blur-3xl" aria-hidden />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-destructive via-warning to-destructive/40" aria-hidden />
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link href="/incidents" className="hover:underline">
            Incidents
          </Link>{" "}
          <span aria-hidden>›</span> New
        </p>
        <div className="mt-1 flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-destructive/20 to-destructive/5 text-destructive ring-1 ring-destructive/30"
            aria-hidden
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="bg-gradient-to-r from-destructive via-foreground to-foreground bg-clip-text text-2xl font-semibold leading-tight text-transparent">
              Report Incident
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete all three steps to create a full investigation package.
            </p>
          </div>
        </div>
      </div>
      {/* Argus Form Assistant — inline collapsible strip above the step tabs.
          Mounts on every step (Step 1 has a pre-created blank draft; 2+3
          have the draft from Step 1 submit). Per the assets/ mock, this
          lives BETWEEN the page header and the step progress. */}
      {incidentId && (
        <div className="dashboard-enter" style={{ ["--d" as string]: "60ms" }}>
          <FormAssistantMount incidentId={incidentId} />
        </div>
      )}

      <div className="dashboard-enter" style={{ ["--d" as string]: "120ms" }}>
        <WizardProgress current={stepNum as 1 | 2 | 3} />
      </div>

      <div className="dashboard-enter" style={{ ["--d" as string]: "180ms" }}>
        {stepNum === 1 &&
          (incidentId ? <Step1Server incidentId={incidentId} initialSandbox={initialSandbox} /> : <MissingId />)}
        {stepNum === 2 && (incidentId ? <Step2Server incidentId={incidentId} /> : <MissingId />)}
        {stepNum === 3 &&
          (incidentId ? (
            <Step3Server
              incidentId={incidentId}
              likelihood={Number(sp.l) as MatrixCoord}
              consequence={Number(sp.c) as MatrixCoord}
            />
          ) : (
            <MissingId />
          ))}
      </div>
    </div>
  );
}

async function Step1Server({
  incidentId,
  initialSandbox,
}: {
  incidentId: string;
  initialSandbox: boolean;
}) {
  const { supabase, user } = await requireUser();

  const { data: incident } = await supabase
    .from("incidents")
    .select("id, type, title, description, occurred_at, area, location, is_sandbox, reporter_id, status, updated_at")
    .eq("id", incidentId)
    .single();

  if (!incident) notFound();
  if (incident.reporter_id !== user.id) notFound();
  if (incident.status !== "draft") redirect(`/incidents/${incidentId}`);

  return (
    // key={updated_at} forces a remount when Argus auto-fill writes back —
    // Step1WhatHappened uses useState seeded from `initial`, which would
    // otherwise ignore prop changes after the first mount.
    <Step1WhatHappened
      key={incident.updated_at ?? incident.id}
      incidentId={incidentId}
      initialSandbox={initialSandbox}
      initial={{
        type: (incident.type as IncidentType) ?? null,
        title: incident.title ?? "",
        description: incident.description ?? "",
        occurred_at: incident.occurred_at ?? null,
        area: incident.area ?? "",
        location: incident.location ?? "",
        is_sandbox: incident.is_sandbox,
      }}
    />
  );
}

async function FormAssistantMount({ incidentId }: { incidentId: string }) {
  const { profile, supabase } = await requireUser();

  if (profile.argus_copilot_disabled) return null;

  const [orgArgusFlag, userArgusPerm] = await Promise.all([
    supabase.from("orgs").select("argus_enabled").eq("id", profile.org_id).maybeSingle(),
    orgCan("argus:use"),
  ]);
  const argusEnabled = Boolean(orgArgusFlag.data?.argus_enabled) && userArgusPerm;
  if (!argusEnabled) return null;

  return <ArgusFormAssistant incidentId={incidentId} />;
}

function MissingId() {
  return (
    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      Missing draft id — start over from{" "}
      <a className="underline" href="/incidents/new/1">Step 1</a>.
    </div>
  );
}

async function Step2Server({ incidentId }: { incidentId: string }) {
  const { supabase, user, profile } = await requireUser();

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      `id, type, status, is_sandbox, reporter_id, site_id, updated_at, ppe_worn, substance,
       quantity_value, quantity_unit, equipment, dangerous_occurrence_kind,
       equipment_asset_id, title, description, area,
       sites:site_id(country),
       equipment_asset:equipment_asset_id(ref_code, name)`
    )
    .eq("id", incidentId)
    .single();
  if (!incident) notFound();
  if (incident.reporter_id !== user.id) notFound();
  if (incident.status !== "draft") redirect(`/incidents/${incidentId}`);

  // Resolve argus availability for the wand visibility gate. Same triple
  // (org flag + permission + non-disabled profile) used by the form-assistant.
  const orgArgusFlag = await supabase
    .from("orgs")
    .select("argus_enabled")
    .eq("id", profile.org_id)
    .maybeSingle();
  const argusEnabled =
    Boolean(orgArgusFlag.data?.argus_enabled) &&
    !profile.argus_copilot_disabled &&
    (await orgCan("argus:use"));

  const [{ data: injured }, { data: witnesses }, { data: attachments }] = await Promise.all([
    supabase
      .from("injured_persons")
      .select("name, body_parts, treatment, fatality, hospitalized, riddor_specified_injury")
      .eq("incident_id", incidentId),
    supabase.from("witnesses").select("name, contact, statement").eq("incident_id", incidentId),
    supabase
      .from("incident_attachments")
      .select("id, file_name, storage_path")
      .eq("incident_id", incidentId),
  ]);

  return (
    // key={updated_at} forces a remount when Argus auto-fill writes back —
    // Step2Details uses useState(initial), which would otherwise ignore prop
    // changes after the first mount.
    <Step2Details
      key={incident.updated_at ?? incident.id}
      incidentId={incidentId}
      orgId={profile.org_id}
      siteId={incident.site_id}
      type={incident.type as IncidentType}
      title={incident.title ?? ""}
      description={incident.description ?? ""}
      area={incident.area ?? null}
      argusEnabled={argusEnabled}
      isSandbox={incident.is_sandbox}
      isUKSite={incident.sites?.country === "GB"}
      initial={{
        ppe_worn: incident.ppe_worn ?? [],
        substance: incident.substance,
        quantity_value: incident.quantity_value,
        quantity_unit: incident.quantity_unit,
        equipment: incident.equipment,
        equipment_asset_id: incident.equipment_asset_id,
        equipment_asset_label: incident.equipment_asset
          ? `${incident.equipment_asset.ref_code} · ${incident.equipment_asset.name}`
          : null,
        dangerous_occurrence_kind: incident.dangerous_occurrence_kind,
        injured_persons: injured ?? [],
        witnesses: witnesses ?? [],
        attachments: attachments ?? [],
      }}
    />
  );
}

async function Step3Server({
  incidentId,
  likelihood,
  consequence,
}: {
  incidentId: string;
  likelihood: MatrixCoord;
  consequence: MatrixCoord;
}) {
  const { supabase, user } = await requireUser();

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      "id, type, title, occurred_at, area, location, description, is_sandbox, reporter_id, status, updated_at"
    )
    .eq("id", incidentId)
    .single();
  if (!incident) notFound();
  if (incident.reporter_id !== user.id) notFound();
  if (incident.status !== "draft") redirect(`/incidents/${incidentId}`);

  const { data: injured } = await supabase
    .from("injured_persons")
    .select("treatment, fatality, hospitalized")
    .eq("incident_id", incidentId);
  const { count: witnessCount } = await supabase
    .from("witnesses")
    .select("*", { count: "exact", head: true })
    .eq("incident_id", incidentId);

  // Aggregate injury signals for the live track preview
  const treatmentRank: Record<Treatment, number> = {
    none: 0,
    first_aid: 1,
    medical: 2,
    hospitalization: 3,
  };
  let worstTreatment: Treatment | null = null;
  let anyFatality = false;
  let anyHospitalization = false;
  for (const row of injured ?? []) {
    const t = (row.treatment ?? null) as Treatment | null;
    if (t && (worstTreatment === null || treatmentRank[t] > treatmentRank[worstTreatment])) {
      worstTreatment = t;
    }
    if (row.fatality) anyFatality = true;
    if (row.hospitalized) anyHospitalization = true;
  }

  return (
    // key={updated_at} forces a remount when Argus auto-fill writes back —
    // Step3Review uses useState(initial) for its editable fields.
    <Step3Review
      key={incident.updated_at ?? incident.id}
      incidentId={incidentId}
      type={incident.type as IncidentType}
      title={incident.title}
      occurredAt={incident.occurred_at}
      area={incident.area}
      location={incident.location}
      description={incident.description}
      isSandbox={incident.is_sandbox}
      likelihood={likelihood}
      consequence={consequence}
      worstTreatment={worstTreatment}
      anyFatality={anyFatality}
      anyHospitalization={anyHospitalization}
      injuredCount={injured?.length ?? 0}
      witnessCount={witnessCount ?? 0}
    />
  );
}
