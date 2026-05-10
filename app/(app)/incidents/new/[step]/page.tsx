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

  const incidentId = typeof sp.id === "string" ? sp.id : null;
  const initialSandbox = sp.sandbox === "true";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-8">
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 ring-1 ring-foreground/5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link href="/incidents" className="hover:underline">
            Incidents
          </Link>{" "}
          <span aria-hidden>›</span> New
        </p>
        <div className="mt-1 flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            aria-hidden
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Report Incident</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete all three steps to create a full investigation package.
            </p>
          </div>
        </div>
      </div>
      {/* Argus Form Assistant — inline collapsible strip above the step tabs.
          Only mounts on Steps 2 + 3 (the draft incident must exist for
          update_incident_field tool calls to write back). Per the assets/
          mock, this lives BETWEEN the page header and the step progress. */}
      {incidentId && [2, 3].includes(stepNum) && (
        <FormAssistantMount incidentId={incidentId} />
      )}

      <WizardProgress current={stepNum as 1 | 2 | 3} />

      {stepNum === 1 && <Step1WhatHappened initialSandbox={initialSandbox} />}
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
       equipment_asset_id,
       sites:site_id(country),
       equipment_asset:equipment_asset_id(ref_code, name)`
    )
    .eq("id", incidentId)
    .single();
  if (!incident) notFound();
  if (incident.reporter_id !== user.id) notFound();
  if (incident.status !== "draft") redirect(`/incidents/${incidentId}`);

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
