import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  InvestigationStatusBadge,
  DueDateChip,
} from "@/components/investigations/badges";
import { DetailTabs, type DetailTabKey, DETAIL_TABS } from "@/components/investigations/detail/detail-tabs";
import {
  IncidentSummaryCard,
  type IncidentSummaryData,
} from "@/components/investigations/detail/incident-summary-card";
import {
  TeamPanel,
  type InvestigationTeamMember,
} from "@/components/investigations/detail/team-panel";
import {
  WitnessStatementsSection,
  type WitnessStatement,
} from "@/components/investigations/detail/witness-statements-section";
import { Osha301Banner } from "@/components/investigations/detail/osha-301-banner";
import {
  DetailModals,
  type SiteMemberOption,
} from "@/components/investigations/detail/detail-modals";
import type { InvestigationStatus } from "@/lib/investigations/types";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VALID_TABS: ReadonlyArray<DetailTabKey> = DETAIL_TABS.map((t) => t.key);

export default async function InvestigationDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, currentSiteId } = await requireUser();

  const tab: DetailTabKey =
    typeof sp.tab === "string" && (VALID_TABS as readonly string[]).includes(sp.tab)
      ? (sp.tab as DetailTabKey)
      : "summary";

  // 1. Investigation + lead + incident snapshot + injured persons
  const { data: inv, error: invErr } = await supabase
    .from("investigations")
    .select(
      `id, ref_code, status, due_date, started_at, closed_at, lead_investigator_id, site_id,
       findings, root_cause_summary,
       lead:lead_investigator_id ( id, full_name, email ),
       incident:incident_id (
         id, ref_code, type, title, description, occurred_at, area, location,
         severity, track, classified_at, osha_recordable, is_sandbox,
         reporter:reporter_id ( full_name, email ),
         injured_persons ( name, treatment )
       )`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (invErr || !inv || !inv.incident) notFound();

  const incident = inv.incident;
  const status = inv.status as InvestigationStatus;
  const isClosed = status === "closed";

  // 2. Permissions
  const [canEdit, canReassignLead] = currentSiteId
    ? await Promise.all([
        can("investigation:edit", currentSiteId),
        can("investigation:lead", currentSiteId),
      ])
    : [false, false];

  // 3. Team (joined to profiles)
  const { data: teamRaw } = await supabase
    .from("investigation_team_members")
    .select("profile_id, role, profile:profiles ( full_name, email )")
    .eq("investigation_id", inv.id);
  const team: InvestigationTeamMember[] = (teamRaw ?? [])
    .filter((m) => m.profile)
    .map((m) => ({
      profile_id: m.profile_id,
      role: m.role as InvestigationTeamMember["role"],
      full_name: m.profile!.full_name,
      email: m.profile!.email,
    }));

  // 4. Witness statements (incident-scoped — carry over from /incidents)
  const { data: witnessesRaw } = await supabase
    .from("witnesses")
    .select("id, name, contact, statement")
    .eq("incident_id", incident.id);
  const statements: WitnessStatement[] = witnessesRaw ?? [];

  // 5. Site members for modal pickers
  const { data: siteMembersRaw } = await supabase
    .from("site_members")
    .select("profile:profiles ( id, full_name, email )")
    .eq("site_id", inv.site_id);
  const members: SiteMemberOption[] = (siteMembersRaw ?? [])
    .filter((m) => m.profile)
    .map((m) => ({
      id: m.profile!.id,
      full_name: m.profile!.full_name,
      email: m.profile!.email,
    }));

  const removableProfileId = typeof sp.profile === "string" ? sp.profile : null;
  const removableMember =
    removableProfileId && sp.action === "remove-team"
      ? (members.find((m) => m.id === removableProfileId) ?? null)
      : null;

  const summaryData: IncidentSummaryData = {
    id: incident.id,
    ref_code: incident.ref_code,
    type: incident.type,
    title: incident.title,
    description: incident.description,
    occurred_at: incident.occurred_at,
    area: incident.area,
    location: incident.location,
    severity: incident.severity as IncidentSummaryData["severity"],
    track: incident.track as IncidentSummaryData["track"],
    classified_at: incident.classified_at,
    reporter: incident.reporter ?? null,
    injured: (incident.injured_persons ?? []).map((p) => ({
      name: p.name,
      treatment: p.treatment,
    })),
  };

  const basePath = `/investigations/${inv.id}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/investigations"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Investigations
          </Link>
          <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {inv.ref_code ?? "—"}
          </div>
          <h1 className="text-2xl font-semibold">{incident.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <InvestigationStatusBadge status={status} />
            {!isClosed && <DueDateChip dueDate={inv.due_date} />}
            {incident.is_sandbox && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                practice
              </span>
            )}
          </div>
        </div>

        {!isClosed && canEdit && (
          <Link
            href={`${basePath}?action=close-no-capa`}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <CheckCircle2 className="h-4 w-4" /> Close — no CAPA
          </Link>
        )}
      </div>

      {incident.osha_recordable && !isClosed && (
        <Osha301Banner
          incidentId={incident.id}
          occurredAt={incident.occurred_at}
        />
      )}

      <DetailTabs current={tab} basePath={basePath} />

      {tab === "summary" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            <IncidentSummaryCard incident={summaryData} />
            <WitnessStatementsSection
              statements={statements}
              basePath={basePath}
              canEdit={canEdit && !isClosed}
            />
          </div>
          <div className="space-y-4">
            <TeamPanel
              members={team}
              leadId={inv.lead_investigator_id}
              basePath={basePath}
              canEdit={canEdit && !isClosed}
              canReassignLead={canReassignLead && !isClosed}
            />
          </div>
        </div>
      )}

      {tab === "why" && (
        <TabPlaceholder label="5-Why" body="The 5-Why builder lands in the next commit (B3)." />
      )}
      {tab === "evidence" && (
        <TabPlaceholder label="Evidence" body="Drag-drop uploads land in the next commit (B3)." />
      )}
      {tab === "findings" && (
        <TabPlaceholder label="Findings" body="The autosaving findings editor lands in the next commit (B3)." />
      )}
      {tab === "timeline" && (
        <TabPlaceholder label="Timeline" body="Activity timeline lands in the next commit (B3)." />
      )}

      <DetailModals
        investigationId={inv.id}
        incidentId={incident.id}
        members={members}
        removableMember={removableMember}
      />
    </div>
  );
}

function TabPlaceholder({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed p-12 text-center text-sm">
      <h2 className="text-lg font-semibold">{label}</h2>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}
