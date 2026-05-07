"use client";

import { useActionState, useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, Clock, RefreshCcw, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";
import { verifyCapa } from "@/app/(app)/capa/[id]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

type Result =
  | "effective"
  | "partially_effective"
  | "not_effective"
  | "too_early_to_verify";

const RESULT_OPTIONS: Array<{
  value: Result;
  label: string;
  hint: string;
  icon: typeof ShieldCheck;
}> = [
  {
    value: "effective",
    label: "Effective",
    hint: "Action worked. CAPA closes.",
    icon: ShieldCheck,
  },
  {
    value: "partially_effective",
    label: "Partially effective",
    hint: "Helped but residual risk remains. CAPA closes; a follow-up CAPA is auto-created.",
    icon: ChevronRight,
  },
  {
    value: "not_effective",
    label: "Not effective",
    hint: "Did not solve the problem. CAPA reverts to In Progress; rejection reason required.",
    icon: AlertTriangle,
  },
  {
    value: "too_early_to_verify",
    label: "Too early to verify",
    hint: "Implementation needs more time. Pick a re-verification date.",
    icon: Clock,
  },
];

const METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "inspection", label: "Inspection" },
  { value: "monitoring", label: "Monitoring" },
  { value: "audit_trend", label: "Audit trend" },
  { value: "re_interview", label: "Re-interview" },
  { value: "document_review", label: "Document review" },
];

/**
 * Visible only when status='pending_verification' AND viewer ≠ owner.
 * The page-level render already guards on this; the form is also hidden
 * (not just disabled) per the "critical UX rule" in plan §C2.
 *
 * Note on layering: the verifyCapa server action AND the verify_capa_v1
 * RPC both re-check owner ≠ verifier. The DB CHECK constraint on capas
 * is the final defense if a row write somehow bypasses the RPC.
 */
export function VerificationForm({
  capaId,
  ownerName,
}: {
  capaId: string;
  /** Used in the partial-effective pre-submit info card. */
  ownerName: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    verifyCapa,
    null
  );
  const [result, setResult] = useState<Result | "">("");

  useEffect(() => {
    if (state?.ok) {
      toast.success("Verification submitted");
    } else if (state?.ok === false) {
      toast.error(state.error);
    }
  }, [state]);

  const isReject = result === "not_effective";
  const isDeferred = result === "too_early_to_verify";

  return (
    <TooltipProvider>
      <form
        action={formAction}
        className="space-y-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-4"
      >
      <input type="hidden" name="capa_id" value={capaId} />

      <div className="flex items-center gap-2">
        <RefreshCcw className="h-4 w-4 text-primary" />
        <h2 className="flex items-center text-base font-semibold">
          Verify CAPA closure
          <InfoTooltip tip="capa_verifier_independence" />
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        You&apos;re the independent verifier. Pick how you verified, then the
        outcome. The owner can&apos;t see this form — only people other than the
        owner can submit verifications.
      </p>

      <div className="space-y-2">
        <Label htmlFor="verify-method">Verification method</Label>
        <Select name="method" required>
          <SelectTrigger id="verify-method">
            <SelectValue placeholder="How did you verify?" />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Outcome</Label>
        <RadioGroup
          name="result"
          value={result}
          onValueChange={(v) => setResult(v as Result)}
          className="space-y-1.5"
        >
          {RESULT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = result === opt.value;
            return (
              <Label
                key={opt.value}
                htmlFor={`result-${opt.value}`}
                className={cn(
                  "flex items-start gap-2 rounded-md border bg-background p-2.5 transition-colors hover:border-primary",
                  active && "border-primary bg-primary/10"
                )}
              >
                <RadioGroupItem
                  id={`result-${opt.value}`}
                  value={opt.value}
                  className="mt-0.5"
                  aria-describedby={`result-${opt.value}-desc`}
                />
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">
                    {opt.label}
                    {opt.value === "partially_effective" && (
                      <InfoTooltip tip="capa_partial_effective" />
                    )}
                  </span>
                  <p
                    id={`result-${opt.value}-desc`}
                    className="text-[11px] text-muted-foreground"
                  >
                    {opt.hint}
                  </p>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verify-notes">
          {isReject ? "Rejection reason" : "Notes"}
          {isReject && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <Textarea
          id="verify-notes"
          name="notes"
          rows={4}
          maxLength={5000}
          required={isReject}
          placeholder={
            isReject
              ? "Required: explain why the action did not work, so the owner can iterate."
              : "Optional: any context for the audit trail."
          }
        />
      </div>

      {isDeferred && (
        <div className="space-y-2">
          <Label htmlFor="verify-reverify">Re-verify on</Label>
          <Input
            id="verify-reverify"
            name="re_verify_at"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
          />
          <p className="text-[11px] text-muted-foreground">
            CAPA stays in Pending Verification; system will surface it again on this date.
          </p>
        </div>
      )}

      {result === "partially_effective" && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          <p>
            Submitting this verification will <strong>create a follow-up CAPA</strong>{" "}
            assigned back to <strong>{ownerName}</strong>. You&apos;ll be able to
            edit its title, due date, and details after the verification completes.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={!result || isPending}>
          {isPending ? "Submitting…" : "Submit verification"}
        </Button>
      </div>
      </form>
    </TooltipProvider>
  );
}
