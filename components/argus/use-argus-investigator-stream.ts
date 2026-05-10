"use client";

import { useCallback, useState } from "react";
import type { InvestigationDraftPayload } from "@/lib/argus/tools";

/**
 * Client-side SSE consumer for `POST /api/argus/investigator`. The route
 * emits a small set of frames; we parse them and surface a flat state shape
 * for `<ArgusInvestigator>`:
 *
 *   phase = "idle" → user can press Generate
 *         | "reading" → request sent, awaiting first byte
 *         | "streaming" → model is producing output
 *         | "done" → draft + suggestionId in state
 *         | "error" → error message in state
 */

export type InvestigatorPhase = "idle" | "reading" | "streaming" | "done" | "error";

export interface InvestigatorWitnessAdd {
  name: string;
  contact?: string;
  statement: string;
}

export interface InvestigatorRequest {
  investigationId: string;
  paste: string;
  witnessAdds: InvestigatorWitnessAdd[];
}

export interface InvestigatorState {
  phase: InvestigatorPhase;
  draft: InvestigationDraftPayload | null;
  suggestionId: string | null;
  error: string | null;
  insufficientReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreateTokens: number;
  } | null;
}

const INITIAL: InvestigatorState = {
  phase: "idle",
  draft: null,
  suggestionId: null,
  error: null,
  insufficientReason: null,
  usage: null,
};

export function useArgusInvestigatorStream() {
  const [state, setState] = useState<InvestigatorState>(INITIAL);

  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  const generate = useCallback(async (req: InvestigatorRequest) => {
    setState({ ...INITIAL, phase: "reading" });

    try {
      const res = await fetch("/api/argus/investigator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });

      if (!res.body) {
        setState({ ...INITIAL, phase: "error", error: "Empty response from Argus." });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let draft: InvestigationDraftPayload | null = null;
      let suggestionId: string | null = null;
      let usage: InvestigatorState["usage"] = null;
      let errorMsg: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl;
        while ((nl = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);
          const eventMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const evt = eventMatch[1];

          let data: unknown;
          try {
            data = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          if (evt === "progress") {
            const d = data as { phase?: string };
            if (d.phase === "reading" || d.phase === "streaming") {
              setState((prev) => ({ ...prev, phase: d.phase as InvestigatorPhase }));
            }
          } else if (evt === "draft") {
            const d = data as {
              suggestionId: string;
              draft: InvestigationDraftPayload;
            };
            draft = d.draft;
            suggestionId = d.suggestionId;
          } else if (evt === "usage") {
            usage = data as InvestigatorState["usage"];
          } else if (evt === "error") {
            const d = data as { message?: string };
            errorMsg = d.message ?? "Argus error";
          }
        }
      }

      if (errorMsg) {
        setState({ ...INITIAL, phase: "error", error: errorMsg });
        return;
      }
      if (!draft || !suggestionId) {
        setState({
          ...INITIAL,
          phase: "error",
          error: "Argus did not return a draft.",
        });
        return;
      }

      const refusal = (draft.insufficient_input ?? "").trim();
      setState({
        phase: "done",
        draft,
        suggestionId,
        error: null,
        insufficientReason: refusal.length > 0 ? refusal : null,
        usage,
      });
    } catch (err) {
      setState({
        ...INITIAL,
        phase: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  return { state, generate, reset };
}
