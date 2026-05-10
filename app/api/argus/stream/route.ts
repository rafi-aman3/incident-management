import { NextRequest } from "next/server";
import { runArgusGates } from "@/lib/argus/gates";
import { MODEL_HAIKU, MODEL_BY_SURFACE, type ArgusSurface } from "@/lib/argus/models";
import { argusErrorStream, streamArgusResponse } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";

/**
 * Phase 9a "ping" endpoint — single-turn, no tool-use. POST { surface, prompt } → SSE.
 *
 * 9b's Copilot lives at `/api/argus/copilot` because it needs an agentic
 * tool-use loop; this endpoint stays as the simple-stream surface for
 * future inline classifiers (9d severity / capa_method / etc.) where one
 * model call → one suggestion is the whole interaction.
 */

type ArgusBody = {
  surface: "ping" | ArgusSurface;
  prompt?: string;
};

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

  const model =
    surface === "ping"
      ? MODEL_HAIKU
      : (MODEL_BY_SURFACE[surface as ArgusSurface] ?? MODEL_HAIKU);

  const messageStream = gate.client.messages.stream({
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
      orgId: gate.orgId,
      siteId: null,
      userId: gate.user.id,
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
