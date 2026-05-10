import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runArgusGates } from "@/lib/argus/gates";
import { argusErrorStream, sseFrame } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";
import { COPILOT_TOOLS, copilotTools } from "@/lib/argus/tools";
import { redactText } from "@/lib/argus/redact";
import type { ChatTurn, UsageNormalized } from "@/lib/argus/llm";

/**
 * Phase 9b — Argus Copilot in Report Wizard. POST { incidentId, history } → SSE
 * with an agentic tool-use loop. The model can call `log_observation`,
 * `attach_photo`, `raise_stop_work`, and `update_incident_field`; each tool
 * returns a string the model sees in its next turn.
 *
 * Wire format:
 *   event: token       data: {"text": "..."}        — model text deltas
 *   event: tool_use    data: {"name": "…", "id": "…", "input": {…}}
 *   event: tool_result data: {"id": "…", "result": "…"}
 *   event: usage       data: {<UsageNormalized summed across loop iterations>}
 *   event: done        data: {"reason": "stop"|"tool_use"|"max_tokens"|...}
 *   event: error       data: {"message": "…"}
 *
 * Loop is capped at MAX_ITER iterations to bound cost on a runaway tool call.
 */

const MAX_ITER = 6;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CopilotBody = {
  incidentId: string;
  history: ChatMessage[];
};

let cachedSystemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const filePath = path.join(
    process.cwd(),
    "lib/argus/system-prompts/copilot.md",
  );
  cachedSystemPrompt = await fs.readFile(filePath, "utf-8");
  return cachedSystemPrompt;
}

