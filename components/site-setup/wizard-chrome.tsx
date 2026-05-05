import Link from "next/link";
import { Check } from "lucide-react";
import { SETUP_STEPS, type SetupProgress, type SetupStepNumber } from "@/lib/site-setup/steps";
import { cn } from "@/lib/utils";

type Props = {
  currentStep: SetupStepNumber;
  progress: SetupProgress;
  siteName: string;
};

export function WizardChrome({ currentStep, progress, siteName }: Props) {
  return (
    <div className="space-y-6 py-8">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Site setup</p>
        <h1 className="text-2xl font-semibold">{siteName}</h1>
        <p className="text-sm text-muted-foreground">
          Seven small steps. Save and resume any time — nothing locks until you click Launch.
        </p>
      </div>

      <ProgressDots currentStep={currentStep} progress={progress} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <StepList currentStep={currentStep} progress={progress} />
        <div className="min-w-0">{/* page renders form panel here */}</div>
      </div>
    </div>
  );
}

export function ProgressDots({
  currentStep,
  progress,
}: {
  currentStep: SetupStepNumber;
  progress: SetupProgress;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Setup progress">
      {SETUP_STEPS.map((step) => {
        const isDone = Boolean(progress[step.progressKey]);
        const isCurrent = step.number === currentStep;
        return (
          <li
            key={step.number}
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
  currentStep,
  progress,
}: {
  currentStep: SetupStepNumber;
  progress: SetupProgress;
}) {
  return (
    <ol className="space-y-1 text-sm">
      {SETUP_STEPS.map((step) => {
        const isDone = Boolean(progress[step.progressKey]);
        const isCurrent = step.number === currentStep;
        const reachable = isDone || isCurrent || step.number <= currentStep;
        return (
          <li key={step.number}>
            <Link
              href={reachable ? `/admin/site-setup/${step.number}` : "#"}
              aria-disabled={!reachable}
              tabIndex={reachable ? 0 : -1}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                reachable && !isCurrent && "hover:bg-accent",
                isCurrent && "bg-accent font-medium",
                !reachable && "cursor-not-allowed opacity-50"
              )}
            >
              <span
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
