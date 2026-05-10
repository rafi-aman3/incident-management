"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useArgusInsightTile } from "./use-argus-insight-tile";
import {
  TILE_CONFIG,
  type TileAggregatorPayload,
  type TileKey,
} from "@/lib/argus/tiles";

/**
 * Phase 9e — read-only Argus Insight Tile. One reusable card with four
 * states: skeleton, resolved, empty (`nothing_to_flag`), error. Same visual
 * language as 9d's wand suggestion-card so users learn one Argus shape:
 * cyan accent border, Sparkles glyph, "Argus insight" eyebrow.
 *
 * The recommended-action label is model-influenced but the destination URL
 * stays server-controlled (TILE_CONFIG[tile].defaultHref or a per-mount
 * override). The model can NOT redirect the user to an arbitrary URL.
 */

interface ArgusInsightTileProps {
  tile: TileKey;
  payload: TileAggregatorPayload & { siteId: string };
  /** Optional href override — falls back to TILE_CONFIG[tile].defaultHref. */
  href?: string;
  /** Optional default label — model can override via recommended_action_label. */
  hrefLabel?: string;
}

export function ArgusInsightTile({
  tile,
  payload,
  href,
  hrefLabel,
}: ArgusInsightTileProps) {
  const config = TILE_CONFIG[tile];
  const { status, output, cached, error, refresh } = useArgusInsightTile({
    tile,
    payload,
  });

  const targetHref = href ?? config.defaultHref;
  const label = output?.recommended_action_label ?? hrefLabel ?? config.defaultHrefLabel;

  if (status === "loading" || status === "idle") {
    return (
      <article
        className="rounded-md border border-l-4 bg-card p-4"
        style={{ borderLeftColor: "var(--argus-accent, #00D4FF)" }}
        aria-busy="true"
        aria-label="Argus insight loading"
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles
            className="h-3.5 w-3.5"
            style={{ color: "var(--argus-accent, #00D4FF)" }}
          />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Argus insight
          </span>
        </div>
        <Skeleton className="mb-2 h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </article>
    );
  }

  if (status === "error") {
    return (
      <article
        className="rounded-md border border-l-4 border-destructive/40 bg-card p-3 text-xs text-muted-foreground"
        aria-label="Argus tile error"
      >
        <div className="flex items-start justify-between gap-2">
          <span>Argus couldn&apos;t generate this tile. {error ?? ""}</span>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      </article>
    );
  }

  // status === "resolved"
  if (output?.nothing_to_flag) {
    return (
      <article
        className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground"
        aria-label="Argus tile — nothing to flag"
      >
        <Sparkles
          className="h-3 w-3 shrink-0"
          style={{ color: "var(--argus-accent, #00D4FF)" }}
        />
        <span className="flex-1">
          {output.summary || "Nothing to flag right now — Argus is watching."}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          title="Re-assess"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </article>
    );
  }

  return (
    <article
      className="rounded-md border border-l-4 bg-card p-4"
      style={{ borderLeftColor: "var(--argus-accent, #00D4FF)" }}
      aria-label="Argus insight"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles
            className="h-3.5 w-3.5"
            style={{ color: "var(--argus-accent, #00D4FF)" }}
          />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Argus insight
          </span>
        </div>
        {output?.confidence != null && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            confidence {Math.round(output.confidence * 100)}%
          </span>
        )}
      </div>
      <p className="text-sm leading-snug">{output?.summary ?? ""}</p>
      {output?.rationale && (
        <p className="mt-1.5 text-xs text-muted-foreground">{output.rationale}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={targetHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {label} <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          title={cached ? "Cached — re-assess" : "Re-assess"}
        >
          <RotateCcw className="h-3 w-3" /> Re-assess
        </button>
      </div>
    </article>
  );
}