export async function POST(request: NextRequest) {
  let body: CopilotBody;
  try {
    body = (await request.json()) as CopilotBody;
  } catch {
    return argusErrorStream("Invalid request body.", 400);
  }

  if (!body.incidentId) {
    return argusErrorStream("incidentId is required.", 400);
  }
  if (!Array.isArray(body.history) || body.history.length === 0) {
    return argusErrorStream("history must be a non-empty array.", 400);
  }

  const gate = await runArgusGates("copilot");
  if (!gate.ok) return gate.response;

  const { data: incident, error: incidentErr } = await gate.supabase
    .from("incidents")
    .select(
      "id, site_id, status, reporter_id, title, description, occurred_at, area, location",
    )
    .eq("id", body.incidentId)
    .maybeSingle();

  if (incidentErr || !incident) {
    return argusErrorStream("Incident not found.", 404);
  }
  if (incident.reporter_id !== gate.user.id) {
    return argusErrorStream("You are not the reporter of this draft.", 403);
  }
  if (incident.status !== "draft") {
    return argusErrorStream(
      "Argus Copilot only assists during the draft wizard.",
      400,
    );
  }

  const systemPrompt = await loadSystemPrompt();

  // Pull names from injured_persons + witnesses for the redactor. Best-effort.
  const { data: injured } = await gate.supabase
    .from("injured_persons")
    .select("name")
    .eq("incident_id", incident.id);
  const { data: witnesses } = await gate.supabase
    .from("witnesses")
    .select("name")
    .eq("incident_id", incident.id);
  const knownNames = [
    ...(injured ?? []).map((r) => r.name).filter(Boolean),
    ...(witnesses ?? []).map((r) => r.name).filter(Boolean),
  ].map((fullName) => ({
    fullName: fullName as string,
    initials: initialsOf(fullName as string),
  }));

  const redactedHistory: ChatMessage[] = body.history.map((m) => ({
    role: m.role,
    content: m.role === "user" ? redactText(m.content, knownNames) : m.content,
  }));

  const contextBlock = [
    `Draft incident context (read-only):`,
    `- Title: ${incident.title ?? "(not set)"}`,
    `- Area: ${incident.area ?? "(not set)"}`,
    `- Location: ${incident.location ?? "(not set)"}`,
    `- Description so far: ${incident.description ?? "(empty)"}`,
    `- Incident UUID: ${incident.id}`,
  ].join("\n");

  // Seed the conversation: context block + redacted history rolled into
  // ChatTurn shape. Per-turn role flips are 1:1 with the input.
  const initialTurns: ChatTurn[] = [
    { role: "user", text: contextBlock },
    ...redactedHistory.map<ChatTurn>((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      text: m.content,
    })),
  ];

  const ctx = {
    supabase: gate.supabase,
    userId: gate.user.id,
    orgId: gate.orgId,
    incidentId: incident.id,
    siteId: incident.site_id,
    modelUsed: "", // set after first streamText completes
  };

  const totalUsage: UsageNormalized = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    thinkingTokens: 0,
  };
  let assistantTextOut = "";
  let lastModel = "";
  let lastStopReason = "stop";

  const tools = copilotTools();

  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      let turns: ChatTurn[] = initialTurns;

      try {
        for (let iter = 0; iter < MAX_ITER; iter++) {
          const stream = await gate.llm.streamText({
            surface: "copilot",
            tier: "fast",
            system: systemPrompt,
            messages: turns,
            tools,
            maxOutputTokens: 1024,
          });

          for await (const chunk of stream.textChunks) {
            if (!chunk.text) continue;
            assistantTextOut += chunk.text;
            controller.enqueue(sseFrame("token", { text: chunk.text }));
          }

          const final = await stream.finalMessage();

          totalUsage.inputTokens += final.usage.inputTokens;
          totalUsage.outputTokens += final.usage.outputTokens;
          totalUsage.cachedInputTokens += final.usage.cachedInputTokens;
          totalUsage.thinkingTokens += final.usage.thinkingTokens;
          lastModel = final.modelUsed;
          lastStopReason = final.stopReason;
          ctx.modelUsed = final.modelUsed;

          if (final.toolCalls.length === 0) break;

          // Append the assistant's turn so the model has the same view as us
          // on the next iteration.
          turns = [
            ...turns,
            {
              role: "assistant",
              text: final.text,
              toolCalls: final.toolCalls,
            },
          ];

          const results: {
            toolCallId: string;
            toolName: string;
            result: string;
          }[] = [];

          for (const call of final.toolCalls) {
            controller.enqueue(
              sseFrame("tool_use", {
                name: call.name,
                id: call.id,
                input: call.arguments,
              }),
            );

            const tool = COPILOT_TOOLS[call.name];
            let toolResult: string;
            if (!tool) {
              toolResult = `Error: unknown tool ${call.name}`;
            } else {
              try {
                toolResult = await tool.execute(
                  (call.arguments ?? {}) as Record<string, unknown>,
                  ctx,
                );
              } catch (err) {
                toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
              }
            }
            controller.enqueue(
              sseFrame("tool_result", { id: call.id, result: toolResult }),
            );
            results.push({
              toolCallId: call.id,
              toolName: call.name,
              result: toolResult,
            });
          }

          turns = [...turns, { role: "tool_results", results }];
        }

        controller.enqueue(sseFrame("usage", totalUsage));

        // Audit trail of the conversation turn itself. Per-tool side-effect
        // rows were written from inside each tool.execute().
        await logArgusSuggestion({
          orgId: gate.orgId,
          siteId: incident.site_id,
          userId: gate.user.id,
          surface: "copilot",
          targetKind: "incident",
          targetId: incident.id,
          model: lastModel,
          usage: {
            promptTokens: totalUsage.inputTokens,
            completionTokens: totalUsage.outputTokens,
            cacheReadTokens: totalUsage.cachedInputTokens,
            cacheCreateTokens: 0,
            thinkingTokens: totalUsage.thinkingTokens,
          },
          payload: {
            kind: "conversation_turn",
            user_message: body.history[body.history.length - 1]?.content ?? "",
            assistant_response: assistantTextOut,
          },
        });

        controller.enqueue(sseFrame("done", { reason: lastStopReason }));
        controller.close();
      } catch (err) {
        controller.enqueue(
          sseFrame("error", {
            message: err instanceof Error ? err.message : String(err),
          }),
        );
        controller.enqueue(sseFrame("done", { reason: "error" }));
        controller.close();
      }
    },
  });

  return new Response(responseBody, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
}
