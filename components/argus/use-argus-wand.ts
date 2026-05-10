"use client";

import { useState, useCallback } from "react";

/**
 * Thin fetch hook around POST /api/argus/wand. Returns a `request` function
 * that callers invoke when the user clicks the wand button. State machine:
 *   idle → loading → (success | error)
 *
 * `cached` is true when the route returned a previously-cached suggestion
 * (Reportability surface only, 24h cache). Useful for "Argus assessed this
 * earlier" UI hints.
 */

export type WandRequest =
  | {
      surface: "risk_matrix";
      payload: {
        incidentId: string;
        description: string;
        type: string;
        area?: string;
      };
    }
  | {
      surface: "finding_severity";
      payload: {
        findingId: string;
        siteId: string;
        description: string;
        hazardCategory?: string;
      };
    }
  | {
      surface: "verification_method";
      payload: { capaId: string; siteId: string; capaSummary: string };
    }
  | {
      surface: "reportability";
      payload: { incidentId: string; jurisdiction: "US" | "GB" };
    }
  | {
      surface: "capa_metadata";
      payload: { investigationId: string; siteId: string };
    };

export interface WandResult<T = unknown> {
  ok: true;
  suggestionId: string;
  output: T;
  modelUsed: string;
  cached: boolean;
  insufficient: boolean;
}

export interface WandError {
  ok: false;
  error: string;
}

export type WandState<T = unknown> =
  | { phase: "idle" }
  | { phase: "loading" }
  | ({ phase: "success" } & WandResult<T>)
  | { phase: "error"; error: string };

export function useArgusWand<T = unknown>() {
  const [state, setState] = useState<WandState<T>>({ phase: "idle" });

  const request = useCallback(async (req: WandRequest): Promise<void> => {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/argus/wand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setState({
          phase: "error",
          error: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setState({
        phase: "success",
        ok: true,
        suggestionId: data.suggestionId,
        output: data.output as T,
        modelUsed: data.modelUsed,
        cached: Boolean(data.cached),
        insufficient: Boolean(data.insufficient),
      });
    } catch (err) {
      setState({
        phase: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, request, reset };
}
