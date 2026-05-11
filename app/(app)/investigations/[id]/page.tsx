import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ArrowLeft, ListChecks } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { orgCan } from "@/lib/auth/orgCan";
import {
  InvestigationStatusBadge,
  DueDateChip,
} from "@/components/investigations/badges";
import { DetailTabs, type DetailTabKey, DETAIL_TABS } from "@/components/investigations/detail/detail-tabs";
import { ArgusInvestigator } from "@/components/argus/argus-investigator";
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
import { LinkedDocumentsSection } from "@/components/documents/linked-documents-section";
import {
  EvidenceGrid,
  type EvidenceItem,
} from "@/components/investigations/detail/evidence-grid";
import {
  ActivityTimeline,
  type ActivityEvent,
} from "@/components/investigations/detail/activity-timeline";
import { CapaCreateModal } from "@/components/capa/capa-create-modal";
import { BulletinCta } from "@/components/investigations/bulletin-cta";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import type { ArgusPageContext } from "@/lib/argus/page-context";
import type { InvestigationStatus } from "@/lib/investigations/types";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VALID_TABS: ReadonlyArray<DetailTabKey> = DETAIL_TABS.map((t) => t.key);

/**
 * Decide the most useful deep-link target for an activity_events row,
 * given which parent FK it carries. CAPA verbs jump to /capa/[id]; incident
 * verbs to /incidents/[id]; investigation verbs return null (we're already
 * looking at the investigation).
 */
function deepLinkForVerb(
  verb: string,
  parents: { incident_id: string | null; investigation_id: string | null; capa_id: string | null },
): string | null {
  if (verb.startsWith("capa.") && parents.capa_id) return `/capa/${parents.capa_id}`;
  if (verb.startsWith("incident.") && parents.incident_id) {
    return `/incidents/${parents.incident_id}`;
  }
  return null;
}

