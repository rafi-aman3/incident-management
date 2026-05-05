import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { Step1WhatHappened } from "@/components/incidents/wizard/step-1-what-happened";
import { Step2Details } from "@/components/incidents/wizard/step-2-details";
import { Step3Review } from "@/components/incidents/wizard/step-3-review";
import { WizardProgress } from "@/components/incidents/wizard/wizard-progress";
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
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Report incident</p>
        <h1 className="text-2xl font-semibold">Report a safety event</h1>
      </div>
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

function MissingId() {
  return (
    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      Missing draft id — start over from{" "}
      <a className="underline" href="/incidents/new/1">Step 1</a>.
    </div>
  );
}

async function Step2Server({ incidentId }: { incidentId: string }) {
  const { supabase, user } = await requireUser();

  const { data: incident } = await supabase
    .from("incidents")
    .select(
      "id, type, status, is_sandbox, reporter_id, ppe_worn, substance, quantity_value, quantity_unit, equipment, dangerous_occurrence_kind, sites:site_id(country)"
    )
    .eq("id", incidentId)
    .single();
  if (!incident) notFound();
  if (incident.reporter_id !== user.id) notFound();
  if (incident.status !== "draft") redirect(`/incidents/${incidentId}`);

  const [{ data: injured }, { data: witnesses }] = await Promise.all([
    supabase
      .from("injured_persons")
      .select("name, body_parts, treatment, fatality, hospitalized, riddor_specified_injury")
      .eq("incident_id", incidentId),
    supabase.from("witnesses").select("name, contact, statement").eq("incident_id", incidentId),
  ]);

  return (
    <Step2Details
      incidentId={incidentId}
      type={incident.type as IncidentType}
      isSandbox={incident.is_sandbox}
      isUKSite={incident.sites?.country === "GB"}
      initial={{
        ppe_worn: incident.ppe_worn ?? [],
        substance: incident.substance,
        quantity_value: incident.quantity_value,
        quantity_unit: incident.quantity_unit,
        equipment: incident.equipment,
        dangerous_occurrence_kind: incident.dangerous_occurrence_kind,
        injured_persons: injured ?? [],
        witnesses: witnesses ?? [],
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
      "id, type, title, occurred_at, area, location, description, is_sandbox, reporter_id, status"
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
    <Step3Review
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
