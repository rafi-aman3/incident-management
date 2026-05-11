"use client";

/**
 * Phase 14 magic-wand: suggest hazard controls.
 *
 * Standalone (not wired into the generic ArgusMagicWand because the output
 * shape is an array, not a single suggestion). Uses the shared
 * `useArgusWand` hook + acceptWandSuggestion / rejectWandSuggestion actions
 * for outcome logging.
 */

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArgusWand } from "@/components/argus/use-argus-wand";
import {
  acceptWandSuggestion,
  rejectWandSuggestion,
} from "@/app/(app)/argus-wand-actions";
import { ControlLevelBadge } from "./risk-badges";
import type { ControlLevel } from "@/lib/risk/types";

const ACCENT = "var(--argus-accent, #00D4FF)";

type WandOutput = {
  controls: Array<{ level: ControlLevel; description: string; rationale: string }>;
  ppe_only_warning?: boolean;
  confidence: number;
  rationale: string;
  insufficient_input?: string;
};

export function ArgusHazardControlsWand({
  siteId,
  candidateId,
  hazardId,
  title,
  category,
  description,
  proposedMetadata,
  onAccept,
}: {
  siteId: string;
  candidateId?: string;
  hazardId?: string;
  title: string;
  category: string;
  description?: string;
  proposedMetadata?: Record<string, unknown> | null;
  /** Called once when the user accepts the suggestion (all or edited). */
  onAccept: (controls: Array<{ level: ControlLevel; description: string }>) => void;
}) {
  const { state, request, reset } = useArgusWand<WandOutput>();
  const [outcome, setOutcome] = useState<"pending" | "accepted" | "rejected">("pending");

  function trigger() {
    setOutcome("pending");
    request({
      surface: "hazard_controls",
      payload: {
        siteId,
        candidateId,
        hazardId,
        title,
        category,
        description,
        proposedMetadata: proposedMetadata ?? undefined,
      },
    });
  }

  if (outcome === "accepted") {
    return (
      <div
        className="flex items-center gap-2 rounded-md border-l-2 border-y border-r p-2 text-xs"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
          borderLeftColor: ACCENT,
        }}
      >
        <Sparkles className="size-3.5" style={{ color: ACCENT }} />
        <span>Suggestions applied. Edit them above before saving.</span>
        <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => { reset(); setOutcome("pending"); }}>
          Ask again
        </Button>
      </div>
    );
  }

  if (outcome === "rejected") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Rejected.</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { reset(); setOutcome("pending"); }}>
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
        disabled={!title || !category}
        className="gap-1.5"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 50%, transparent)`,
          color: `color-mix(in srgb, ${ACCENT} 70%, currentColor)`,
        }}
      >
        <Sparkles className="size-3.5" />
        Suggest controls with Argus
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

  // Success
  if (state.insufficient) {
    return (
      <div
        className="rounded-md border-l-2 border-y border-r p-3 text-sm"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
          borderLeftColor: ACCENT,
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="size-4" style={{ color: ACCENT }} />
          <span className="font-medium">Argus needs more context</span>
        </div>
        <p className="text-xs text-muted-foreground">{state.output.insufficient_input ?? "Add more detail and try again."}</p>
        <Button size="sm" variant="ghost" onClick={trigger} className="mt-2 text-xs">Try again</Button>
      </div>
    );
  }

  const out = state.output;
  const suggestionId = state.suggestionId;

  return (
    <div
      className="space-y-3 rounded-md border-l-2 border-y border-r p-3 text-sm"
      style={{
        borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
        borderLeftColor: ACCENT,
      }}
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
          <span>Argus flagged this as PPE-only feasible. Adding an engineering or administrative control would avoid the auditor warning tile.</span>
        </div>
      )}

      <ul className="space-y-2">
        {out.controls.map((c, i) => (
          <li key={i} className="rounded-md border bg-background p-2">
            <div className="flex items-center justify-between">
              <ControlLevelBadge level={c.level} />
            </div>
            <p className="mt-1 text-sm">{c.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.rationale}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">{out.rationale}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            onAccept(out.controls.map((c) => ({ level: c.level, description: c.description })));
            void acceptWandSuggestion({ suggestionId, edited: false });
            setOutcome("accepted");
          }}
        >
          Use these controls
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void rejectWandSuggestion({ suggestionId });
            setOutcome("rejected");
          }}
        >
          Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={trigger}>Re-ask</Button>
      </div>
    </div>
  );
}
