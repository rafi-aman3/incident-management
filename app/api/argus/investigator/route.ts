import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { runArgusGates } from "@/lib/argus/gates";
import { MODEL_SONNET } from "@/lib/argus/models";
import { argusErrorStream } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";
import { investigatorToolsForAnthropic, type InvestigationDraftPayload } from "@/lib/argus/tools";
import { redactText, initialsOf } from "@/lib/argus/redact";
import { can } from "@/lib/auth/can";
import type { Json } from "@/lib/supabase/types";

/**
 * Phase 9c — AI Investigator. POST { investigationId, paste, witnessAdds[] } →
 * SSE stream:
 *   event: progress  data: {"phase":"reading"|"streaming"}
 *   event: draft     data: {<InvestigationDraftPayload>, suggestionId}
 *   event: usage     data: {<token totals>}
 *   event: error     data: {"message":"…"}
 *   event: done      data: {"reason":"end_turn"|"insufficient_input"|"error"}
 *
 * One Sonnet 4.6 call per request — no agentic loop. `tool_choice` is forced
 * to `propose_investigation_draft` so the model emits exactly one tool_use
 * block; we capture its `input` directly as the structured draft and stream
 * it back. The user reviews, edits, and Pushes per-section in the UI; the
 * draft does NOT persist to investigations.{findings, root_cause_summary} or
 * rca_whys until the user clicks Push (gated on `investigation:edit` via the
 * existing actions).
 */

let cachedSystemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const filePath = path.join(process.cwd(), "lib/argus/system-prompts/investigator.md");
  cachedSystemPrompt = await fs.readFile(filePath, "utf-8");
  return cachedSystemPrompt;
}

const encoder = new TextEncoder();
function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

interface WitnessAdd {
  name: string;
  contact?: string;
  statement: string;
}

interface InvestigatorBody {
  investigationId: string;
  paste?: string;
  witnessAdds?: WitnessAdd[];
}

