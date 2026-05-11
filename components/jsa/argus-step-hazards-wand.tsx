"use client";

/**
 * Phase 15 magic-wand: suggest JSA step-hazards.
 *
 * Mounted inside the Step-3 wizard for each step. Acceptance requires an
 * explicit "I've reviewed these" checkbox — stricter than the §HZ controls
 * wand because workers act on JSA contents and incorrect hazard inference
 * has cascading effects.
 */

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArgusWand } from "@/components/argus/use-argus-wand";
import {
  acceptWandSuggestion,
  rejectWandSuggestion,
} from "@/app/(app)/argus-wand-actions";
import type {
  Likelihood,
  Consequence,
  HazardCategory,
} from "@/lib/risk/types";

const ACCENT = "var(--argus-accent, #00D4FF)";

type WandOutput = {
  hazards: Array<{
    hazard_description: string;
    hazard_category: HazardCategory;
    likelihood: Likelihood;
    consequence: Consequence;
    rationale: string;
  }>;
  confidence: number;
  rationale: string;
  insufficient_input?: string;
};

export type StepHazardSuggestion = {
  hazard_description: string;
  hazard_category: HazardCategory;
  likelihood: Likelihood;
  consequence: Consequence;
};

export function ArgusStepHazardsWand({
  siteId,
  jsaId,
  jobTitle,
  jobDescription,
  area,
  stepDescription,
  onAccept,
}: {
  siteId: string;
  jsaId: string;
  jobTitle: string;
  jobDescription?: string | null;
  area?: string | null;
  stepDescription: string;
  onAccept: (hazards: StepHazardSuggestion[]) => void;
}) {
  const { state, request, reset } = useArgusWand<WandOutput>();
  const [outcome, setOutcome] = useState<"pending" | "accepted" | "rejected">("pending");
  const [reviewed, setReviewed] = useState(false);

  function trigger() {
    setOutcome("pending");
    setReviewed(false);
    request({
      surface: "step_hazards",
      payload: {
        siteId,
        jsaId,
        jobTitle,
        jobDescription: jobDescription ?? undefined,
        area: area ?? undefined,
        stepDescription,
      },
    });
  }

  if (outcome === "accepted") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Sparkles className="size-3.5" style={{ color: ACCENT }} />
        <span className="text-muted-foreground">Hazards appended. Edit before saving.</span>
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
        disabled={!stepDescription || stepDescription.trim().length < 6}
        className="gap-1.5"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 50%, transparent)`,
          color: `color-mix(in srgb, ${ACCENT} 70%, currentColor)`,
        }}
      >
        <Sparkles className="size-3.5" /> Suggest hazards
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
        <span className="text-muted-foreground">Argus is suggesting hazards…</span>
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
          {state.output.insufficient_input ?? "Add more detail to the step and try again."}
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
          <span className="font-medium">Argus suggests {out.hazards.length} hazards</span>
        </div>
        <span className="text-xs text-muted-foreground">Confidence {(out.confidence * 100).toFixed(0)}%</span>
      </div>

      <ul className="space-y-2">
        {out.hazards.map((h, i) => (
          <li key={i} className="rounded-md border bg-background p-2">
            <p className="text-sm font-medium">{h.hazard_description}</p>
            <p className="text-xs text-muted-foreground">
              {h.hazard_category} · {h.likelihood} × {h.consequence}
            </p>
            <p className="mt-1 text-xs text-muted-foreground italic">{h.rationale}</p>
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
          I've reviewed these suggestions and confirm they're appropriate for the work being performed.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!reviewed}
          onClick={() => {
            onAccept(
              out.hazards.map((h) => ({
                hazard_description: h.hazard_description,
                hazard_category: h.hazard_category,
                likelihood: h.likelihood,
                consequence: h.consequence,
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
