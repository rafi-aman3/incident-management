import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { isValidSlug, type SetupProgress } from "@/lib/site-setup/steps";
import { ProgressDots, StepList } from "@/components/site-setup/wizard-chrome";
import { Step1Basics } from "@/components/site-setup/step-1-basics";
import { Step2Jurisdiction } from "@/components/site-setup/step-2-jurisdiction";
import { Step3Identifiers } from "@/components/site-setup/step-3-identifiers";
import { Step4Workforce } from "@/components/site-setup/step-4-workforce";
import { Step5Hazards } from "@/components/site-setup/step-5-hazards";
import { Step6Departments } from "@/components/site-setup/step-6-departments";
import {
  Step8Recipients,
  type ProfileChoice,
  type RecipientsByKind,
  type RecipientRow,
} from "@/components/site-setup/step-8-recipients";
import { Step7People } from "@/components/site-setup/step-7-people";
import { Step9Confirm } from "@/components/site-setup/step-9-confirm";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/site-setup/schemas";
import type { HazardTagCode } from "@/lib/site-setup/hazard-tags";
import type { ApplicableStandardCode } from "@/lib/site-setup/applicable-standards";

type Params = Promise<{ slug: string }>;

// All site columns the wizard reads. Defined as a single template literal so
// supabase-js's typed client can parse the SELECT (concatenated strings break
// the template-literal-type inference and return GenericStringError).
const SITE_FIELDS = `id, name, country, timezone, address,
  street_1, street_2, city, state_or_region, postal_code, latitude, longitude,
  site_type, operational_status, opened_on, closed_on,
  osha_jurisdiction, state_plan_code, gb_jurisdiction,
  ein, naics_code, sic_code, ita_establishment_id, osha_establishment_id,
  crn, uk_sic_2007, hse_establishment_number,
  peak_employees_year, avg_employees_year, partially_exempt_override,
  psm_applicable, applicable_standards, hazard_tags,
  site_ehs_lead_id, riddor_responsible_person_name, riddor_responsible_person_role,
  setup_progress`;

