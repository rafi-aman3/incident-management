import { createHash } from "node:crypto";

/**
 * Phase 9e — Argus Insight Tiles registry.
 *
 * One reusable `<ArgusInsightTile>` plus `/api/argus/tile` route handler
 * cover seven surfaces: four on `/dashboard` and one each on `/capa`,
 * `/inspections`, `/reports`. This module owns the keys, TTLs, default
 * navigation targets, and the deterministic cache-key helper that lets
 * multiple users share one model call per (tile, freshness) snapshot.
 *
 * Cache strategy: each aggregator computes a `freshnessKey` (e.g.
 * `max(stop_work_raised_at) + count`) — when the underlying data hasn't
 * meaningfully changed, the key stays stable and `argus_suggestions` cache
 * hits skip the model entirely. TTL is a backstop for "nothing changed but
 * we should re-look anyway."
 */

export type TileKey =
  | "overdue_investigations"
  | "stop_work_active"
  | "reportability_uncertain"
  | "capa_overdue"
  | "capa_index_summary"
  | "inspections_due_summary"
  | "reports_pending_summary";

/**
 * Aggregator output. `freshnessKey` doubles as the cache invalidation signal
 * — append `|<count>` or `|<max_updated_at>` so the moment data changes the
 * cached row's key no longer matches.
 */
export interface TileAggregatorPayload {
  aggregates: Record<string, number>;
  /** Up to 5 ref_codes (e.g. ['IR-014','IR-022']) the model can cite. */
  recordRefs: string[];
  /** Stable string that changes the moment the underlying data changes. */
  freshnessKey: string;
}

export interface TileConfig {
  /** Surface key written to `argus_suggestions.surface`. */
  surface: `tile_${TileKey}`;
  /** Cache TTL — backstop only; freshnessKey does the real invalidation. */
  ttlMs: number;
  /** Default href for the suggestion-card recommended-action link. The
   *  model can override the link's *label* but never the destination. */
  defaultHref: string;
  /** Default link label when the model doesn't return one. */
  defaultHrefLabel: string;
  /** RBAC permission required to render this tile. Reuses existing keys —
   *  9e adds no new ones. The choice mirrors how the matching index page
   *  gates its own list view. */
  permission:
    | "investigation:lead"
    | "incident:read_site"
    | "report:read"
    | "capa:complete"
    | "inspection:read_site";
}

export const TILE_CONFIG: Record<TileKey, TileConfig> = {
  overdue_investigations: {
    surface: "tile_overdue_investigations",
    ttlMs: 24 * 60 * 60 * 1000, // 24h — daily clock signal
    defaultHref: "/investigations?status=overdue",
    defaultHrefLabel: "Open overdue list",
    permission: "investigation:lead",
  },
  stop_work_active: {
    surface: "tile_stop_work_active",
    ttlMs: 60 * 60 * 1000, // 1h — high-stakes; under-cached is fine
    defaultHref: "/incidents?stop_work=active",
    defaultHrefLabel: "Acknowledge",
    permission: "incident:read_site",
  },
  reportability_uncertain: {
    surface: "tile_reportability_uncertain",
    ttlMs: 24 * 60 * 60 * 1000,
    defaultHref: "/reports",
    defaultHrefLabel: "Re-assess",
    permission: "report:read",
  },
  capa_overdue: {
    surface: "tile_capa_overdue",
    ttlMs: 24 * 60 * 60 * 1000,
    defaultHref: "/capa?status=overdue",
    defaultHrefLabel: "Open overdue list",
    permission: "capa:complete",
  },
  capa_index_summary: {
    surface: "tile_capa_index_summary",
    ttlMs: 24 * 60 * 60 * 1000,
    defaultHref: "/capa",
    defaultHrefLabel: "View clusters",
    permission: "capa:complete",
  },
  inspections_due_summary: {
    surface: "tile_inspections_due_summary",
    ttlMs: 24 * 60 * 60 * 1000,
    defaultHref: "/inspections",
    defaultHrefLabel: "View schedule",
    permission: "inspection:read_site",
  },
  reports_pending_summary: {
    surface: "tile_reports_pending_summary",
    ttlMs: 24 * 60 * 60 * 1000,
    defaultHref: "/reports",
    defaultHrefLabel: "Open reports",
    permission: "report:read",
  },
};

export const TILE_KEYS = Object.keys(TILE_CONFIG) as TileKey[];

/** Structured output every tile tool returns. Mirrors the shape we validate
 *  on the server before writing `argus_suggestions.payload.output`. */
export interface TileInsightOutput {
  summary: string;
  rationale: string;
  confidence: number;
  /** When true, `summary` should be the muted "nothing to flag" empty state.
   *  The card collapses to a one-line muted variant. */
  nothing_to_flag?: boolean;
  /** Optional override for the card's recommended-action link label. */
  recommended_action_label?: string;
}

/**
 * Compute the cache key for a tile given the aggregator's freshnessKey.
 * Returns a deterministic UUID-shaped string suitable for
 * `argus_suggestions.target_id` (which is a Postgres `uuid` column).
 *
 * Encoded as UUIDv5: version nibble forced to 5, variant nibble to 0b10xx.
 * Same input → same UUID, every time, across processes.
 */
export function tileCacheKey(tile: TileKey, freshnessKey: string): string {
  const hash = createHash("sha1")
    .update(`tile:${tile}|${freshnessKey}`)
    .digest("hex"); // 40 hex chars
  // 8-4-(5xxx)-(8-bxxx)-12 → valid UUIDv5
  const variant = (
    (parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8
  ).toString(16);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}
