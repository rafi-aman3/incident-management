import { NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { isArgusConfigured, getArgusClient, ArgusOfflineError } from "@/lib/argus/client";
import { MODEL_HAIKU, MODEL_BY_SURFACE, type ArgusSurface } from "@/lib/argus/models";
import { checkArgusBudget } from "@/lib/argus/budget";
import { checkRateLimit } from "@/lib/argus/ratelimit";
import { argusErrorStream, streamArgusResponse } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";

/**
 * Argus streaming endpoint. POST { surface, prompt } → SSE.
 *
 * Phase 9a establishes the wire format with a single 'ping' surface. 9b-9e
 * extend the surface enum (copilot, investigator, severity, capa_draft, …)
 * and add per-surface system prompts and tool definitions.
 *
 * Gates (in order):
 *   1. requireUser()              — auth
 *   2. orgCan('argus:use')        — feature permission
 *   3. orgs.argus_enabled         — per-org feature flag
 *   4. checkRateLimit             — per-user, per-bucket
 *   5. checkArgusBudget           — per-org, per-day token budget
 *   6. isArgusConfigured          — ANTHROPIC_API_KEY present
 *
 * Each gate returns the same SSE error shape so the client renders a
 * friendly message instead of a 500.
 */

type ArgusBody = {
  surface: "ping" | ArgusSurface;
  prompt?: string;
};

const HEAVY_SURFACES = new Set<string>(["investigator", "capa_draft", "reportability"]);

export async function POST(request: NextRequest) {
  const { user, profile } = await requireUser();

  if (!(await orgCan("argus:use"))) {
    return argusErrorStream("Argus is not enabled for your role.", 403);
  }

  let body: ArgusBody;
  try {
    body = (await request.json()) as ArgusBody;
  } catch {
    return argusErrorStream("Invalid request body.", 400);
  }

  const surface = body.surface ?? "ping";
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return argusErrorStream("Prompt is required.", 400);
  }

  // Per-user rate limit (heavy bucket for deep analyses, inline for the rest).
  const bucket = HEAVY_SURFACES.has(surface) ? "heavy" : "inline";
  const rl = checkRateLimit(user.id, bucket);
  if (!rl.allowed) {
    return argusErrorStream(
      `You are sending Argus requests too quickly. Try again in ${Math.ceil(rl.resetMs / 1000)}s.`,
      429,
    );
  }

  // Per-org daily token budget.
  let budget;
  try {
    budget = await checkArgusBudget(profile.org_id);
  } catch (err) {
    return argusErrorStream(
      `Could not verify Argus budget: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
  if (budget.blocked) {
    return argusErrorStream(
      "Your organization has reached today's Argus token budget. Try again tomorrow.",
      429,
    );
  }

  if (!isArgusConfigured()) {
    return argusErrorStream("Argus is offline (no API key configured).", 503);
  }

  let client;
  try {
    client = getArgusClient();
  } catch (err) {
    if (err instanceof ArgusOfflineError) {
      return argusErrorStream(err.message, 503);
    }
    throw err;
  }

  const model =
    surface === "ping"
      ? MODEL_HAIKU
      : (MODEL_BY_SURFACE[surface as ArgusSurface] ?? MODEL_HAIKU);

  // Phase 9a system prompt is intentionally tiny — proves the pipeline.
  // 9b-9e replace this per-surface from `lib/argus/system-prompts/*.md`.
  const messageStream = client.messages.stream({
    model,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: "You are Argus, an EHS safety co-pilot. Be brief, specific, and action-oriented. You never finalize decisions — you suggest and let the human commit.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  return streamArgusResponse(messageStream, async (usage, fullText) => {
    await logArgusSuggestion({
      orgId: profile.org_id,
      siteId: null,
      userId: user.id,
      surface,
      model,
      usage: {
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheCreateTokens: usage.cacheCreateTokens,
      },
      payload: { prompt, response: fullText },
    });
  });
}
