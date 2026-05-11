"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { bootstrapOrg, finishOnboardingWithUseCases } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/lib/incidents/schemas";
import { cn } from "@/lib/utils";
import { USE_CASE_KEYS, type UseCaseKey } from "@/lib/get-started/use-cases";
import { UseCaseTiles } from "@/components/get-started/use-case-tiles";

type StepKey = "org" | "use_cases";

const INDUSTRIES = [
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "warehouse", label: "Warehouse / Logistics" },
  { value: "office", label: "Office" },
  { value: "construction", label: "Construction" },
  { value: "lab", label: "Lab / R&D" },
] as const;

const TIMEZONE_HINTS = [
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "UTC", label: "UTC" },
];

const STEP_ORDER: StepKey[] = ["org", "use_cases"];
const STEP_LABELS: Record<StepKey, string> = {
  org: "Workspace",
  use_cases: "Use-cases",
};

export function OnboardingWizard({
  email,
  fullName,
  initialStep,
  defaultOrgName,
}: {
  email: string;
  fullName: string;
  initialStep: StepKey;
  defaultOrgName: string | null;
}) {
  const [step, setStep] = useState<StepKey>(initialStep);

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}
        </p>
        <h1 className="text-2xl font-semibold">Set up your workspace</h1>
        <p className="text-sm text-muted-foreground">
          Two quick steps and you&apos;re ready to start.
        </p>
      </header>

      <ProgressBar current={step} />

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {step === "org" ? (
          <OrgAndSiteStep
            defaultOrgName={defaultOrgName}
            onSuccess={() => setStep("use_cases")}
          />
        ) : (
          <UseCasesStep />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Signed in as <span className="font-medium">{email}</span>
      </p>
    </div>
  );
}

function ProgressBar({ current }: { current: StepKey }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <ol
      className="flex items-center gap-2"
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuenow={currentIdx + 1}
      aria-valuemin={1}
      aria-valuemax={STEP_ORDER.length}
      aria-valuetext={`Step ${currentIdx + 1} of ${STEP_ORDER.length} · ${STEP_LABELS[current]}`}
    >
      {STEP_ORDER.map((key, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <li
            key={key}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              isDone && "bg-success",
              isCurrent && !isDone && "bg-primary",
              !isCurrent && !isDone && "bg-muted",
            )}
            aria-current={isCurrent ? "step" : undefined}
          />
        );
      })}
    </ol>
  );
}

function OrgAndSiteStep({
  defaultOrgName,
  onSuccess,
}: {
  defaultOrgName: string | null;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ siteId: string }> | null,
    FormData
  >(bootstrapOrg, null);

  useEffect(() => {
    if (state?.ok && state.data?.siteId) {
      toast.success("Workspace created");
      onSuccess();
    }
    if (state && state.ok === false && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Organization</legend>
        <div className="space-y-1.5">
          <Label htmlFor="org_name" className="text-xs">Organization name</Label>
          <Input id="org_name" name="org_name" placeholder="Acme Safety"
                 defaultValue={defaultOrgName ?? ""} required
                 aria-invalid={!!fieldErr("org_name")} />
          {fieldErr("org_name") && <p className="text-xs text-destructive">{fieldErr("org_name")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry" className="text-xs">Industry</Label>
          <Select name="industry" required defaultValue="manufacturing">
            <SelectTrigger id="industry"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-5">
        <legend className="text-sm font-semibold">First site</legend>
        <div className="space-y-1.5">
          <Label htmlFor="site_name" className="text-xs">Site name</Label>
          <Input id="site_name" name="site_name" placeholder="Acme HQ" required
                 aria-invalid={!!fieldErr("site_name")} />
          {fieldErr("site_name") && <p className="text-xs text-destructive">{fieldErr("site_name")}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="country" className="text-xs">Country</Label>
            <Select name="country" required defaultValue="US">
              <SelectTrigger id="country"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States (OSHA)</SelectItem>
                <SelectItem value="GB">United Kingdom (HSE / RIDDOR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-xs">Time zone</Label>
            <Select name="timezone" required defaultValue="America/Chicago">
              <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_HINTS.map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Creating workspace…</>
        ) : (
          <>Next <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></>
        )}
      </Button>
    </form>
  );
}

function UseCasesStep() {
  const [selected, setSelected] = useState<Set<UseCaseKey>>(new Set());
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    finishOnboardingWithUseCases,
    null,
  );

  useEffect(() => {
    if (state && state.ok === false) toast.error(state.error);
  }, [state]);

  function toggle(k: UseCaseKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-base font-semibold">What will you mostly use this for?</h2>
        <p className="text-xs text-muted-foreground">
          Pick one or more — we&apos;ll tailor your Get Started checklist. You can change this later.
        </p>
      </div>

      <UseCaseTiles selected={selected} onToggle={toggle} />

      {Array.from(selected).map((k) => (
        <input key={k} type="hidden" name="use_cases" value={k} />
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setSelected(new Set(USE_CASE_KEYS))}
        >
          I&apos;m not sure yet — show me everything
        </button>
        <Button type="submit" disabled={pending} className="sm:min-w-[180px]">
          {pending ? "Taking you in…" : <>Take me in <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></>}
        </Button>
      </div>
    </form>
  );
}
