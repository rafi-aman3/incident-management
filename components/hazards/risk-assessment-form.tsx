"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRiskAssessment } from "@/lib/actions/hazards";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskMatrixHazard } from "@/components/risk-matrix/risk-matrix-hazard";
import { computeRisk } from "@/lib/risk/matrix";
import type { Likelihood, Consequence } from "@/lib/risk/types";
import { RiskBadge } from "./risk-badges";

const TRIGGERS = [
  { value: "initial", label: "Initial assessment" },
  { value: "periodic_review", label: "Periodic review" },
  { value: "post_incident", label: "Post-incident" },
  { value: "management_of_change", label: "Management of change" },
  { value: "regulatory_change", label: "Regulatory change" },
  { value: "worker_consultation", label: "Worker consultation" },
  { value: "audit_finding", label: "Audit finding" },
  { value: "sds_revision", label: "SDS revision" },
] as const;

export function RiskAssessmentForm({
  hazardId,
  defaultTrigger,
}: {
  hazardId: string;
  defaultTrigger?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [likelihood, setLikelihood] = useState<Likelihood | null>(null);
  const [consequence, setConsequence] = useState<Consequence | null>(null);
  const [trigger, setTrigger] = useState<string>(defaultTrigger ?? "initial");
  const [rationale, setRationale] = useState("");
  const [nextReview, setNextReview] = useState("");

  const inherent = likelihood && consequence ? computeRisk(likelihood, consequence) : null;

  function onSubmit() {
    setError(null);
    if (!likelihood || !consequence) {
      setError("Pick a likelihood × consequence cell.");
      return;
    }
    startTransition(async () => {
      const result = await createRiskAssessment(hazardId, {
        likelihood,
        consequence,
        trigger_type: trigger as (typeof TRIGGERS)[number]["value"],
        rationale: rationale || null,
        consulted_worker_ids: [],
        next_review_at: nextReview || null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Assessment saved — inherent ${result.data?.inherent}, residual ${result.data?.residual}`);
      router.refresh();
      setLikelihood(null);
      setConsequence(null);
      setRationale("");
      setNextReview("");
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">New risk assessment</h3>
        {inherent && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Inherent:</span>
            <RiskBadge score={inherent} />
          </div>
        )}
      </div>

      <RiskMatrixHazard
        value={{ likelihood, consequence }}
        onChange={(v) => {
          setLikelihood(v.likelihood);
          setConsequence(v.consequence);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="trigger">Trigger</Label>
          <Select value={trigger} onValueChange={setTrigger}>
            <SelectTrigger id="trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="next_review">Next review (optional)</Label>
          <Input
            id="next_review"
            type="date"
            value={nextReview}
            onChange={(e) => setNextReview(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="rationale">Rationale (optional)</Label>
        <Textarea
          id="rationale"
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="What changed since the last assessment? Which workers were consulted?"
        />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={pending || !likelihood || !consequence}>
          {pending ? "Saving…" : "Save assessment"}
        </Button>
      </div>
    </div>
  );
}
