import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runArgusGates } from "@/lib/argus/gates";
import { logArgusSuggestion } from "@/lib/argus/log";
import { can } from "@/lib/auth/can";
import { orgCan } from "@/lib/auth/orgCan";
import { ArgusInvalidResponseError } from "@/lib/argus/llm";
import { tileInsightTool } from "@/lib/argus/tools/tile-insight";
import {
  TILE_CONFIG,
  TILE_KEYS,
  tileCacheKey,
  type TileKey,
  type TileInsightOutput,
} from "@/lib/argus/tiles";
import type { Json } from "@/lib/supabase/types";

/**
 * Phase 9e — Argus Insight Tiles. POST { tile, payload } → JSON envelope:
 *   { ok: true,  suggestionId, output, modelUsed, cached: boolean }
 *   { ok: false, error }
 *
 * Non-streaming. Sub-second on Flash, 2–6s on Pro with thinking off.
 *
 * Cache strategy: each aggregator computes a `freshnessKey` server-side; we
 * hash that into a deterministic UUIDv5 stored in
 * `argus_suggestions.target_id`. Subsequent requests with the same tile +
 * freshnessKey hit the cache and skip the model call entirely. TTL is a
 * backstop — when nothing has changed but enough time has passed, we'll
 * re-look anyway in case the world moved on.
 *
 * No new RBAC keys. Visibility: argus:use + the tile's underlying read
 * permission (investigation:read / capa:read / inspection:read /
 * incident:read_site / report:read).
 */

const tilePayloadSchema = z.object({
  siteId: z.string().uuid().nullable(),
  aggregates: z.record(z.string(), z.number()),
  recordRefs: z.array(z.string().max(40)).max(10),
  freshnessKey: z.string().min(1).max(200),
});

const tileBodySchema = z.object({
  tile: z.enum(TILE_KEYS as [TileKey, ...TileKey[]]),
  payload: tilePayloadSchema,
});

const tileOutputSchema = z.object({
  summary: z.string().max(400),
  rationale: z.string().max(800),
  confidence: z.number().min(0).max(1),
  nothing_to_flag: z.boolean().optional(),
  recommended_action_label: z.string().max(80).optional(),
});

type Gate = Extract<Awaited<ReturnType<typeof runArgusGates>>, { ok: true }>;

const promptCache = new Map<TileKey, string>();
async function loadTilePrompt(tile: TileKey): Promise<string> {
  const cached = promptCache.get(tile);
  if (cached) return cached;
  const filename = `tile-${tile.replace(/_/g, "-")}.md`;
  const filePath = path.join(
    process.cwd(),
    "lib/argus/system-prompts",
    filename,
  );
  const text = await fs.readFile(filePath, "utf-8");
  promptCache.set(tile, text);
  return text;
}

function jsonError(error: string, status = 400): Response {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = tileBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid tile request payload.", 400);
  }
  const { tile, payload } = parsed.data;
  const config = TILE_CONFIG[tile];

  const gate = await runArgusGates(config.surface);
  if (!gate.ok) {
    const text = await gate.response.text();
    const message =
      /data: (\{.*"message":\s*"([^"]+)".*\})/.exec(text)?.[2] ??
      "Argus is unavailable.";
    return jsonError(message, gate.response.status);
  }

  const permitted = payload.siteId
    ? await can(config.permission, payload.siteId)
    : await orgCan(config.permission);
  if (!permitted) {
    return jsonError(
      "You do not have permission to view this tile.",
      403,
    );
  }

  const cacheKey = tileCacheKey(tile, payload.freshnessKey);

  // ---------- Cache lookup ----------
  const cutoffISO = new Date(Date.now() - config.ttlMs).toISOString();
  const { data: cached } = await gate.supabase
    .from("argus_suggestions")
    .select("id, payload, model, created_at")
    .eq("surface", config.surface)
    .eq("target_kind", "page")
    .eq("target_id", cacheKey)
    .gte("created_at", cutoffISO)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached && isCachedTilePayload(cached.payload)) {
    const c = cached.payload as { output: Json };
    return NextResponse.json({
      ok: true,
      suggestionId: cached.id,
      output: c.output,
      modelUsed: cached.model,
      cached: true,
    });
  }

  // ---------- Fresh model call ----------
  const system = await loadTilePrompt(tile);
  const userBlock = buildUserBlock(payload);

  let result;
  try {
    result = await gate.llm.generateStructured<TileInsightOutput>({
      surface: config.surface,
      tier: "smart",
      thinking: "off",
      system,
      user: userBlock,
      tool: tileInsightTool,
      maxOutputTokens: 1024,
    });
  } catch (err) {
    const message =
      err instanceof ArgusInvalidResponseError
        ? "Argus returned an unexpected response."
        : err instanceof Error
          ? err.message
          : String(err);
    return jsonError(message, 502);
  }

  const validated = tileOutputSchema.safeParse(result.output);
  if (!validated.success) {
    return jsonError("Argus returned an invalid tile output.", 502);
  }

  const logged = await logArgusSuggestion({
    orgId: gate.orgId,
    siteId: payload.siteId,
    userId: gate.user.id,
    surface: config.surface,
    targetKind: "page",
    targetId: cacheKey,
    model: result.modelUsed,
    usage: {
      promptTokens: result.usage.inputTokens,
      completionTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cachedInputTokens,
      cacheCreateTokens: 0,
      thinkingTokens: result.usage.thinkingTokens,
    },
    payload: {
      kind: "tile",
      tile,
      cache_key: cacheKey,
      freshness_key: payload.freshnessKey,
      aggregates: payload.aggregates as Json,
      record_refs: payload.recordRefs,
      output: validated.data as Json,
    },
    outcome: "pending",
    activityVerb: "argus.tile_generated",
  });

  return NextResponse.json({
    ok: true,
    suggestionId: logged.suggestionId,
    output: validated.data,
    modelUsed: result.modelUsed,
    cached: false,
  });
}

function buildUserBlock(payload: z.infer<typeof tilePayloadSchema>): string {
  const lines: string[] = ["# Aggregates"];
  const aggKeys = Object.keys(payload.aggregates).sort();
  for (const k of aggKeys) {
    lines.push(`- ${k}: ${payload.aggregates[k]}`);
  }
  if (payload.recordRefs.length > 0) {
    lines.push("", "# Record refs");
    for (const r of payload.recordRefs) {
      lines.push(`- ${r}`);
    }
  } else {
    lines.push("", "# Record refs", "(none — summarise on counts only)");
  }
  return lines.join("\n");
}

function isCachedTilePayload(p: unknown): p is { output: Json } {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  return "output" in (p as Record<string, unknown>);
}
