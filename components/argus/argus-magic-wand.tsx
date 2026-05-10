"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SuggestionCard } from "./suggestion-card";
import { useArgusWand, type WandRequest } from "./use-argus-wand";
import {
  acceptWandSuggestion,
  rejectWandSuggestion,
} from "@/app/(app)/argus-wand-actions";
import { computeSeverity, SEVERITY_LABELS } from "@/lib/workflow/severity";
import type { MatrixCoord } from "@/lib/workflow/severity";

const ACCENT = "var(--argus-accent, #00D4FF)";

const VERIFICATION_LABELS: Record<string, string> = {
  inspection: "Inspection",
  monitoring: "Monitoring",
  audit_trend: "Audit / trend",
  re_interview: "Re-interview",
  document_review: "Document review",
};

const VERDICT_LABELS = {
  reportable: "Reportable",
  not_reportable: "Not reportable",
  uncertain: "Uncertain",
} as const;

type OutcomeState = "pending" | "accepted" | "edited" | "rejected";

interface BaseProps {
  /** The wand surface — discriminator. */
  buttonLabel?: string;
  /** Called once on a successful Accept. The parent then fills the form
   *  field with the suggestion output. The wand component handles the
   *  outcome write itself. */
}

export type ArgusMagicWandProps = BaseProps &
  (
    | {
        surface: "risk_matrix";
        payload: {
          incidentId: string;
          description: string;
          type: string;
          area?: string;
        };
        onAccept: (out: {
          likelihood: MatrixCoord;
          consequence: MatrixCoord;
        }) => void;
      }
    | {
        surface: "finding_severity";
        payload: {
          findingId: string;
          siteId: string;
          description: string;
          hazardCategory?: string;
        };
        onAccept: (out: {
          likelihood: MatrixCoord;
          consequence: MatrixCoord;
        }) => void;
      }
    | {
        surface: "verification_method";
        payload: { capaId: string; siteId: string; capaSummary: string };
        onAccept: (out: { method: string }) => void;
      }
    | {
        surface: "reportability";
        payload: { incidentId: string; jurisdiction: "US" | "GB" };
        autoLoad?: boolean;
      }
    | {
        surface: "capa_metadata";
        payload: { investigationId: string; siteId: string };
        onAccept: (out: { type: string; title: string }) => void;
      }
  );

/**
 * Single reusable Argus magic-wand. Renders:
 *   - the "Suggest with Argus" button (idle)
 *   - a loading state (request in flight)
 *   - a SuggestionCard with surface-specific body (success)
 *   - an inline error (error)
 *   - a post-action outcome chip (after Accept / Edit / Reject)
 *
 * Reportability is read-only. If `autoLoad=true`, the wand fires the request
 * on mount instead of waiting for a click — used by the OSHA-300 / RIDDOR
 * panes to surface a verdict on first view.
 */
