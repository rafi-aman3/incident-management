import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  CandidateReviewForm,
  type ReviewableSite,
} from "@/components/hazards/candidate-review-form";

type Params = Promise<{ id: string }>;

const SOURCE_LABEL: Record<string, string> = {
  worker_report: "Worker report",
  inspection: "Inspection",
  incident_review: "Incident review",
  management_of_change: "Management of change",
  audit_finding: "Audit finding",
  external_advisory: "External advisory",
  sds_import: "SDS import",
  jsa: "JSA",
};

export default async function CandidateDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, currentSiteId, memberships } = await requireUser();

  if (!(await can("hazard_candidate:review", currentSiteId))) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        You need <code>hazard_candidate:review</code> to review candidates.
      </div>
    );
  }

  type CandidateRow = {
    id: string;
    source_type: string;
    source_reference_id: string | null;
    proposed_title: string;
    proposed_category: string;
    proposed_description: string | null;
    site_id: string | null;
    area: string | null;
    proposed_metadata: Record<string, unknown> | null;
    status: string;
    created_at: string;
    site: { name: string } | null;
    proposer: { full_name: string | null; email: string | null } | null;
  };
  const { data: candidate, error } = await supabase
    .from("hazard_candidates")
    .select(
      "id, source_type, source_reference_id, proposed_title, proposed_category, proposed_description, " +
        "site_id, area, proposed_metadata, status, created_at, " +
        "site:site_id(name), proposer:proposed_by(full_name, email)",
    )
    .eq("id", id)
    .single<CandidateRow>();

  if (error || !candidate) notFound();
  if (candidate.status !== "pending_review") {
    return (
      <div className="space-y-4">
        <Link href="/hazards/candidates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Link>
        <div className="rounded-lg border bg-muted/30 p-6 text-sm">
          This candidate is already <strong>{candidate.status as string}</strong>.
        </div>
      </div>
    );
  }

  // Sites the user can convert into
  const siteIds = memberships.map((m) => m.site_id).filter((id, i, a) => a.indexOf(id) === i);
  const { data: sitesData } = await supabase
    .from("sites")
    .select("id, name")
    .in("id", siteIds);
  const sites: ReviewableSite[] = (sitesData ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));

  // Existing hazards (for merge)
  const { data: hazardOptions } = await supabase
    .from("hazards")
    .select("id, ref_code, title")
    .is("deleted_at", null)
    .not("status", "in", "(closed,superseded)")
    .order("identified_at", { ascending: false })
    .limit(100);
  const existingHazards = (hazardOptions ?? []).map((h) => ({
    id: h.id,
    ref_code: h.ref_code,
    title: h.title,
  }));

  const site = candidate.site;
  const proposer = candidate.proposer;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/hazards/candidates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
            {SOURCE_LABEL[candidate.source_type as string] ?? candidate.source_type}
          </span>
          {candidate.source_reference_id && (
            <span className="font-mono text-muted-foreground">{candidate.source_reference_id as string}</span>
          )}
          {site?.name && <span className="text-muted-foreground">· {site.name}</span>}
        </div>
        <h1 className="text-2xl font-semibold">{candidate.proposed_title as string}</h1>
        {candidate.proposed_description && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{candidate.proposed_description as string}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Proposed {new Date(candidate.created_at as string).toLocaleString()}
          {proposer && ` · by ${proposer.full_name ?? proposer.email}`}
        </p>
      </header>

      <CandidateReviewForm
        candidate={{
          id: candidate.id as string,
          source_type: candidate.source_type as string,
          proposed_title: candidate.proposed_title as string,
          proposed_category: candidate.proposed_category as string,
          proposed_description: (candidate.proposed_description as string | null) ?? null,
          site_id: (candidate.site_id as string | null) ?? null,
          area: (candidate.area as string | null) ?? null,
          proposed_metadata: candidate.proposed_metadata as Record<string, unknown> | null,
        }}
        sites={sites}
        defaultSiteId={currentSiteId}
        existingHazards={existingHazards}
      />
    </div>
  );
}
