"use client";

import { useCallback, useRef, useState } from "react";
import type {
  TileAggregatorPayload,
  TileInsightOutput,
  TileKey,
} from "@/lib/argus/tiles";

/**
 * Phase 9e — fetch hook for `<ArgusInsightTile>`. POST to /api/argus/tile,
 * track idle / loading / resolved / error states, expose `analyze` (the
 * user's "Analyse" click) and `refresh` (the cache-busting [Re-assess]).
 *
 * Tiles never auto-fire — the user is always the one who triggers an LLM
 * call. Avoids surprise spend on dashboard / index loads and keeps the AI
 * surface explicitly opt-in. The server still caches hits across users via
 * `argus_suggestions(target_id=cacheKey)`, so a click on a known signal is
 * effectively free for the second user.
 */

interface UseArgusInsightTileArgs {
  tile: TileKey;
  payload: TileAggregatorPayload & { siteId: string };
}

export type ArgusTileStatus = "idle" | "loading" | "resolved" | "error";

export interface UseArgusInsightTileResult {
  status: ArgusTileStatus;
  output: TileInsightOutput | null;
  modelUsed: string | null;
  cached: boolean;
  error: string | null;
  analyze: () => void;
  refresh: () => void;
}

export function useArgusInsightTile({
  tile,
  payload,
}: UseArgusInsightTileArgs): UseArgusInsightTileResult {
  const [status, setStatus] = useState<ArgusTileStatus>("idle");
  const [output, setOutput] = useState<TileInsightOutput | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKeyRef = useRef<string>("");

  const fetchTile = useCallback(
    async (force: boolean) => {
      const cacheKey = `${tile}|${payload.freshnessKey}`;
      if (!force && lastKeyRef.current === cacheKey) return;
      lastKeyRef.current = cacheKey;

      setStatus("loading");
      setError(null);

      try {
        const res = await fetch("/api/argus/tile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tile,
            payload: {
              siteId: payload.siteId,
              aggregates: payload.aggregates,
              recordRefs: payload.recordRefs,
              freshnessKey: force
                ? `${payload.freshnessKey}|force-${Date.now()}`
                : payload.freshnessKey,
            },
          }),
        });

        const json = (await res.json().catch(() => null)) as {
          ok: boolean;
          output?: TileInsightOutput;
          modelUsed?: string;
          cached?: boolean;
          error?: string;
        } | null;

        if (!res.ok || !json || !json.ok) {
          setError(json?.error ?? "Argus tile failed to load.");
          setStatus("error");
          return;
        }

        setOutput(json.output ?? null);
        setModelUsed(json.modelUsed ?? null);
        setCached(Boolean(json.cached));
        setStatus("resolved");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [tile, payload.freshnessKey, payload.siteId, payload.aggregates, payload.recordRefs],
  );

  const analyze = useCallback(() => {
    void fetchTile(false);
  }, [fetchTile]);

  const refresh = useCallback(() => {
    void fetchTile(true);
  }, [fetchTile]);

  return { status, output, modelUsed, cached, error, analyze, refresh };
}
