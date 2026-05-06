import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ArrowLeft, ListChecks } from "lucide-react";
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
import {
  FiveWhyChain,
  type WhyRow,
} from "@/components/investigations/detail/five-why-chain";
import { FindingsEditor } from "@/components/investigations/detail/findings-editor";
import { EvidenceUploader } from "@/components/investigations/detail/evidence-uploader";
import {
  EvidenceGrid,
  type EvidenceItem,
} from "@/components/investigations/detail/evidence-grid";
import {
  ActivityTimeline,
  type ActivityEvent,
} from "@/components/investigations/detail/activity-timeline";
import { CapaCreateModal } from "@/components/capa/capa-create-modal";
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
  const [canEdit, canReassignLead, canCreateCapa] = currentSiteId
    ? await Promise.all([
        can("investigation:edit", currentSiteId),
        can("investigation:lead", currentSiteId),
        can("capa:create", currentSiteId),
      ])
    : [false, false, false];

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

  // 6. Tab-specific data — fetched only when the tab is active so we don't
  //    pay for evidence signed URLs / activity events on every detail load.
  let whys: WhyRow[] = [];
  let evidenceItems: EvidenceItem[] = [];
  let timeline: ActivityEvent[] = [];

  if (tab === "why") {
    const { data: whyRaw } = await supabase
      .from("rca_whys")
      .select("level, question, answer")
      .eq("investigation_id", inv.id)
      .order("level", { ascending: true });
    whys = (whyRaw ?? []).map((w) => ({
      level: w.level,
      question: w.question ?? "",
      answer: w.answer ?? "",
    }));
  }

  if (tab === "evidence") {
    const { data: evRaw } = await supabase
      .from("investigation_evidence")
      .select(
        "id, file_name, mime_type, size_bytes, storage_path, uploaded_at, uploader:uploaded_by ( full_name, email )"
      )
      .eq("investigation_id", inv.id)
      .order("uploaded_at", { ascending: false });
    const rows = evRaw ?? [];
    const paths = rows.map((r) => r.storage_path);
    const { data: signed } = paths.length
      ? await supabase.storage
          .from("investigation-evidence")
          .createSignedUrls(paths, 60 * 60)
      : { data: [] };
    const signedByPath = new Map<string, string | null>();
    (signed ?? []).forEach((s) => {
      signedByPath.set(s.path ?? "", s.error ? null : s.signedUrl);
    });
    evidenceItems = rows.map((r) => ({
      id: r.id,
      file_name: r.file_name,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      uploaded_at: r.uploaded_at,
      uploaded_by_name: r.uploader?.full_name ?? r.uploader?.email ?? null,
      signed_url: signedByPath.get(r.storage_path) ?? null,
    }));
  }

  if (tab === "timeline") {
    const { data: actRaw } = await supabase
      .from("activity_events")
      .select("id, verb, payload, created_at, actor:actor_id ( full_name, email )")
      .or(`investigation_id.eq.${inv.id},incident_id.eq.${incident.id}`)
      .order("created_at", { ascending: false })
      .limit(100);
    timeline = (actRaw ?? []).map((e) => ({
      id: e.id,
      verb: e.verb,
      payload: (e.payload ?? {}) as Record<string, unknown>,
      created_at: e.created_at,
      actor_name: e.actor?.full_name ?? e.actor?.email ?? null,
    }));
  }

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

        {!isClosed && (canEdit || canCreateCapa) && (
          <div className="flex items-center gap-2">
            {canCreateCapa && (
              <Link
                href={`${basePath}?action=create-capa`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <ListChecks className="h-4 w-4" /> Assign CAPA
              </Link>
            )}
            {canEdit && (
              <Link
                href={`${basePath}?action=close-no-capa`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <CheckCircle2 className="h-4 w-4" /> Close — no CAPA
              </Link>
            )}
          </div>
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
        <FiveWhyChain
          investigationId={inv.id}
          initialWhys={whys}
          initialRootCause={inv.root_cause_summary ?? ""}
          readOnly={!canEdit || isClosed}
        />
      )}

      {tab === "evidence" && (
        <div className="space-y-4">
          {canEdit && !isClosed && <EvidenceUploader investigationId={inv.id} />}
          <EvidenceGrid
            investigationId={inv.id}
            items={evidenceItems}
            canDelete={canEdit && !isClosed}
          />
        </div>
      )}

      {tab === "findings" && (
        <FindingsEditor
          investigationId={inv.id}
          initial={inv.findings ?? ""}
          readOnly={!canEdit || isClosed}
        />
      )}

      {tab === "timeline" && <ActivityTimeline events={timeline} />}

      <DetailModals
        investigationId={inv.id}
        incidentId={incident.id}
        members={members}
        removableMember={removableMember}
      />

      {canCreateCapa && (
        <CapaCreateModal
          members={members}
          context={{
            kind: "investigation",
            investigationId: inv.id,
            defaultOwnerId: inv.lead_investigator_id ?? null,
          }}
        />
      )}
    </div>
  );
}