export default async function InvestigationDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, profile, currentSiteId } = await requireUser();

  let tab: DetailTabKey =
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
  const [canEdit, canReassignLead, canCreateCapa, canUseArgus, canCreateBulletin] = currentSiteId
    ? await Promise.all([
        can("investigation:edit", currentSiteId),
        can("investigation:lead", currentSiteId),
        can("capa:create", currentSiteId),
        orgCan("argus:use"),
        can("bulletin:create", currentSiteId),
      ])
    : [false, false, false, false, false];

  // Bulletin CTA gate — render on closed Track-A investigations to viewers
  // who can author. Look up any existing non-archived bulletin sourced from
  // this investigation; if one exists, swap CTA for a "drafted" link card.
  let existingBulletin: { id: string; title: string } | null = null;
  if (isClosed && incident.track === "A" && canCreateBulletin) {
    const { data: existing } = await supabase
      .from("safety_bulletins")
      .select("id, title")
      .eq("source_investigation_id", inv.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      existingBulletin = { id: existing.id as string, title: existing.title as string };
    }
  }
  const showBulletinCta = isClosed && incident.track === "A" && canCreateBulletin;

  // Org-level Argus flag — combined with the four conditions below to decide
  // whether the AI Investigator tab is rendered at all (per Phase 9c plan).
  const { data: orgRow } = await supabase
    .from("orgs")
    .select("argus_enabled")
    .eq("id", profile.org_id)
    .maybeSingle();
  const argusTabEnabled =
    Boolean(orgRow?.argus_enabled) && canUseArgus && canEdit && !isClosed;

  // Fall back to Summary if the URL says ?tab=ai but the tab is hidden — a
  // closed investigation, a missing perm, or an org with argus_enabled=false
  // shouldn't render the AI workspace.
  if (tab === "ai" && !argusTabEnabled) tab = "summary";

  // 3. Site members — needed always (modals use them on every tab).
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

  // 4. Team + witness statements — Summary needs both, AI Investigator
  //    needs witnesses (read-only seed) too. Fetched when either tab is
  //    active.
  let team: InvestigationTeamMember[] = [];
  let statements: WitnessStatement[] = [];
  if (tab === "summary") {
    const [teamRes, witnessRes] = await Promise.all([
      supabase
        .from("investigation_team_members")
        .select("profile_id, role, profile:profiles ( full_name, email )")
        .eq("investigation_id", inv.id),
      supabase
        .from("witnesses")
        .select("id, name, contact, statement")
        .eq("incident_id", incident.id),
    ]);
    team = (teamRes.data ?? [])
      .filter((m) => m.profile)
      .map((m) => ({
        profile_id: m.profile_id,
        role: m.role as InvestigationTeamMember["role"],
        full_name: m.profile!.full_name,
        email: m.profile!.email,
      }));
    statements = witnessRes.data ?? [];
  } else if (tab === "ai" && argusTabEnabled) {
    const { data: witnessRes } = await supabase
      .from("witnesses")
      .select("id, name, contact, statement")
      .eq("incident_id", incident.id);
    statements = witnessRes ?? [];
  }

  // For the AI tab: the output panel needs to know if the 5-Why chain
  // already has any rows so it can warn before overwriting on Push.
  let hasAnyWhys = false;
  if (tab === "ai" && argusTabEnabled) {
    const { count } = await supabase
      .from("rca_whys")
      .select("level", { count: "exact", head: true })
      .eq("investigation_id", inv.id);
    hasAnyWhys = (count ?? 0) > 0;
  }

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
    // Look up CAPAs spawned from this investigation so their activity rows
    // can be joined into the timeline.
    const { data: capaIdRows } = await supabase
      .from("capas")
      .select("id")
      .eq("investigation_id", inv.id);
    const capaIds = (capaIdRows ?? []).map((c) => c.id);

    const orParts = [
      `investigation_id.eq.${inv.id}`,
      `incident_id.eq.${incident.id}`,
    ];
    if (capaIds.length > 0) {
      orParts.push(`capa_id.in.(${capaIds.join(",")})`);
    }

    const [actRes, notifRes] = await Promise.all([
      supabase
        .from("activity_events")
        .select(
          "id, verb, payload, created_at, incident_id, investigation_id, capa_id, actor:actor_id ( full_name, email )"
        )
        .or(orParts.join(","))
        .order("created_at", { ascending: false })
        .limit(150),
      supabase
        .from("notifications")
        .select("id, kind, title, capa_id, incident_id, created_at, recipient:recipient_id ( full_name, email )")
        .eq("incident_id", incident.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const fromActivity: ActivityEvent[] = (actRes.data ?? []).map((e) => ({
      id: e.id,
      verb: e.verb,
      payload: (e.payload ?? {}) as Record<string, unknown>,
      created_at: e.created_at,
      actor_name: e.actor?.full_name ?? e.actor?.email ?? null,
      href: deepLinkForVerb(e.verb, {
        incident_id: e.incident_id,
        investigation_id: e.investigation_id,
        capa_id: e.capa_id,
      }),
    }));

    const fromNotifs: ActivityEvent[] = (notifRes.data ?? []).map((n) => ({
      id: `notif-${n.id}`,
      verb: "notification.fired",
      payload: { kind: n.kind, title: n.title } as Record<string, unknown>,
      created_at: n.created_at,
      actor_name: n.recipient?.full_name ?? n.recipient?.email ?? null,
      href: n.capa_id ? `/capa/${n.capa_id}` : `/incidents/${n.incident_id}`,
    }));

    timeline = [...fromActivity, ...fromNotifs].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    );
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

  const argusContext: ArgusPageContext = {
    route: "investigation_detail",
    routeLabel: inv.ref_code ? `Investigation ${inv.ref_code}` : "Investigation",
    siteId: inv.site_id,
    aggregates: {
      whys_filled: 0,
      findings: Array.isArray(inv.findings) ? inv.findings.length : 0,
      witness_statements: statements.length,
    },
    records: [
      {
        kind: "investigation" as const,
        id: inv.id,
        refCode: inv.ref_code,
        title: `Status ${status}${inv.due_date ? " · due " + inv.due_date : ""}`,
      },
      {
        kind: "incident" as const,
        id: incident.id,
        refCode: incident.ref_code,
        title: incident.severity
          ? `${incident.severity} ${incident.type}`
          : incident.type,
      },
    ],
  };

  return (
    <div className="space-y-4">
      <ArgusContextPayload context={argusContext} />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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
              <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning-foreground dark:text-warning">
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

      <DetailTabs current={tab} basePath={basePath} argusEnabled={argusTabEnabled} />

      {tab === "summary" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            {showBulletinCta && (
              existingBulletin ? (
                <BulletinCta existing={existingBulletin} />
              ) : (
                <BulletinCta investigationId={inv.id} />
              )
            )}
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
          <div className="rounded-md border bg-card p-4">
            <LinkedDocumentsSection
              parentType="investigation"
              parentId={inv.id}
              orgId={profile.org_id}
              defaultLinkRole="evidence"
              defaultTypeFilter="evidence"
              canLink={canEdit && !isClosed}
              canUnlink={canEdit && !isClosed}
              title="Library evidence"
              emptyHint="Pull SDS sheets, SOPs, training records, or audit reports from the library — they keep the link audit-trail intact across modules."
            />
          </div>
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

      {tab === "ai" && argusTabEnabled && (
        <ArgusInvestigator
          investigationId={inv.id}
          seed={{
            description: incident.description,
            type: incident.type,
            area: incident.area,
            location: incident.location,
            occurredAt: incident.occurred_at,
          }}
          existingWitnesses={statements.map((s) => ({
            id: s.id,
            name: s.name,
            statement: s.statement,
          }))}
          existing={{
            findings: inv.findings ?? "",
            rootCauseSummary: inv.root_cause_summary ?? "",
            hasAnyWhys,
          }}
        />
      )}

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
            siteId: inv.site_id,
            argusEnabled:
              Boolean(orgRow?.argus_enabled) &&
              canUseArgus &&
              !profile.argus_copilot_disabled,
            defaultOwnerId: inv.lead_investigator_id ?? null,
          }}
        />
      )}
    </div>
  );
}
