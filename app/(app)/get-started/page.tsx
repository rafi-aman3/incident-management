import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { getChecklistState } from "@/lib/get-started/state";
import { ChecklistRow } from "@/components/get-started/checklist-row";
import { ShowDismissedToggle } from "@/components/get-started/show-dismissed-toggle";
import { EditUseCasesModal } from "./edit-use-cases-modal";

type Search = Promise<{ edit?: string; open?: string }>;

export default async function GetStartedPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  if (!(await orgCan("org:configure"))) {
    redirect("/dashboard");
  }
  const { profile } = await requireUser();
  const state = await getChecklistState({ orgId: profile.org_id, userId: profile.id });

  const pct = state.totalCount === 0 ? 100 : Math.round((state.doneCount / state.totalCount) * 100);
  const complete = state.doneCount >= state.totalCount && state.totalCount > 0;

  const visibleSections = state.sections.map((s) => ({
    ...s,
    visibleRows: s.rows.filter((r) => !r.dismissed),
  }));
  const dismissedRows = state.sections.flatMap((s) => s.rows.filter((r) => r.dismissed));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Get started</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {complete ? "You're all set" : "Finish setting up your workspace"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {complete
                ? "Every Get Started item is done or dismissed. The dashboard widget has hidden itself — this page stays here if you want to revisit."
                : "Auto-detected as you go. Dismiss anything that doesn't apply."}
            </p>
          </div>
          <EditUseCasesModal initialSelected={state.useCases} openByDefault={sp.edit === "use-cases"} />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={state.doneCount}
              aria-valuemin={0}
              aria-valuemax={state.totalCount}
            />
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {state.doneCount} of {state.totalCount} done
          </span>
        </div>
      </header>

      {complete ? (
        <section className="rounded-lg border bg-card p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">Setup complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Head back to your dashboard or explore Argus if you haven&apos;t already.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        visibleSections.map((section) => (
          section.visibleRows.length === 0 ? null : (
            <section key={section.key}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {section.label}
              </h2>
              <ul className="overflow-hidden rounded-lg border bg-card">
                {section.visibleRows.map((row) => (
                  <ChecklistRow key={row.item.id} row={row} allowDismiss />
                ))}
              </ul>
            </section>
          )
        ))
      )}

      <ShowDismissedToggle rows={dismissedRows} />
    </div>
  );
}
