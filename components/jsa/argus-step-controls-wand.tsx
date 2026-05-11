"use client";

/**
 * Phase 15 magic-wand: suggest JSA step-controls for a single hazard.
 *
 * Strictest of the wand suite — workers act on these recommendations and
 * PPE-only outputs require the EHS author to add an engineering / admin
 * control before saving. Acceptance gated on an explicit review checkbox.
 */

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArgusWand } from "@/components/argus/use-argus-wand";
import {
  acceptWandSuggestion,
  rejectWandSuggestion,
} from "@/app/(app)/argus-wand-actions";
import { CONTROL_LEVEL_LABELS } from "@/lib/risk/matrix";
import type { ControlLevel, Likelihood, Consequence } from "@/lib/risk/types";

const ACCENT = "var(--argus-accent, #00D4FF)";

type WandOutput = {
  controls: Array<{
    control_level: ControlLevel;
    control_description: string;
    rationale: string;
  }>;
  ppe_only_warning?: boolean;
  confidence: number;
  rationale: string;
  insufficient_input?: string;
};

export type StepControlSuggestion = {
  control_level: ControlLevel;
  control_description: string;
};

export function ArgusStepControlsWand({
  siteId,
  jsaId,
  jobTitle,
  area,
  stepDescription,
  hazardDescription,
  hazardCategory,
  likelihood,
  consequence,
  onAccept,
}: {
  siteId: string;
  jsaId: string;
  jobTitle: string;
  area?: string | null;
  stepDescription: string;
  hazardDescription: string;
  hazardCategory: string;
  likelihood: Likelihood;
  consequence: Consequence;
  onAccept: (controls: StepControlSuggestion[]) => void;
}) {
  const { state, request, reset } = useArgusWand<WandOutput>();
  const [outcome, setOutcome] = useState<"pending" | "accepted" | "rejected">("pending");
  const [reviewed, setReviewed] = useState(false);

  function trigger() {
    setOutcome("pending");
    setReviewed(false);
    request({
      surface: "step_controls",
      payload: {
        siteId,
        jsaId,
        jobTitle,
        area: area ?? undefined,
        stepDescription,
        hazardDescription,
        hazardCategory,
        likelihood,
        consequence,
      },
    });
  }

  if (outcome === "accepted") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Sparkles className="size-3.5" style={{ color: ACCENT }} />
        <span className="text-muted-foreground">Controls appended. Edit before saving.</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => { reset(); setOutcome("pending"); }}>
          Ask again
        </Button>
      </div>
    );
  }

  if (state.phase === "idle") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={trigger}
        disabled={!hazardDescription || hazardDescription.trim().length < 8}
        className="gap-1.5"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 50%, transparent)`,
          color: `color-mix(in srgb, ${ACCENT} 70%, currentColor)`,
        }}
      >
        <Sparkles className="size-3.5" /> Suggest controls
      </Button>
    );
  }

  if (state.phase === "loading") {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${ACCENT} 5%, transparent)`,
        }}
      >
        <Loader2 className="size-3.5 animate-spin" style={{ color: ACCENT }} />
        <span className="text-muted-foreground">Argus is suggesting controls…</span>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="space-y-1">
        <p className="text-xs text-destructive">{state.error}</p>
        <Button size="sm" variant="ghost" onClick={trigger}>Try again</Button>
      </div>
    );
  }

  if (state.insufficient) {
    return (
      <div
        className="rounded-md border-l-2 border-y border-r p-3 text-sm"
        style={{ borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`, borderLeftColor: ACCENT }}
      >
        <p className="text-xs text-muted-foreground">
          {state.output.insufficient_input ?? "Add more detail to the hazard and try again."}
        </p>
        <Button size="sm" variant="ghost" onClick={trigger} className="mt-2 text-xs">Try again</Button>
      </div>
    );
  }

  const out = state.output;
  const suggestionId = state.suggestionId;

  return (
    <div
      className="space-y-3 rounded-md border-l-2 border-y border-r p-3 text-sm"
      style={{ borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`, borderLeftColor: ACCENT }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" style={{ color: ACCENT }} />
          <span className="font-medium">Argus suggests {out.controls.length} controls</span>
        </div>
        <span className="text-xs text-muted-foreground">Confidence {(out.confidence * 100).toFixed(0)}%</span>
      </div>

      {out.ppe_only_warning && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span>
            Argus flagged this as PPE-only feasible. PPE alone for this hazard category will trigger an ISO 45001 §8.1.2 auditor flag — add an engineering or administrative control before approving.
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {out.controls.map((c, i) => (
          <li key={i} className="rounded-md border bg-background p-2">
            <p className="text-xs font-medium">{CONTROL_LEVEL_LABELS[c.control_level]}</p>
            <p className="mt-1 text-sm">{c.control_description}</p>
            <p className="mt-1 text-xs text-muted-foreground italic">{c.rationale}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">{out.rationale}</p>

      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I've reviewed these controls — including PPE specifics — and confirm they're implementable and appropriate for this step.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!reviewed}
          onClick={() => {
            onAccept(
              out.controls.map((c) => ({
                control_level: c.control_level,
                control_description: c.control_description,
              })),
            );
            void acceptWandSuggestion({ suggestionId, edited: false });
            setOutcome("accepted");
          }}
        >
          Append all
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void rejectWandSuggestion({ suggestionId });
            setOutcome("rejected");
            reset();
          }}
        >
          Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={trigger}>Re-ask</Button>
      </div>
    </div>
  );
}
