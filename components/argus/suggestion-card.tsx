"use client";

import type { ReactNode } from "react";
import { Sparkles, Check, Pencil, X, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCENT = "var(--argus-accent, #00D4FF)";

/**
 * Visual card that wraps an Argus suggestion. Two variants:
 *   - actionable (default): renders Accept / Edit / Reject controls.
 *   - readOnly: drops the action row; used by the Reportability pane.
 *
 * The card is always cyan-accented (left border + faint tint) so it reads
 * as "Argus speaking" without being mistaken for a destructive surface.
 *
 * Children render the suggestion-specific body — a matrix coord, a method
 * pill, a verdict block, etc.
 */
export interface SuggestionCardProps {
  title: string;
  confidence?: number;
  rationale?: string;
  modelUsed?: string;
  cached?: boolean;
  readOnly?: boolean;
  onAccept?: () => void;
  onEdit?: () => void;
  onReject?: () => void;
  onReassess?: () => void;
  acceptLabel?: string;
  children?: ReactNode;
  /** Render in a "post-action" pill state (e.g. "Argus suggested S2 (accepted)"). */
  outcome?: "accepted" | "edited" | "rejected" | null;
}

export function SuggestionCard(props: SuggestionCardProps) {
  if (props.outcome) {
    return <OutcomeChip outcome={props.outcome} title={props.title} />;
  }

  return (
    <div
      className="rounded-md border-l-2 border-y border-r p-3 text-sm"
      style={{
        borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
        borderLeftColor: ACCENT,
        backgroundColor: `color-mix(in srgb, ${ACCENT} 5%, transparent)`,
      }}
      role="region"
      aria-label="Argus suggestion"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="size-4" style={{ color: ACCENT }} />
        <div className="font-medium flex-1">{props.title}</div>
        {typeof props.confidence === "number" && (
          <ConfidenceBadge confidence={props.confidence} />
        )}
        {props.cached && (
          <span
            className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
            title="Cached from a previous assessment within the last 24h"
          >
            cached
          </span>
        )}
      </div>

      {props.children && <div className="mb-2">{props.children}</div>}

      {props.rationale && (
        <p className="text-muted-foreground mb-2 leading-relaxed">
          {props.rationale}
        </p>
      )}

      {props.modelUsed && (
        <p className="text-xs text-muted-foreground/70 mb-2 flex items-center gap-1">
          <Info className="size-3" />
          {props.modelUsed}
        </p>
      )}

      {!props.readOnly && (
        <div className="flex flex-wrap gap-2">
          {props.onAccept && (
            <Button
              size="sm"
              variant="default"
              onClick={props.onAccept}
              style={{ backgroundColor: ACCENT, color: "#001520" }}
              className="hover:opacity-90"
            >
              <Check className="size-3.5 mr-1" />
              {props.acceptLabel ?? "Accept"}
            </Button>
          )}
          {props.onEdit && (
            <Button size="sm" variant="outline" onClick={props.onEdit}>
              <Pencil className="size-3.5 mr-1" />
              Edit
            </Button>
          )}
          {props.onReject && (
            <Button size="sm" variant="ghost" onClick={props.onReject}>
              <X className="size-3.5 mr-1" />
              Reject
            </Button>
          )}
          {props.onReassess && (
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onReassess}
              className="ml-auto text-xs"
            >
              <RotateCcw className="size-3.5 mr-1" />
              Re-assess
            </Button>
          )}
        </div>
      )}
      {props.readOnly && props.onReassess && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={props.onReassess}
            className="text-xs"
          >
            <RotateCcw className="size-3.5 mr-1" />
            Re-assess
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-mono tabular-nums"
      style={{
        backgroundColor: `color-mix(in srgb, ${ACCENT} 12%, transparent)`,
        color: `color-mix(in srgb, ${ACCENT} 60%, currentColor)`,
      }}
      aria-label={`Argus confidence ${pct}%`}
    >
      {pct}%
    </span>
  );
}

function OutcomeChip({
  outcome,
  title,
}: {
  outcome: "accepted" | "edited" | "rejected";
  title: string;
}) {
  const tone =
    outcome === "rejected"
      ? "text-muted-foreground"
      : outcome === "edited"
        ? ""
        : "";
  const icon =
    outcome === "rejected" ? (
      <X className="size-3.5" />
    ) : (
      <Check className="size-3.5" />
    );
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${tone}`}
      style={{
        backgroundColor:
          outcome === "rejected"
            ? undefined
            : `color-mix(in srgb, ${ACCENT} 8%, transparent)`,
        border:
          outcome === "rejected"
            ? "1px dashed color-mix(in srgb, currentColor 30%, transparent)"
            : `1px solid color-mix(in srgb, ${ACCENT} 25%, transparent)`,
      }}
    >
      <Sparkles className="size-3" style={{ color: ACCENT }} />
      <span className="text-muted-foreground">{title}</span>
      <span className="font-medium">·</span>
      <span className="inline-flex items-center gap-0.5">{icon} {outcome}</span>
    </div>
  );
}
