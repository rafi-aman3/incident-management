import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { unpublishJsa } from "@/lib/actions/jsa";
import { JsaWizard, type JsaWizardData } from "@/components/jsa/jsa-wizard";
import { Button } from "@/components/ui/button";
import type { JsaStatus } from "@/lib/actions/jsa-schemas";
import type { HazardCategory, Likelihood, Consequence, ControlLevel } from "@/lib/risk/types";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function unpublishAndRedirect(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await unpublishJsa(id);
  redirect(`/jsa/${id}/edit?step=steps`);
}

export default async function EditJsaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  await searchParams; // ensure params are awaited per Next 16 conventions

  const { supabase, user } = await requireUser();

  type EditRow = {
    id: string;
    site_id: string;
    title: string;
    job_description: string | null;
    area: string | null;
    performed_by_roles: string[];
    performed_by_workgroups: string[];
    frequency: string | null;
    estimated_duration_minutes: number | null;
    ppe_required: string[];
    permits_required: string[];
    status: JsaStatus;
    created_by: string;
    steps: Array<{
      sequence: number;
      step_description: string;
      hazards: Array<{
        hazard_description: string;
        hazard_category: HazardCategory;
        likelihood: Likelihood;
        consequence: Consequence;
        controls: Array<{ control_level: ControlLevel; control_description: string }>;
      }>;
    }>;
  };
  const { data: jsa, error } = await supabase
    .from("jsas")
    .select(
      "id, site_id, title, job_description, area, performed_by_roles, performed_by_workgroups, " +
        "frequency, estimated_duration_minutes, ppe_required, permits_required, status, created_by, " +
        "steps:jsa_steps(sequence, step_description, " +
        "  hazards:jsa_step_hazards(hazard_description, hazard_category, likelihood, consequence, " +
        "    controls:jsa_step_controls(control_level, control_description)" +
        "  )" +
        ")",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .order("sequence", { foreignTable: "steps", ascending: true })
    .returns<EditRow[]>()
    .maybeSingle();

  if (error || !jsa) notFound();

  const canDraft = await can("jsa:draft", jsa.site_id);
  const canApprove = await can("jsa:approve", jsa.site_id);

  // Approved JSAs need an explicit unpublish before editing. Show a gate page.
  if (jsa.status === "approved") {
    const isAuthor = jsa.created_by === user.id;
    const canUnpub = canApprove || (isAuthor && canDraft);
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/jsa/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to JSA
        </Link>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-6">
          <h1 className="text-lg font-semibold">JSA is approved</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved JSAs can't be edited directly. Unpublish to return it to draft, edit, then re-approve.
          </p>
          {canUnpub ? (
            <form action={unpublishAndRedirect} className="mt-4">
              <input type="hidden" name="id" value={id} />
              <Button type="submit">Unpublish & edit</Button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              You need <code>jsa:approve</code>, or to be the JSA's author with <code>jsa:draft</code>, to unpublish.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (jsa.status === "archived" || jsa.status === "expired") {
    redirect(`/jsa/${id}`);
  }

  // Drafts: must have jsa:draft. Under-review: can land on Approve step.
  if (jsa.status === "draft" && !canDraft) redirect(`/jsa/${id}`);

  const data: JsaWizardData = {
    jsaId: jsa.id,
    siteId: jsa.site_id,
    title: jsa.title,
    job_description: jsa.job_description,
    area: jsa.area,
    performed_by_roles: jsa.performed_by_roles ?? [],
    performed_by_workgroups: jsa.performed_by_workgroups ?? [],
    frequency: jsa.frequency,
    estimated_duration_minutes: jsa.estimated_duration_minutes,
    ppe_required: jsa.ppe_required ?? [],
    permits_required: jsa.permits_required ?? [],
    status: jsa.status,
    created_by: jsa.created_by,
    steps: (jsa.steps ?? [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => ({
        step_description: s.step_description,
        hazards: (s.hazards ?? []).map((h) => ({
          hazard_description: h.hazard_description,
          hazard_category: h.hazard_category,
          likelihood: h.likelihood,
          consequence: h.consequence,
          controls: h.controls ?? [],
        })),
      })),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/jsa/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to JSA
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{jsa.title}</h1>
        <p className="text-sm text-muted-foreground">Edit and approve below.</p>
      </div>
      <JsaWizard
        data={data}
        viewer={{
          userId: user.id,
          canDraft,
          canApprove,
        }}
      />
    </div>
  );
}
