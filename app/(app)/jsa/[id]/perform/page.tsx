import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { JsaSignoffForm } from "@/components/jsa/jsa-signoff-form";
import { JsaStatusBadge } from "@/components/jsa/jsa-status-badge";
import { CONTROL_LEVEL_LABELS } from "@/lib/risk/matrix";
import type { JsaStatus } from "@/lib/actions/jsa-schemas";
import type { ControlLevel, RiskLevel, HazardCategory } from "@/lib/risk/types";

type Params = Promise<{ id: string }>;

export default async function PerformJsaPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  type PerformRow = {
    id: string;
    ref_code: string | null;
    title: string;
    job_description: string | null;
    area: string | null;
    site_id: string;
    site: { name: string } | null;
    status: JsaStatus;
    expires_at: string | null;
    ppe_required: string[];
    permits_required: string[];
    steps: Array<{
      id: string;
      sequence: number;
      step_description: string;
      hazards: Array<{
        id: string;
        hazard_description: string;
        hazard_category: HazardCategory;
        residual_risk_score: RiskLevel;
        controls: Array<{ control_level: ControlLevel; control_description: string }>;
      }>;
    }>;
    my_signoffs: Array<{ id: string; signed_at: string; signed_for_session: string | null }>;
  };
  const { data: jsa, error } = await supabase
    .from("jsas")
    .select(
      "id, ref_code, title, job_description, area, site_id, status, expires_at, " +
        "site:site_id(name), ppe_required, permits_required, " +
        "steps:jsa_steps(id, sequence, step_description, " +
        "  hazards:jsa_step_hazards(id, hazard_description, hazard_category, residual_risk_score, " +
        "    controls:jsa_step_controls(control_level, control_description)" +
        "  )" +
        "), " +
        "my_signoffs:jsa_signoffs!jsa_id(id, signed_at, signed_for_session)",
    )
    .eq("id", id)
    .eq("my_signoffs.worker_id", user.id)
    .is("deleted_at", null)
    .order("sequence", { foreignTable: "steps", ascending: true })
    .returns<PerformRow[]>()
    .maybeSingle();

  if (error || !jsa) notFound();
  if (!(await can("jsa:signoff", jsa.site_id))) redirect(`/jsa/${id}`);

  const isApproved = jsa.status === "approved";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/jsa/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to JSA
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {jsa.ref_code ?? jsa.id.slice(0, 8)}
          </p>
          <h1 className="text-2xl font-semibold">{jsa.title}</h1>
          {jsa.area || jsa.site?.name ? (
            <p className="text-sm text-muted-foreground">
              {jsa.site?.name ?? "—"}
              {jsa.area ? ` · ${jsa.area}` : ""}
            </p>
          ) : null}
        </div>
        <JsaStatusBadge status={jsa.status} />
      </header>

      {jsa.job_description && (
        <section className="rounded-lg border bg-card p-4 text-sm">
          {jsa.job_description}
        </section>
      )}

      {jsa.ppe_required.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">PPE required</h2>
          <ul className="mt-1 flex flex-wrap gap-1 text-xs">
            {jsa.ppe_required.map((p) => (
              <li key={p} className="rounded-full border bg-background px-2 py-0.5">{p}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">What you must do at each step</h2>
        {jsa.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steps defined.</p>
        ) : (
          <ol className="space-y-3">
            {jsa.steps.map((s) => (
              <li key={s.id} className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold text-muted-foreground">Step {s.sequence}</p>
                <p className="text-sm">{s.step_description}</p>
                {s.hazards.length > 0 && (
                  <ul className="mt-2 space-y-2 text-xs">
                    {s.hazards.map((h) => (
                      <li key={h.id} className="rounded-md border bg-background p-2">
                        <p className="font-medium">{h.hazard_description}</p>
                        <ul className="mt-1 space-y-0.5">
                          {h.controls.map((c, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="min-w-[100px] rounded bg-muted px-1.5 py-0.5 font-medium">
                                {CONTROL_LEVEL_LABELS[c.control_level]}
                              </span>
                              <span>{c.control_description}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {jsa.my_signoffs.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Your prior sign-offs</h2>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {jsa.my_signoffs.map((so) => (
              <li key={so.id}>
                {so.signed_for_session ?? "no session"} · {new Date(so.signed_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsaSignoffForm
        jsaId={jsa.id}
        disabled={!isApproved}
        disabledReason={
          !isApproved ? "Sign-offs are only allowed on approved JSAs." : undefined
        }
      />
    </div>
  );
}
