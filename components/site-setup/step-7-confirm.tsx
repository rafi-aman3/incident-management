"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { launchSite } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import type { NotificationKind } from "@/lib/site-setup/schemas";
import { StepFooter } from "./wizard-chrome";

type Summary = {
  name: string;
  country: "US" | "GB";
  timezone: string;
  address: string | null;
  regulator: "osha" | "hse" | "both" | null;
  osha_establishment_id: string | null;
  naics_code: string | null;
  hse_establishment_number: string | null;
  departmentCount: number;
  memberCount: number;
  recipientKindsConfigured: NotificationKind[];
  warnings: string[];
};

export function Step7Confirm({ summary }: { summary: Summary }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async () => launchSite(),
    null
  );

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Final review. After you launch, this site is live for incident reporting and the regulatory
        engine will run on every classification.
      </p>

      <ul className="space-y-2 rounded-md border p-4 text-sm">
        <Row label="Site name" value={summary.name} />
        <Row label="Country" value={summary.country === "US" ? "United States" : "United Kingdom"} />
        <Row label="Time zone" value={summary.timezone} />
        {summary.address && <Row label="Address" value={summary.address} />}
        <Row
          label="Regulator"
          value={
            summary.regulator === "osha" ? "OSHA" :
            summary.regulator === "hse"  ? "HSE / RIDDOR" :
            summary.regulator === "both" ? "Both" : "—"
          }
        />
        {summary.country === "US" && (
          <>
            <Row
              label="OSHA Establishment ID"
              value={summary.osha_establishment_id ?? "skipped"}
              warn={!summary.osha_establishment_id}
            />
            <Row
              label="NAICS code"
              value={summary.naics_code ?? "skipped"}
              warn={!summary.naics_code}
            />
          </>
        )}
        {summary.country === "GB" && (
          <Row
            label="HSE Establishment Number"
            value={summary.hse_establishment_number ?? "—"}
            warn={false}
          />
        )}
        <Row label="Departments" value={String(summary.departmentCount)} warn={summary.departmentCount === 0} />
        <Row label="Site members" value={String(summary.memberCount)} warn={summary.memberCount === 0} />
        <Row
          label="Notification kinds configured"
          value={`${summary.recipientKindsConfigured.length} of 8`}
        />
      </ul>

      {summary.warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" /> Heads-up before you launch
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {state?.ok === false && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <StepFooter prevHref="/admin/site-setup/6" isPending={isPending} primaryLabel="Launch site" />
    </form>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={warn ? "flex items-center gap-1 text-amber-700 dark:text-amber-300" : "flex items-center gap-1"}>
        {!warn && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
        {warn && <AlertCircle className="h-3.5 w-3.5" />}
        {value}
      </span>
    </li>
  );
}
