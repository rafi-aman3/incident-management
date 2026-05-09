import Link from "next/link";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { SETUP_STEPS, type SetupProgress, type SetupStepSlug } from "@/lib/site-setup/steps";
import { cn } from "@/lib/utils";

type Props = {
  currentSlug: SetupStepSlug;
  progress: SetupProgress;
  siteName: string;
};

export function WizardChrome({ currentSlug, progress, siteName }: Props) {
  return (
    <div className="space-y-6 py-8">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Site setup</p>
        <h1 className="text-2xl font-semibold">{siteName}</h1>
        <p className="text-sm text-muted-foreground">
          Nine quick steps. Save and resume any time — nothing locks until you click Launch.
        </p>
      </div>

      <ProgressDots currentSlug={currentSlug} progress={progress} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
        <StepList currentSlug={currentSlug} progress={progress} />
        <div className="min-w-0">{/* page renders form panel here */}</div>
      </div>
    </div>
  );
}

export function ProgressDots({
  currentSlug,
  progress,
}: {
  currentSlug: SetupStepSlug;
  progress: SetupProgress;
}) {
  const completedCount = SETUP_STEPS.filter((s) => Boolean(progress[s.progressKey])).length;
  const currentNumber = SETUP_STEPS.find((s) => s.slug === currentSlug)?.number ?? 1;
  return (
    <ol
      className="flex items-center gap-2"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuenow={completedCount}
      aria-valuemin={0}
      aria-valuemax={SETUP_STEPS.length}
      aria-valuetext={`Step ${currentNumber} of ${SETUP_STEPS.length} · ${completedCount} complete`}
    >
      {SETUP_STEPS.map((step) => {
        const isDone = Boolean(progress[step.progressKey]);
        const isCurrent = step.slug === currentSlug;
        return (
          <li
            key={step.slug}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              isDone && "bg-success",
              !isDone && isCurrent && "bg-primary",
              !isDone && !isCurrent && "bg-muted"
            )}
            aria-current={isCurrent ? "step" : undefined}
          />
        );
      })}
    </ol>
  );
}

export function StepList({
  currentSlug,
  progress,
}: {
  currentSlug: SetupStepSlug;
  progress: SetupProgress;
}) {
  const currentNumber = SETUP_STEPS.find((s) => s.slug === currentSlug)?.number ?? 1;
  return (
    <nav aria-label="Site setup steps">
      <ol className="space-y-1 text-sm">
        {SETUP_STEPS.map((step) => {
          const isDone = Boolean(progress[step.progressKey]);
          const isCurrent = step.slug === currentSlug;
          const reachable = isDone || isCurrent || step.number <= currentNumber;
          const stateLabel = isDone
            ? "complete"
            : isCurrent
              ? "current"
              : reachable
                ? "not yet started"
                : "not yet available";
          return (
            <li key={step.slug}>
              <Link
                href={reachable ? `/admin/site-setup/${step.slug}` : "#"}
                aria-disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${step.number}: ${step.title}, ${stateLabel}`}
                tabIndex={reachable ? 0 : -1}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                  reachable && !isCurrent && "hover:bg-accent",
                  isCurrent && "bg-accent font-medium",
                  !reachable && "cursor-not-allowed opacity-50"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    isDone && "bg-success text-white",
                    !isDone && isCurrent && "bg-primary text-primary-foreground",
                    !isDone && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : step.number}
                </span>
                <span className="leading-tight">
                  <span className="block">{step.title}</span>
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Inline form-level error for the wizard's per-step forms with a Retry
 * button (mirrors the 6c–6h Retry pattern). Re-submits the same form by
 * type=submit + form=<formId>; relies on useActionState retaining values.
 *
 * Renders nothing when there's no error or the error is "Validation failed"
 * (those surface as fieldErrors below the relevant input).
 */
export function StepFormError({
  message,
  isPending,
  formId,
}: {
  message: string | undefined;
  isPending: boolean;
  formId?: string;
}) {
  if (!message || message === "Validation failed") return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-destructive">{message}</p>
      </div>
      <button
        type="submit"
        form={formId}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/15 disabled:opacity-50"
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        {isPending ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

export function StepFooter({
  prevHref,
  isPending,
  primaryLabel = "Save & continue",
  primaryDisabled,
}: {
  prevHref: string | null;
  isPending: boolean;
  primaryLabel?: string;
  primaryDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t pt-4">
      <div>
        {prevHref ? (
          <Link
            href={prevHref}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            ← Back
          </Link>
        ) : (
          <span />
        )}
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Save &amp; exit
        </Link>
        <button
          type="submit"
          disabled={isPending || primaryDisabled}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : primaryLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Reusable inline field error for the wizard's per-step forms.
 */
export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}

/**
 * Banner that surfaces above the form when a draft was restored from
 * localStorage. Shows when the draft was saved and offers a Discard button
 * (wipes localStorage and reloads the page so server-loaded defaults render).
 *
 * Used by every form step paired with `useDraftPersistence`.
 */
export function DraftRestoredBanner({
  restoredAtLabel,
  onDiscard,
}: {
  restoredAtLabel: string;
  onDiscard: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
    >
      <RotateCcw
        className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground"
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium">Draft restored</p>
        <p className="text-xs text-muted-foreground">
          We saved your in-progress edits {restoredAtLabel} so a tab close or
          refresh wouldn't lose them.
        </p>
      </div>
      <button
        type="button"
        onClick={onDiscard}
        className="inline-flex items-center gap-1 rounded border border-warning/40 bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
      >
        Discard draft
      </button>
    </div>
  );
}
