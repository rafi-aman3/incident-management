import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { isValidStep, type SetupProgress } from "@/lib/site-setup/steps";
import { ProgressDots, StepList } from "@/components/site-setup/wizard-chrome";
import { Step1Basics } from "@/components/site-setup/step-1-basics";
import { Step2Regulator } from "@/components/site-setup/step-2-regulator";
import { Step3EstablishmentIds } from "@/components/site-setup/step-3-establishment-ids";
import { Step4Departments } from "@/components/site-setup/step-4-departments";
import { Step5Users, type SiteMember } from "@/components/site-setup/step-5-users";
import {
  Step6Recipients,
  type ProfileChoice,
  type RecipientsByKind,
  type RecipientRow,
} from "@/components/site-setup/step-6-recipients";
import { Step7Confirm } from "@/components/site-setup/step-7-confirm";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/site-setup/schemas";

type Params = Promise<{ step: string }>;

export default async function SiteSetupStepPage({ params }: { params: Params }) {
  const { step } = await params;
  const stepNum = Number.parseInt(step, 10);
  if (!isValidStep(stepNum)) notFound();

  const { supabase, currentSiteId, profile } = await requireUser();
  if (!currentSiteId) notFound();

  const { data: site } = await supabase
    .from("sites")
    .select(
      "id, name, address, country, timezone, osha_establishment_id, naics_code, setup_progress"
    )
    .eq("id", currentSiteId)
    .single();
  if (!site) notFound();

  const progress = (site.setup_progress ?? {}) as SetupProgress;
  const country = (site.country as "US" | "GB") ?? "US";

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Site setup</p>
        <h1 className="text-2xl font-semibold">{site.name}</h1>
        <p className="text-sm text-muted-foreground">
          Seven small steps. Save and resume any time — nothing locks until you click Launch.
        </p>
      </div>

      <ProgressDots currentStep={stepNum} progress={progress} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <StepList currentStep={stepNum} progress={progress} />

        <div className="min-w-0">
          {stepNum === 1 && (
            <Step1Basics
              initial={{
                name: site.name,
                address: site.address,
                country,
                timezone: site.timezone,
              }}
            />
          )}

          {stepNum === 2 && (
            <Step2Regulator
              country={country}
              initialRegulator={progress.regulator ?? (country === "US" ? "osha" : "hse")}
            />
          )}

          {stepNum === 3 && (
            <Step3EstablishmentIds
              initial={{
                country,
                osha_establishment_id: site.osha_establishment_id,
                naics_code: site.naics_code,
                hse_establishment_number: progress.hse_establishment_number ?? null,
              }}
            />
          )}

          {stepNum === 4 && <Step4Departments initial={progress.departments ?? []} />}

          {stepNum === 5 && <Step5UsersServer siteId={currentSiteId} />}

          {stepNum === 6 && <Step6RecipientsServer siteId={currentSiteId} orgId={profile.org_id} />}

          {stepNum === 7 && (
            <Step7ConfirmServer
              site={{
                id: site.id,
                name: site.name,
                country,
                timezone: site.timezone,
                address: site.address,
                osha_establishment_id: site.osha_establishment_id,
                naics_code: site.naics_code,
              }}
              progress={progress}
              orgId={profile.org_id}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-rendered shells that fetch step-specific data, then hand off to the
// client step components.
// ---------------------------------------------------------------------------

async function Step5UsersServer({ siteId }: { siteId: string }) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("site_members")
    .select(
      "profile_id, include_children, profile:profiles(full_name, email), role:roles(key, name)"
    )
    .eq("site_id", siteId);

  const members: SiteMember[] = (data ?? []).map((row) => ({
    profile_id: row.profile_id,
    full_name: row.profile?.full_name ?? null,
    email: row.profile?.email ?? "",
    role_key: row.role?.key ?? "worker",
    role_name: row.role?.name ?? "Worker",
    include_children: row.include_children,
  }));

  return <Step5Users members={members} />;
}

async function Step6RecipientsServer({ siteId, orgId }: { siteId: string; orgId: string }) {
  const { supabase } = await requireUser();
  const [{ data: profiles }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("org_id", orgId).order("full_name"),
    supabase
      .from("notification_recipients")
      .select("notification_kind, recipient_profile_id, external_email")
      .eq("site_id", siteId),
  ]);

  const choices: ProfileChoice[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
  }));

  const initial: RecipientsByKind = {};
  for (const kind of NOTIFICATION_KINDS) initial[kind] = [];
  for (const row of existing ?? []) {
    const k = row.notification_kind as NotificationKind;
    if (!initial[k]) initial[k] = [];
    const r: RecipientRow = {};
    if (row.recipient_profile_id) r.recipient_profile_id = row.recipient_profile_id;
    if (row.external_email) r.external_email = row.external_email;
    initial[k]!.push(r);
  }

  return <Step6Recipients profiles={choices} initial={initial} />;
}

async function Step7ConfirmServer({
  site,
  progress,
  orgId,
}: {
  site: {
    id: string;
    name: string;
    country: "US" | "GB";
    timezone: string;
    address: string | null;
    osha_establishment_id: string | null;
    naics_code: string | null;
  };
  progress: SetupProgress;
  orgId: string;
}) {
  const { supabase } = await requireUser();
  const [{ count: memberCount }, { data: recipientRows }] = await Promise.all([
    supabase.from("site_members").select("*", { count: "exact", head: true }).eq("site_id", site.id),
    supabase
      .from("notification_recipients")
      .select("notification_kind")
      .eq("site_id", site.id),
  ]);
  void orgId; // reserved for cross-org checks if needed later

  const configuredKinds = new Set<NotificationKind>(
    (recipientRows ?? []).map((r) => r.notification_kind as NotificationKind)
  );
  const departmentCount = (progress.departments ?? []).length;

  const warnings: string[] = [];
  if (site.country === "US" && !site.osha_establishment_id)
    warnings.push("OSHA Establishment ID is missing — required for valid 300A submission.");
  if (site.country === "US" && !site.naics_code)
    warnings.push("NAICS code is missing — required for valid 300A submission.");
  if (departmentCount === 0)
    warnings.push("No departments — workers won't have a location dropdown when reporting.");
  if ((memberCount ?? 0) === 0)
    warnings.push("No members on this site — the wizard will launch but nobody can use it yet.");
  if (!configuredKinds.has("osha_8hr") && site.country === "US")
    warnings.push("No recipient set for OSHA 8-hour fatality — clock will fire into the void.");
  if (!configuredKinds.has("riddor_immediate") && site.country === "GB")
    warnings.push("No recipient set for RIDDOR immediate — clock will fire into the void.");

  return (
    <Step7Confirm
      summary={{
        name: site.name,
        country: site.country,
        timezone: site.timezone,
        address: site.address,
        regulator: progress.regulator ?? null,
        osha_establishment_id: site.osha_establishment_id,
        naics_code: site.naics_code,
        hse_establishment_number: progress.hse_establishment_number ?? null,
        departmentCount,
        memberCount: memberCount ?? 0,
        recipientKindsConfigured: [...configuredKinds],
        warnings,
      }}
    />
  );
}
