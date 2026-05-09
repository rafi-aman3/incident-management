"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  bootstrapOrg,
  finishOnboarding,
  inviteOnOnboarding,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/incidents/schemas";
import { cn } from "@/lib/utils";

type StepKey = "org" | "invite" | "done";

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

const STEP_LABELS: Record<StepKey, string> = {
  org: "Organization",
  invite: "Invite teammates",
  done: "All set",
};

const STEP_ORDER: StepKey[] = ["org", "invite", "done"];

export function OnboardingWizard({
  email,
  fullName,
  initialStep,
  siteId,
}: {
  email: string;
  fullName: string;
  initialStep: StepKey;
  siteId: string | null;
}) {
  const [step, setStep] = useState<StepKey>(initialStep);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(siteId);

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}
        </p>
        <h1 className="text-2xl font-semibold">Set up your workspace</h1>
        <p className="text-sm text-muted-foreground">
          Two quick steps and you&apos;re ready to start logging safety events.
        </p>
      </header>

      <ProgressBar current={step} />

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {step === "org" ? (
          <OrgAndSiteStep
            onSuccess={(newSiteId) => {
              setActiveSiteId(newSiteId);
              setStep("invite");
            }}
          />
        ) : null}
        {step === "invite" && activeSiteId ? (
          <InviteStep
            siteId={activeSiteId}
            onAdvance={() => setStep("done")}
          />
        ) : null}
        {step === "done" ? <DoneStep /> : null}
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
              isCurrent && !isDone && "bg-brand",
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
  onSuccess,
}: {
  onSuccess: (siteId: string) => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ siteId: string }> | null,
    FormData
  >(bootstrapOrg, null);

  useEffect(() => {
    if (state?.ok && state.data?.siteId) {
      toast.success("Workspace created");
      onSuccess(state.data.siteId);
    }
    if (state && state.ok === false && !state.fieldErrors)
      toast.error(state.error);
  }, [state, onSuccess]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Organization</legend>

        <div className="space-y-1.5">
          <Label htmlFor="org_name" className="text-xs">
            Organization name
          </Label>
          <Input
            id="org_name"
            name="org_name"
            placeholder="Acme Safety"
            required
            aria-invalid={!!fieldErr("org_name")}
            aria-describedby={fieldErr("org_name") ? "org_name_err" : undefined}
          />
          {fieldErr("org_name") && (
            <p id="org_name_err" className="text-xs text-destructive">
              {fieldErr("org_name")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="industry" className="text-xs">
            Industry
          </Label>
          <Select name="industry" required defaultValue="manufacturing">
            <SelectTrigger id="industry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErr("industry") && (
            <p className="text-xs text-destructive">{fieldErr("industry")}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Drives which template presets show up in your library.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-5">
        <legend className="text-sm font-semibold">First site</legend>

        <div className="space-y-1.5">
          <Label htmlFor="site_name" className="text-xs">
            Site name
          </Label>
          <Input
            id="site_name"
            name="site_name"
            placeholder="Acme HQ"
            required
            aria-invalid={!!fieldErr("site_name")}
            aria-describedby={
              fieldErr("site_name") ? "site_name_err" : undefined
            }
          />
          {fieldErr("site_name") && (
            <p id="site_name_err" className="text-xs text-destructive">
              {fieldErr("site_name")}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="country" className="text-xs">
              Country
            </Label>
            <Select name="country" required defaultValue="US">
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States (OSHA)</SelectItem>
                <SelectItem value="GB">United Kingdom (HSE / RIDDOR)</SelectItem>
              </SelectContent>
            </Select>
            {fieldErr("country") && (
              <p className="text-xs text-destructive">{fieldErr("country")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-xs">
              Time zone
            </Label>
            <Select name="timezone" required defaultValue="America/Chicago">
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_HINTS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErr("timezone") && (
              <p className="text-xs text-destructive">{fieldErr("timezone")}</p>
            )}
          </div>
        </div>
      </fieldset>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            Creating workspace…
          </>
        ) : (
          <>
            Create my workspace
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}

function InviteStep({
  siteId,
  onAdvance,
}: {
  siteId: string;
  onAdvance: () => void;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState<
    ActionResult<{ sent: number; failed: string[] }> | null,
    FormData
  >(inviteOnOnboarding, null);

  useEffect(() => {
    if (inviteState?.ok) {
      const sent = inviteState.data?.sent ?? 0;
      const failed = inviteState.data?.failed ?? [];
      if (sent > 0) toast.success(`${sent} invite${sent === 1 ? "" : "s"} sent`);
      for (const msg of failed) toast.error(msg);
      onAdvance();
    }
    if (inviteState && inviteState.ok === false && !inviteState.fieldErrors)
      toast.error(inviteState.error);
  }, [inviteState, onAdvance]);

  return (
    <form action={inviteAction} className="space-y-4">
      <input type="hidden" name="site_id" value={siteId} />
      <div>
        <h2 className="text-sm font-semibold">Invite teammates (optional)</h2>
        <p className="text-xs text-muted-foreground">
          Up to 5 emails — one per line, or comma-separated. They&apos;ll
          land at the worker role on this site. You can change roles
          later from Admin → Members.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="emails" className="text-xs">
          Email addresses
        </Label>
        <Textarea
          id="emails"
          name="emails"
          rows={3}
          placeholder={"alice@example.com\nbob@example.com"}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={invitePending} className="flex-1">
          {invitePending ? "Sending…" : "Send invites & continue"}
        </Button>
        <SkipButton siteId={siteId} />
      </div>
    </form>
  );
}

function SkipButton({ siteId }: { siteId: string }) {
  return (
    <form action={finishOnboarding}>
      <input type="hidden" name="site_id" value={siteId} />
      <Button type="submit" variant="outline">
        Skip for now
      </Button>
    </form>
  );
}

function DoneStep() {
  return (
    <form
      action={finishOnboarding}
      className="flex flex-col items-center gap-4 py-4 text-center"
    >
      <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">You&apos;re all set</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace is ready. Head to your dashboard to log your first
          incident or run an inspection.
        </p>
      </div>
      <Button type="submit" className="w-full">
        Go to dashboard
      </Button>
    </form>
  );
}