export function ArgusMagicWand(props: ArgusMagicWandProps) {
  const isReportability = props.surface === "reportability";
  const { state, request, reset } = useArgusWand<unknown>();
  const [outcome, setOutcome] = useState<OutcomeState>("pending");

  const triggerRequest = () => {
    setOutcome("pending");
    request(buildRequest(props));
  };

  // Auto-load on mount for the Reportability pane (and only when explicitly
  // enabled — gives caller control over the 50-incident OSHA-300 case).
  useEffect(() => {
    if (
      isReportability &&
      "autoLoad" in props &&
      props.autoLoad &&
      state.phase === "idle"
    ) {
      triggerRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReportability]);

  // Outcome chip
  if (outcome !== "pending") {
    return (
      <div className="space-y-2">
        <SuggestionCard
          title={titleFor(props.surface)}
          outcome={outcome === "rejected" ? "rejected" : outcome}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            reset();
            setOutcome("pending");
          }}
          className="text-xs"
        >
          <Sparkles className="size-3.5 mr-1" style={{ color: ACCENT }} />
          Ask again
        </Button>
      </div>
    );
  }

  // Idle — show the trigger button
  if (state.phase === "idle" && !isReportability) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={triggerRequest}
        className="gap-1.5"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 50%, transparent)`,
          color: `color-mix(in srgb, ${ACCENT} 70%, currentColor)`,
        }}
      >
        <Sparkles className="size-3.5" />
        {props.buttonLabel ?? "Suggest with Argus"}
      </Button>
    );
  }

  // Loading
  if (state.phase === "loading" || state.phase === "idle") {
    return (
      <div
        className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border"
        style={{
          borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${ACCENT} 5%, transparent)`,
        }}
      >
        <Loader2 className="size-3.5 animate-spin" style={{ color: ACCENT }} />
        <span className="text-muted-foreground">
          {isReportability
            ? "Argus is reviewing the incident…"
            : "Argus is thinking…"}
        </span>
      </div>
    );
  }

  // Error
  if (state.phase === "error") {
    return (
      <div className="space-y-1">
        <p className="text-xs text-destructive">{state.error}</p>
        <Button size="sm" variant="ghost" onClick={triggerRequest}>
          Try again
        </Button>
      </div>
    );
  }

  // Success — render the surface-specific body
  if (state.phase === "success") {
    if (state.insufficient) {
      return (
        <div
          className="rounded-md border-l-2 border-y border-r p-3 text-sm"
          style={{
            borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
            borderLeftColor: ACCENT,
            backgroundColor: `color-mix(in srgb, ${ACCENT} 5%, transparent)`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-4" style={{ color: ACCENT }} />
            <span className="font-medium">Argus needs more context</span>
          </div>
          <p className="text-muted-foreground text-xs">
            {readInsufficient(state.output) ??
              "Add more detail and try again."}
          </p>
        </div>
      );
    }

    return (
      <SurfaceBody
        props={props}
        suggestionId={state.suggestionId}
        output={state.output as Record<string, unknown>}
        modelUsed={state.modelUsed}
        cached={state.cached}
        onCommit={(committed) => {
          if (props.surface === "reportability") return;
          // Defensive — `onAccept` exists on every non-reportability variant.
          if ("onAccept" in props) {
            props.onAccept(committed as never);
          }
          void acceptWandSuggestion({
            suggestionId: state.suggestionId,
            edited: false,
          });
          setOutcome("accepted");
        }}
        onEdit={() => {
          // Just dismiss the card; outcome stays 'pending'. If the user later
          // picks a different value via the form, the underlying server
          // action won't track that diff — acceptable v1 trade-off.
          reset();
        }}
        onReject={() => {
          void rejectWandSuggestion({ suggestionId: state.suggestionId });
          setOutcome("rejected");
        }}
        onReassess={triggerRequest}
      />
    );
  }

  return null;
}

function buildRequest(props: ArgusMagicWandProps): WandRequest {
  switch (props.surface) {
    case "risk_matrix":
      return { surface: "risk_matrix", payload: props.payload };
    case "finding_severity":
      return { surface: "finding_severity", payload: props.payload };
    case "verification_method":
      return { surface: "verification_method", payload: props.payload };
    case "reportability":
      return { surface: "reportability", payload: props.payload };
    case "capa_metadata":
      return { surface: "capa_metadata", payload: props.payload };
  }
}

function titleFor(surface: ArgusMagicWandProps["surface"]): string {
  switch (surface) {
    case "risk_matrix":
      return "Argus risk-matrix suggestion";
    case "finding_severity":
      return "Argus severity suggestion";
    case "verification_method":
      return "Argus verification-method suggestion";
    case "reportability":
      return "Argus reportability assessment";
    case "capa_metadata":
      return "Argus CAPA draft";
  }
}

function readInsufficient(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const v = (output as Record<string, unknown>).insufficient_input;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

// ----- Surface-specific bodies -----

function SurfaceBody(args: {
  props: ArgusMagicWandProps;
  suggestionId: string;
  output: Record<string, unknown>;
  modelUsed: string;
  cached: boolean;
  onCommit: (out: unknown) => void;
  onEdit: () => void;
  onReject: () => void;
  onReassess: () => void;
}) {
  const { props, output } = args;

  if (props.surface === "risk_matrix" || props.surface === "finding_severity") {
    const l = output.likelihood as MatrixCoord;
    const c = output.consequence as MatrixCoord;
    const sev = computeSeverity({ likelihood: l, consequence: c });
    return (
      <SuggestionCard
        title={titleFor(props.surface)}
        confidence={output.confidence as number}
        rationale={output.rationale as string}
        modelUsed={args.modelUsed}
        cached={args.cached}
        onAccept={() => args.onCommit({ likelihood: l, consequence: c })}
        onEdit={args.onEdit}
        onReject={args.onReject}
      >
        <div className="flex flex-wrap gap-3 text-sm">
          <Stat label="Likelihood" value={String(l)} />
          <Stat label="Consequence" value={String(c)} />
          <Stat
            label="Severity"
            value={`${sev} — ${SEVERITY_LABELS[sev]}`}
            emphasis
          />
        </div>
      </SuggestionCard>
    );
  }

  if (props.surface === "verification_method") {
    const method = String(output.method);
    return (
      <SuggestionCard
        title={titleFor(props.surface)}
        confidence={output.confidence as number}
        rationale={output.rationale as string}
        modelUsed={args.modelUsed}
        cached={args.cached}
        onAccept={() => args.onCommit({ method })}
        onEdit={args.onEdit}
        onReject={args.onReject}
      >
        <Stat
          label="Method"
          value={VERIFICATION_LABELS[method] ?? method}
          emphasis
        />
      </SuggestionCard>
    );
  }

  if (props.surface === "capa_metadata") {
    const type = String(output.type);
    const title = String(output.title);
    const owner = output.suggested_owner_role
      ? String(output.suggested_owner_role)
      : null;
    return (
      <SuggestionCard
        title={titleFor(props.surface)}
        confidence={output.confidence as number}
        rationale={output.rationale as string}
        modelUsed={args.modelUsed}
        cached={args.cached}
        onAccept={() => args.onCommit({ type, title })}
        onEdit={args.onEdit}
        onReject={args.onReject}
      >
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Stat label="Type" value={type} emphasis />
            {owner && <Stat label="Owner role" value={owner} />}
          </div>
          <div className="font-medium">{title}</div>
        </div>
      </SuggestionCard>
    );
  }

  if (props.surface === "reportability") {
    const verdict = String(output.verdict) as keyof typeof VERDICT_LABELS;
    const citation = String(output.citation);
    const thresholds = (output.threshold_met as string[] | undefined) ?? [];
    return (
      <SuggestionCard
        title={titleFor(props.surface)}
        confidence={output.confidence as number}
        rationale={output.rationale as string}
        modelUsed={args.modelUsed}
        cached={args.cached}
        readOnly
        onReassess={args.onReassess}
      >
        <div className="space-y-1.5 text-sm">
          <Stat
            label="Verdict"
            value={VERDICT_LABELS[verdict] ?? verdict}
            emphasis
          />
          <p className="text-xs text-muted-foreground italic">
            Cited: {citation}
          </p>
          {thresholds.length > 0 && (
            <ul className="text-xs space-y-0.5 mt-1">
              {thresholds.map((t, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">✓ </span>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SuggestionCard>
    );
  }

  return null;
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="inline-flex items-baseline gap-1.5 text-sm">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className={emphasis ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
