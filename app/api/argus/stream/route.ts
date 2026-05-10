import { NextRequest } from "next/server";
import { runArgusGates } from "@/lib/argus/gates";
import { TIER_BY_SURFACE, type ArgusSurface } from "@/lib/argus/models";
import { argusErrorStream, streamArgusResponse } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";

/**
 * Phase 9a "ping" endpoint — single-turn, no tool-use. POST { surface, prompt } → SSE.
 *
 * 9b's Copilot lives at `/api/argus/copilot` because it needs an agentic
 * tool-use loop; this endpoint is the simple-stream surface kept for
 * fallback / future inline classifiers where one model call → one
 * suggestion is the whole interaction.
 */

type ArgusBody = {
  surface: "ping" | ArgusSurface;
  prompt?: string;
};

const SYSTEM_PROMPT =
  "You are Argus, an EHS safety co-pilot. Be brief, specific, and action-oriented. You never finalize decisions — you suggest and let the human commit.";

export async function POST(request: NextRequest) {
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

  const gate = await runArgusGates(surface);
  if (!gate.ok) return gate.response;

  const tier =
    surface === "ping"
      ? "fast"
      : (TIER_BY_SURFACE[surface as ArgusSurface] ?? "fast");

  const stream = await gate.llm.streamText({
    surface,
    tier,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", text: prompt }],
  });

  return streamArgusResponse(stream, async (final, fullText) => {
    await logArgusSuggestion({
      orgId: gate.orgId,
      siteId: null,
      userId: gate.user.id,
      surface,
      model: final.modelUsed,
      usage: {
        promptTokens: final.usage.inputTokens,
        completionTokens: final.usage.outputTokens,
        cacheReadTokens: final.usage.cachedInputTokens,
        cacheCreateTokens: 0,
        thinkingTokens: final.usage.thinkingTokens,
      },
      payload: { prompt, response: fullText },
    });
  });
}
