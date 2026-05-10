import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { runArgusGates } from "@/lib/argus/gates";
import { MODEL_HAIKU } from "@/lib/argus/models";
import { argusErrorStream } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";
import { COPILOT_TOOLS, copilotToolsForAnthropic } from "@/lib/argus/tools";
import { redactText } from "@/lib/argus/redact";

/**
 * Phase 9b — Argus Copilot in Report Wizard. POST { incidentId, history } → SSE
 * with an agentic tool-use loop. The model can call `log_observation`,
 * `attach_photo`, and `raise_stop_work`; each tool returns a string the model
 * sees in its next turn.
 *
 * Wire format extends the 9a SSE shape:
 *   event: token       data: {"text": "..."}        — model text deltas
 *   event: tool_use    data: {"name": "…", "id": "…", "input": {…}}
 *   event: tool_result data: {"id": "…", "result": "…"}
 *   event: usage       data: {…tokens summed across loop iterations}
 *   event: done        data: {"reason": "end_turn"}
 *   event: error       data: {"message": "…"}
 *
 * Loop is capped at MAX_ITER iterations to bound cost on a runaway tool
 * call. The system prompt + tool list + last user message are cached via
 * `cache_control: ephemeral` — within a single panel session most context
 * (system + tools, ~2k tokens) is shared across turns.
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

// System prompt lives at lib/argus/system-prompts/copilot.md. Loaded once on
// first request; the file is bundled with the route handler at build time.
let cachedSystemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const filePath = path.join(process.cwd(), "lib/argus/system-prompts/copilot.md");
  cachedSystemPrompt = await fs.readFile(filePath, "utf-8");
  return cachedSystemPrompt;
}

const encoder = new TextEncoder();
function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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

  // Validate the draft incident exists and the user is the reporter.
  // Pre-Step-3, the wizard always owns the row; post-Step-3 the Copilot
  // closes (the panel only mounts on /incidents/new/[1|2|3]).
  const { data: incident, error: incidentErr } = await gate.supabase
    .from("incidents")
    .select("id, site_id, status, reporter_id, title, description, occurred_at, area, location")
    .eq("id", body.incidentId)
    .maybeSingle();

  if (incidentErr || !incident) {
    return argusErrorStream("Incident not found.", 404);
  }
  if (incident.reporter_id !== gate.user.id) {
    return argusErrorStream("You are not the reporter of this draft.", 403);
  }
  if (incident.status !== "draft") {
    return argusErrorStream("Argus Copilot only assists during the draft wizard.", 400);
  }

  const systemPrompt = await loadSystemPrompt();

  // Pull the names from injured_persons + witnesses so the redactor can strip
  // them from anything the model sends back. Best-effort; failure is fine.
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
  ].map((fullName) => ({ fullName: fullName as string, initials: initialsOf(fullName as string) }));

  // Pre-redact every user message in the history before sending to the model.
  // Defence-in-depth — Anthropic's no-training policy is the actual privacy
  // backstop, but we don't need to rely on it.
  const redactedHistory: ChatMessage[] = body.history.map((m) => ({
    role: m.role,
    content: m.role === "user" ? redactText(m.content, knownNames) : m.content,
  }));

  // Page-context block injected as the first user message — gives the model
  // the draft's existing description, area, and incident type so it doesn't
  // re-ask things the wizard already collected.
  const contextBlock = [
    `Draft incident context (read-only):`,
    `- Title: ${incident.title ?? "(not set)"}`,
    `- Area: ${incident.area ?? "(not set)"}`,
    `- Location: ${incident.location ?? "(not set)"}`,
    `- Description so far: ${incident.description ?? "(empty)"}`,
    `- Incident UUID: ${incident.id}`,
  ].join("\n");

  const initialMessages: Anthropic.MessageParam[] = [
    { role: "user", content: contextBlock },
    ...redactedHistory.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
  ];

  const ctx = {
    supabase: gate.supabase,
    userId: gate.user.id,
    orgId: gate.orgId,
    incidentId: incident.id,
    siteId: incident.site_id,
  };

  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreateTokens: 0,
  };
  let assistantTextOut = "";

  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      let messages: Anthropic.MessageParam[] = initialMessages;

      try {
        for (let iter = 0; iter < MAX_ITER; iter++) {
          const stream = gate.client.messages.stream({
            model: MODEL_HAIKU,
            max_tokens: 1024,
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: copilotToolsForAnthropic(),
            messages,
          });

          stream.on("text", (delta) => {
            assistantTextOut += delta;
            controller.enqueue(sseEvent("token", { text: delta }));
          });

          const finalMessage = await stream.finalMessage();

          totalUsage.inputTokens += finalMessage.usage.input_tokens ?? 0;
          totalUsage.outputTokens += finalMessage.usage.output_tokens ?? 0;
          totalUsage.cacheReadTokens += finalMessage.usage.cache_read_input_tokens ?? 0;
          totalUsage.cacheCreateTokens += finalMessage.usage.cache_creation_input_tokens ?? 0;

          if (finalMessage.stop_reason === "tool_use") {
            // Append the assistant turn (with its tool_use blocks) so the
            // model has the same view as we do on the next iteration.
            messages = [...messages, { role: "assistant", content: finalMessage.content }];

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of finalMessage.content) {
              if (block.type !== "tool_use") continue;
              controller.enqueue(
                sseEvent("tool_use", { name: block.name, id: block.id, input: block.input }),
              );

              const tool = COPILOT_TOOLS[block.name];
              let toolResult: string;
              if (!tool) {
                toolResult = `Error: unknown tool ${block.name}`;
              } else {
                try {
                  toolResult = await tool.execute(block.input as Record<string, unknown>, ctx);
                } catch (err) {
                  toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
                }
              }
              controller.enqueue(sseEvent("tool_result", { id: block.id, result: toolResult }));
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: toolResult,
              });
            }

            messages = [...messages, { role: "user", content: toolResults }];
            continue; // loop back, model now has tool results
          }

          // end_turn (or any other terminal reason) → done.
          break;
        }

        controller.enqueue(sseEvent("usage", totalUsage));

        // Persist a single suggestion row summarizing the whole conversation
        // turn (the per-tool rows already wrote their own argus_suggestions
        // entries from inside the tool execute()). This row is the audit
        // trail of the user → assistant conversation itself.
        await logArgusSuggestion({
          orgId: gate.orgId,
          siteId: incident.site_id,
          userId: gate.user.id,
          surface: "copilot",
          targetKind: "incident",
          targetId: incident.id,
          model: MODEL_HAIKU,
          usage: {
            promptTokens: totalUsage.inputTokens,
            completionTokens: totalUsage.outputTokens,
            cacheReadTokens: totalUsage.cacheReadTokens,
            cacheCreateTokens: totalUsage.cacheCreateTokens,
          },
          payload: {
            kind: "conversation_turn",
            user_message: body.history[body.history.length - 1]?.content ?? "",
            assistant_response: assistantTextOut,
          },
        });

        controller.enqueue(sseEvent("done", { reason: "end_turn" }));
        controller.close();
      } catch (err) {
        controller.enqueue(
          sseEvent("error", { message: err instanceof Error ? err.message : String(err) }),
        );
        controller.enqueue(sseEvent("done", { reason: "error" }));
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