export async function POST(request: NextRequest) {
  let body: InvestigatorBody;
  try {
    body = (await request.json()) as InvestigatorBody;
  } catch {
    return argusErrorStream("Invalid request body.", 400);
  }
  if (!body.investigationId) {
    return argusErrorStream("investigationId is required.", 400);
  }

  const gate = await runArgusGates("investigator");
  if (!gate.ok) return gate.response;

  // Look up the investigation + the source incident in one round-trip.
  const { data: inv, error: invErr } = await gate.supabase
    .from("investigations")
    .select(
      `id, site_id, status, lead_investigator_id,
       incident:incident_id (
         id, type, title, description, area, location, occurred_at,
         injured_persons ( name )
       )`,
    )
    .eq("id", body.investigationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (invErr || !inv || !inv.incident) {
    return argusErrorStream("Investigation not found.", 404);
  }
  if (inv.status === "closed") {
    return argusErrorStream("This investigation is closed.", 400);
  }
  if (!(await can("investigation:edit", inv.site_id))) {
    return argusErrorStream("You do not have permission to edit this investigation.", 403);
  }

  // Existing witness statements on the source incident — these get folded
  // into the prompt as part of the source material.
  const { data: existingWitnesses } = await gate.supabase
    .from("witnesses")
    .select("name, statement")
    .eq("incident_id", inv.incident.id);

  // Build the redaction list from every name we know about: injured persons,
  // existing witnesses, and any names the caller submitted via witnessAdds.
  // Defence-in-depth — Anthropic's no-training-on-API-input policy is the
  // actual privacy backstop. Per SPEC §17.
  const knownNames = [
    ...(inv.incident.injured_persons ?? []).map((p) => p.name),
    ...(existingWitnesses ?? []).map((w) => w.name),
    ...(body.witnessAdds ?? []).map((w) => w.name),
  ]
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((fullName) => ({ fullName, initials: initialsOf(fullName) }));

  // Validate input gate before paying for a Sonnet call. The system prompt
  // also enforces this server-side by setting `insufficient_input`, but a
  // pre-flight check saves a round-trip on obviously empty input.
  const pasteText = (body.paste ?? "").trim();
  const witnessAdds = (body.witnessAdds ?? [])
    .filter((w) => w.statement?.trim() && w.name?.trim())
    .map((w) => ({
      name: w.name.trim(),
      contact: w.contact?.trim() ?? "",
      statement: w.statement.trim(),
    }));
  const witnessCount = (existingWitnesses?.length ?? 0) + witnessAdds.length;
  const totalWords =
    countWords(inv.incident.description ?? "") +
    countWords(pasteText) +
    (existingWitnesses ?? []).reduce((acc, w) => acc + countWords(w.statement ?? ""), 0) +
    witnessAdds.reduce((acc, w) => acc + countWords(w.statement), 0);

  if (witnessCount === 0 && totalWords < 50 && !pasteText) {
    return argusErrorStream(
      "Need at least one witness statement or additional detail beyond the incident header to draft responsibly.",
      400,
    );
  }

  const systemPrompt = await loadSystemPrompt();

  const userBlock = [
    "# Incident",
    `Type: ${inv.incident.type} · Area: ${inv.incident.area ?? "(unspecified)"} · Location: ${inv.incident.location ?? "(unspecified)"} · Occurred: ${inv.incident.occurred_at}`,
    `Title: ${inv.incident.title}`,
    `Description: ${redactText(inv.incident.description ?? "(no description)", knownNames)}`,
    "",
    "# Witness statements",
    ...((existingWitnesses?.length ?? 0) + witnessAdds.length === 0
      ? ["(none)"]
      : [
          ...(existingWitnesses ?? []).map(
            (w) =>
              `- ${initialsOf(w.name ?? "")}: "${redactText(w.statement ?? "", knownNames)}"`,
          ),
          ...witnessAdds.map(
            (w) => `- ${initialsOf(w.name)}: "${redactText(w.statement, knownNames)}"`,
          ),
        ]),
    "",
    "# Additional context",
    pasteText ? redactText(pasteText, knownNames) : "(none)",
  ].join("\n");

  const body_messages: Anthropic.MessageParam[] = [{ role: "user", content: userBlock }];

  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sseEvent("progress", { phase: "reading" }));

      try {
        const stream = gate.client.messages.stream({
          model: MODEL_SONNET,
          max_tokens: 4096,
          system: [
            { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
          ],
          tools: investigatorToolsForAnthropic(),
          tool_choice: { type: "tool", name: "propose_investigation_draft" },
          messages: body_messages,
        });

        controller.enqueue(sseEvent("progress", { phase: "streaming" }));

        // Consume input_json deltas only as a heartbeat — we don't stream the
        // (partial) JSON to the client because half-built objects can't be
        // safely rendered. The full structured draft is emitted once the
        // model completes via finalMessage().
        stream.on("inputJson", () => {
          controller.enqueue(sseEvent("progress", { phase: "streaming" }));
        });

        const finalMessage = await stream.finalMessage();

        const usage = {
          inputTokens: finalMessage.usage.input_tokens ?? 0,
          outputTokens: finalMessage.usage.output_tokens ?? 0,
          cacheReadTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
          cacheCreateTokens: finalMessage.usage.cache_creation_input_tokens ?? 0,
        };

        const toolUse = finalMessage.content.find(
          (b) => b.type === "tool_use" && b.name === "propose_investigation_draft",
        );

        if (!toolUse || toolUse.type !== "tool_use") {
          controller.enqueue(
            sseEvent("error", {
              message:
                "Argus did not return a structured draft. Try again with more detail.",
            }),
          );
          controller.enqueue(sseEvent("done", { reason: "error" }));
          controller.close();
          return;
        }

        const draft = toolUse.input as InvestigationDraftPayload;
        const refused = (draft.insufficient_input ?? "").trim().length > 0;

        // Persist the suggestion (pending). The acceptance flip happens in
        // argus-actions.ts when the user Pushes a section.
        const { suggestionId } = await logArgusSuggestion({
          orgId: gate.orgId,
          siteId: inv.site_id,
          userId: gate.user.id,
          surface: "investigator",
          targetKind: "investigation",
          targetId: inv.id,
          model: MODEL_SONNET,
          usage: {
            promptTokens: usage.inputTokens,
            completionTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheCreateTokens: usage.cacheCreateTokens,
          },
          payload: {
            kind: "investigator_draft",
            input: {
              paste: pasteText,
              witnessAddsCount: witnessAdds.length,
              existingWitnessesCount: existingWitnesses?.length ?? 0,
            },
            output: draft as unknown as Json,
            refused,
          },
          activityVerb: "argus.investigator_drafted",
          activityIncidentId: inv.incident.id,
          activityInvestigationId: inv.id,
        });

        controller.enqueue(sseEvent("draft", { suggestionId, draft }));
        controller.enqueue(sseEvent("usage", usage));
        controller.enqueue(
          sseEvent("done", {
            reason: refused ? "insufficient_input" : (finalMessage.stop_reason ?? "end_turn"),
          }),
        );
        controller.close();
      } catch (err) {
        controller.enqueue(
          sseEvent("error", {
            message: err instanceof Error ? err.message : String(err),
          }),
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

function countWords(s: string): number {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