export default async function SiteSetupStepPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const { supabase, currentSiteId, profile } = await requireUser();
  if (!currentSiteId) notFound();

  const { data: rawSite } = await supabase
    .from("sites")
    .select(SITE_FIELDS)
    .eq("id", currentSiteId)
    .single();
  if (!rawSite) notFound();
  // SiteRow shape matches SITE_FIELDS; declared below for the per-step
  // server shells. Single cast here keeps the typed-client friction contained.
  const site = rawSite as unknown as SiteRow;

  const progress = (site.setup_progress ?? {}) as SetupProgress;
  const country = (site.country as "US" | "GB") ?? "US";

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Site setup</p>
        <h1 className="text-2xl font-semibold">{site.name}</h1>
        <p className="text-sm text-muted-foreground">
          Nine quick steps. Save and resume any time — nothing locks until you click Launch.
        </p>
      </div>

      <ProgressDots currentSlug={slug} progress={progress} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
        <StepList currentSlug={slug} progress={progress} />

        <div className="min-w-0">
          {slug === "basics" && (
            <Step1Basics
              initial={{
                name: site.name,
                street_1: site.street_1,
                street_2: site.street_2,
                city: site.city,
                state_or_region: site.state_or_region,
                postal_code: site.postal_code,
                latitude: site.latitude != null ? Number(site.latitude) : null,
                longitude: site.longitude != null ? Number(site.longitude) : null,
                country,
                timezone: site.timezone,
                site_type: (site.site_type ?? "fixed") as "fixed" | "mobile" | "office_only",
                operational_status: (site.operational_status ?? "active") as
                  | "active"
                  | "inactive"
                  | "closed",
                opened_on: site.opened_on,
                closed_on: site.closed_on,
              }}
            />
          )}

          {slug === "jurisdiction" && (
            <Step2Jurisdiction
              initial={{
                country,
                osha_jurisdiction: site.osha_jurisdiction as
                  | "federal"
                  | "state_plan"
                  | null,
                state_plan_code: site.state_plan_code,
                gb_jurisdiction: site.gb_jurisdiction as
                  | "hse"
                  | "local_authority"
                  | null,
              }}
            />
          )}

          {slug === "identifiers" && (
            <Step3Identifiers
              initial={{
                country,
                ein: site.ein,
                naics_code: site.naics_code,
                sic_code: site.sic_code,
                ita_establishment_id: site.ita_establishment_id,
                osha_establishment_id: site.osha_establishment_id,
                crn: site.crn,
                uk_sic_2007: site.uk_sic_2007,
                hse_establishment_number: site.hse_establishment_number,
              }}
            />
          )}

          {slug === "workforce" && <WorkforceServer site={site} />}

          {slug === "hazards" && (
            <Step5Hazards
              initial={{
                country,
                applicable_standards: (site.applicable_standards ?? []) as ApplicableStandardCode[],
                psm_applicable: Boolean(site.psm_applicable),
                hazard_tags: (site.hazard_tags ?? []) as HazardTagCode[],
              }}
            />
          )}

          {slug === "departments" && (
            <Step6Departments initial={progress.departments ?? []} />
          )}

          {slug === "people" && <PeopleServer site={site} country={country} />}

          {slug === "recipients" && (
            <RecipientsServer siteId={currentSiteId} orgId={profile.org_id} />
          )}

          {slug === "confirm" && (
            <ConfirmServer site={site} country={country} progress={progress} />
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

type SiteRow = {
  id: string;
  name: string;
  country: string | null;
  timezone: string;
  address: string | null;
  street_1: string | null;
  street_2: string | null;
  city: string | null;
  state_or_region: string | null;
  postal_code: string | null;
  // numeric(9,6) comes back as string from supabase-js to preserve precision.
  latitude: string | number | null;
  longitude: string | number | null;
  site_type: "fixed" | "mobile" | "office_only" | null;
  operational_status: "active" | "inactive" | "closed" | null;
  opened_on: string | null;
  closed_on: string | null;
  osha_jurisdiction: string | null;
  state_plan_code: string | null;
  gb_jurisdiction: string | null;
  ein: string | null;
  naics_code: string | null;
  sic_code: string | null;
  ita_establishment_id: string | null;
  osha_establishment_id: string | null;
  crn: string | null;
  uk_sic_2007: string | null;
  hse_establishment_number: string | null;
  peak_employees_year: number | null;
  avg_employees_year: number | null;
  partially_exempt_override: boolean | null;
  psm_applicable: boolean | null;
  applicable_standards: string[] | null;
  hazard_tags: string[] | null;
  site_ehs_lead_id: string | null;
  riddor_responsible_person_name: string | null;
  riddor_responsible_person_role: string | null;
  setup_progress: unknown;
};

async function WorkforceServer({ site }: { site: SiteRow }) {
  const { supabase } = await requireUser();
  const currentYear = new Date().getFullYear();

  const [{ data: hoursRow }, { data: ita }, { data: pe }] = await Promise.all([
    supabase
      .from("site_annual_hours")
      .select("hours_worked")
      .eq("site_id", site.id)
      .eq("year", currentYear)
      .maybeSingle(),
    // Cast to satisfy supabase-js's non-null param typing — the SQL functions
    // explicitly handle NULL inputs (return false).
    supabase.rpc("is_ita_required", {
      p_naics: site.naics_code as string,
      p_peak_employees: site.peak_employees_year as number,
    }),
    supabase.rpc("is_partially_exempt", {
      p_naics: site.naics_code as string,
      p_peak_employees: site.peak_employees_year as number,
    }),
  ]);

  return (
    <Step4Workforce
      initial={{
        peak_employees_year: site.peak_employees_year,
        avg_employees_year: site.avg_employees_year,
        partially_exempt_override: Boolean(site.partially_exempt_override),
        computed_partially_exempt: Boolean(pe),
        computed_ita_required: Boolean(ita),
        current_year: currentYear,
        current_year_hours:
          hoursRow && "hours_worked" in hoursRow ? Number(hoursRow.hours_worked) : null,
      }}
    />
  );
}

async function PeopleServer({
  site,
  country,
}: {
  site: SiteRow;
  country: "US" | "GB";
}) {
  const { supabase } = await requireUser();
  const [{ data: members }, { data: contacts }] = await Promise.all([
    supabase
      .from("site_members")
      .select("profile_id, profile:profiles(id, full_name, email)")
      .eq("site_id", site.id),
    supabase
      .from("site_emergency_contacts")
      .select("name, role, phone, email, sort_order")
      .eq("site_id", site.id)
      .order("sort_order", { ascending: true }),
  ]);

  type MemberRow = { profile?: { id: string; full_name: string | null; email: string } | null };
  const memberChoices = (members ?? [])
    .map((m) => (m as MemberRow).profile)
    .filter(
      (p): p is { id: string; full_name: string | null; email: string } => p !== undefined && p !== null
    );

  return (
    <Step7People
      initial={{
        country,
        site_ehs_lead_id: site.site_ehs_lead_id,
        riddor_responsible_person_name: site.riddor_responsible_person_name,
        riddor_responsible_person_role: site.riddor_responsible_person_role,
        emergency_contacts: (contacts ?? []).map((c) => ({
          name: c.name,
          role: c.role ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
        })),
        members: memberChoices,
      }}
    />
  );
}

async function RecipientsServer({ siteId, orgId }: { siteId: string; orgId: string }) {
  const { supabase } = await requireUser();
  const [{ data: profiles }, { data: existing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("org_id", orgId)
      .order("full_name"),
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

  return <Step8Recipients profiles={choices} initial={initial} />;
}

async function ConfirmServer({
  site,
  country,
  progress,
}: {
  site: SiteRow;
  country: "US" | "GB";
  progress: SetupProgress;
}) {
  const { supabase } = await requireUser();
  const [
    { count: memberCount },
    { data: recipientRows },
    { count: contactCount },
    { data: ita },
    { data: pe },
  ] = await Promise.all([
    supabase
      .from("site_members")
      .select("*", { count: "exact", head: true })
      .eq("site_id", site.id),
    supabase
      .from("notification_recipients")
      .select("notification_kind")
      .eq("site_id", site.id),
    supabase
      .from("site_emergency_contacts")
      .select("*", { count: "exact", head: true })
      .eq("site_id", site.id),
    // Cast to satisfy supabase-js's non-null param typing — the SQL functions
    // explicitly handle NULL inputs (return false).
    supabase.rpc("is_ita_required", {
      p_naics: site.naics_code as string,
      p_peak_employees: site.peak_employees_year as number,
    }),
    supabase.rpc("is_partially_exempt", {
      p_naics: site.naics_code as string,
      p_peak_employees: site.peak_employees_year as number,
    }),
  ]);

  const configuredKinds = new Set<NotificationKind>(
    (recipientRows ?? []).map((r) => r.notification_kind as NotificationKind)
  );
  const departmentCount = (progress.departments ?? []).length;

  const warnings: string[] = [];
  if (!site.street_1)
    warnings.push("Street address is missing — required on Form 300A and RIDDOR F2508.");
  if (country === "US" && !site.ein)
    warnings.push("EIN is missing — required for OSHA ITA submission.");
  if (country === "US" && !site.naics_code)
    warnings.push("NAICS code is missing — required for valid 300A submission.");
  if (country === "GB" && !site.uk_sic_2007)
    warnings.push("UK SIC 2007 is missing — used for HSE attribution.");
  if (country === "GB" && !site.riddor_responsible_person_name)
    warnings.push(
      "RIDDOR requires a named responsible person — F2508 cannot be submitted without one."
    );
  if (site.peak_employees_year === null)
    warnings.push("Peak employees this year is missing — required on Form 300A.");
  if (departmentCount === 0)
    warnings.push("No departments — workers won't have a location dropdown when reporting.");
  if ((memberCount ?? 0) === 0)
    warnings.push("No members on this site — the wizard will launch but nobody can use it yet.");
  if (!site.site_ehs_lead_id)
    warnings.push("Site EHS lead is not set — incidents won't have a default escalation target.");
  if ((contactCount ?? 0) === 0)
    warnings.push("No emergency contacts — add at least one for incident response.");
  if (!configuredKinds.has("osha_8hr") && country === "US")
    warnings.push("No recipient set for OSHA 8-hour fatality — clock will fire into the void.");
  if (!configuredKinds.has("riddor_immediate") && country === "GB")
    warnings.push("No recipient set for RIDDOR immediate — clock will fire into the void.");

  return (
    <Step9Confirm
      summary={{
        name: site.name,
        country,
        timezone: site.timezone,
        street_1: site.street_1,
        city: site.city,
        postal_code: site.postal_code,
        has_lat_long: site.latitude !== null && site.longitude !== null,
        osha_jurisdiction: site.osha_jurisdiction as "federal" | "state_plan" | null,
        state_plan_code: site.state_plan_code,
        gb_jurisdiction: site.gb_jurisdiction as "hse" | "local_authority" | null,
        ein: site.ein,
        naics_code: site.naics_code,
        crn: site.crn,
        uk_sic_2007: site.uk_sic_2007,
        peak_employees_year: site.peak_employees_year,
        avg_employees_year: site.avg_employees_year,
        partially_exempt: Boolean(pe),
        ita_required: Boolean(ita),
        applicable_standards_count: (site.applicable_standards ?? []).length,
        hazard_tags_count: (site.hazard_tags ?? []).length,
        psm_applicable: Boolean(site.psm_applicable),
        departmentCount,
        has_ehs_lead: Boolean(site.site_ehs_lead_id),
        has_riddor_responsible_person: Boolean(site.riddor_responsible_person_name),
        emergency_contact_count: contactCount ?? 0,
        memberCount: memberCount ?? 0,
        recipientKindsConfigured: [...configuredKinds],
        warnings,
      }}
    />
  );
}
