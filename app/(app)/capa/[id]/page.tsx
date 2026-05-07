import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { CapaStatusBadge } from "@/components/capa/badges";
import { DueDateChip } from "@/components/investigations/badges";
import { CapaDescriptionCard } from "@/components/capa/detail/description-card";
import { CapaProgressSection } from "@/components/capa/detail/progress-section";
import { OwnerVerifierCard } from "@/components/capa/detail/owner-verifier-card";
import { SourceInvestigationLink } from "@/components/capa/detail/source-investigation-link";
import { CompleteCapaButton } from "@/components/capa/detail/complete-capa-button";
import { VerificationForm } from "@/components/capa/detail/verification-form";
import { LinkedDocumentsSection } from "@/components/documents/linked-documents-section";
import { CapaModals, type CapaSiteMember } from "@/components/capa/detail/capa-modals";
import { VerifierWelcomeCard } from "@/components/onboarding/verifier-welcome-card";
import {
  ActivityTimeline,
  type ActivityEvent,
} from "@/components/investigations/detail/activity-timeline";
import type { CapaStatus } from "@/lib/capa/types";

type Params = Promise<{ id: string }>;

export default async function CapaDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, user, profile, currentSiteId } = await requireUser();

  const { data: capa, error: readErr } = await supabase
    .from("capas")
    .select(
      `id, ref_code, type, title, description, status, progress_pct, due_date,
       owner_id, verifier_id, site_id, completed_at, verified_at, closed_at,
       rejection_reason, follow_up_capa_id, investigation_id,
       owner:profiles!capas_owner_id_fkey ( id, full_name, email ),
       verifier:profiles!capas_verifier_id_fkey ( id, full_name, email ),
       investigation:investigation_id (
         id, ref_code,
         incident:incident_id ( title )
       ),
       follow_up:capas!capas_follow_up_capa_id_fkey ( id, ref_code, title )`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (readErr || !capa || !capa.owner) notFound();

  // Supabase returns the self-FK embed as an array since the type system
  // can't infer the cardinality of `follow_up_capa_id`. There's at most one.
  const followUpRaw = capa.follow_up;
  const followUp = Array.isArray(followUpRaw) ? (followUpRaw[0] ?? null) : followUpRaw;

  const status = capa.status as CapaStatus;
  const isOwner = capa.owner_id === user.id;
  const isAssignedVerifier = capa.verifier_id === user.id;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    !!capa.due_date &&
    capa.due_date < today &&
    status !== "verified" &&
    status !== "closed";

  const [canReassignVerifier, canVerify] = currentSiteId
    ? await Promise.all([
        can("capa:reassign_verifier", currentSiteId),
        can("capa:verify", currentSiteId),
      ])
    : [false, false];

  // Verification form rules — viewer must be the assigned verifier (not the
  // owner) AND have capa:verify AND status must be pending_verification.
  // Form is HIDDEN (not disabled) when viewer is owner per the critical UX
  // rule in plan §C2 / DoD #7.
  const showVerificationForm =
    status === "pending_verification" &&
    !isOwner &&
    isAssignedVerifier &&
    canVerify;

  // Site members for the reassign-verifier modal
  const { data: siteMembersRaw } = await supabase
    .from("site_members")
    .select("profile:profiles ( id, full_name, email )")
    .eq("site_id", capa.site_id);
  const members: CapaSiteMember[] = (siteMembersRaw ?? [])
    .filter((m) => m.profile)
    .map((m) => ({
      id: m.profile!.id,
      full_name: m.profile!.full_name,
      email: m.profile!.email,
    }));

  // Activity timeline — 2-source merge: activity_events + notifications keyed
  // on capa_id. Both pre-sorted desc; merged + re-sorted in TS.
  const [actRes, notifRes] = await Promise.all([
    supabase
      .from("activity_events")
      .select("id, verb, payload, created_at, actor:actor_id ( full_name, email )")
      .eq("capa_id", capa.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id, kind, title, body, created_at")
      .eq("capa_id", capa.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const actEvents: ActivityEvent[] = (actRes.data ?? []).map((e) => ({
    id: e.id,
    verb: e.verb,
    payload: (e.payload ?? {}) as Record<string, unknown>,
    created_at: e.created_at,
    actor_name: e.actor?.full_name ?? e.actor?.email ?? null,
    href: null,
  }));
  const notifEvents: ActivityEvent[] = (notifRes.data ?? []).map((n) => ({
    id: `notif-${n.id}`,
    verb: `notification.${n.kind}`,
    payload: { kind: n.kind, title: n.title, body: n.body } as Record<string, unknown>,
    created_at: n.created_at,
    actor_name: null, // notifications are system-generated → renders as "System"
    href: null, // CAPA notifications target this page; no deep link needed
  }));
  const timeline: ActivityEvent[] = [...actEvents, ...notifEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const basePath = `/capa/${capa.id}`;
  const editable = isOwner && status !== "pending_verification" && status !== "verified" && status !== "closed";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/capa"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> CAPA
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{capa.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CapaStatusBadge status={status} overdue={isOverdue} />
            {!isOverdue && status !== "verified" && status !== "closed" && (
              <DueDateChip dueDate={capa.due_date} />
            )}
          </div>
        </div>
      </div>

      {followUp && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
          <p className="font-medium">
            Verified as <em>partially effective</em> — a follow-up CAPA was created
            automatically.
          </p>
          <Link
            href={`/capa/${followUp.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open follow-up: {followUp.ref_code ?? followUp.title}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left column (60%) */}
        <div className="min-w-0 space-y-4">
          <CapaDescriptionCard
            refCode={capa.ref_code}
            title={capa.title}
            description={capa.description}
            type={capa.type as "corrective" | "preventive"}
            rejectionReason={
              status === "in_progress" && capa.rejection_reason
                ? capa.rejection_reason
                : null
            }
          />

          <CapaProgressSection
            capaId={capa.id}
            initialPct={capa.progress_pct ?? 0}
            readOnly={!editable}
            hint={
              !isOwner
                ? "Only the CAPA owner can update progress."
                : status === "pending_verification"
                  ? "Awaiting verification — progress is locked."
                  : status === "verified" || status === "closed"
                    ? "CAPA closed — progress is locked."
                    : "Drag the slider as you implement the action; saves automatically."
            }
          />

          {isOwner &&
            (status === "created" || status === "in_progress") && (
              <CompleteCapaButton
                capaId={capa.id}
                hasVerifier={!!capa.verifier_id}
                disabled={!editable}
              />
            )}

          {showVerificationForm && (
            <VerificationForm
              capaId={capa.id}
              ownerName={capa.owner!.full_name ?? capa.owner!.email}
            />
          )}

          <div className="rounded-md border bg-card p-4">
            <LinkedDocumentsSection
              parentType="capa"
              parentId={capa.id}
              orgId={profile.org_id}
              defaultLinkRole={
                status === "pending_verification" || status === "verified" || status === "closed"
                  ? "verification_evidence"
                  : "evidence"
              }
              defaultTypeFilter="evidence"
              canLink={status !== "closed"}
              canUnlink={status !== "closed"}
              title="Evidence & references"
              emptyHint="Attach SOPs, training certificates, audit reports, or photos that support this CAPA."
            />
          </div>

          {status === "pending_verification" && isOwner && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
              <p className="font-medium">Awaiting independent verification</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Your verifier reviews the implementation and submits an outcome.
                You&apos;ll see the result here when they&apos;re done.
              </p>
            </div>
          )}

          <ActivityTimeline events={timeline} />
        </div>

        {/* Right column (40%) */}
        <div className="space-y-4">
          <SourceInvestigationLink
            investigationId={capa.investigation?.id ?? null}
            investigationRef={capa.investigation?.ref_code ?? null}
            incidentTitle={capa.investigation?.incident?.title ?? null}
          />
          <OwnerVerifierCard
            ownerName={capa.owner!.full_name}
            ownerEmail={capa.owner!.email}
            verifierName={capa.verifier?.full_name ?? null}
            verifierEmail={capa.verifier?.email ?? null}
            basePath={basePath}
            canReassignVerifier={canReassignVerifier}
            status={status}
          />
        </div>
      </div>

      <CapaModals capaId={capa.id} ownerId={capa.owner_id} members={members} />

      {showVerificationForm && <VerifierWelcomeCard capaTitle={capa.title} />}
    </div>
  );
}
