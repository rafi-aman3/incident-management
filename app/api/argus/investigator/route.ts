import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runArgusGates } from "@/lib/argus/gates";
import { argusErrorStream, sseFrame } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";
import {
  INVESTIGATOR_TOOL,
  type InvestigationDraftPayload,
} from "@/lib/argus/tools";
import { redactText, initialsOf } from "@/lib/argus/redact";
import { can } from "@/lib/auth/can";
import { ArgusInvalidResponseError } from "@/lib/argus/llm";
import type { Json } from "@/lib/supabase/types";

/**
 * Phase 9c — AI Investigator. POST { investigationId, paste, witnessAdds[] } →
 * SSE stream:
 *   event: progress  data: {"phase":"reading"|"thinking"}
 *   event: draft     data: {<InvestigationDraftPayload>, suggestionId}
 *   event: usage     data: {<UsageNormalized>}
 *   event: error     data: {"message":"…"}
 *   event: done      data: {"reason":"end_turn"|"insufficient_input"|"error"}
 *
 * One Gemini 2.5 Pro call per request — no agentic loop. Forced function
 * calling guarantees the model emits a single function call matching our
 * `propose_investigation_draft` schema. The user reviews, edits, and Pushes
 * per-section in the UI; the draft does NOT persist to
 * `investigations.{findings, root_cause_summary}` or `rca_whys` until the user
 * clicks Push (gated on `investigation:edit` via the existing actions).
 */

let cachedSystemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const filePath = path.join(
    process.cwd(),
    "lib/argus/system-prompts/investigator.md",
  );
  cachedSystemPrompt = await fs.readFile(filePath, "utf-8");
  return cachedSystemPrompt;
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
    return argusErrorStream(
      "You do not have permission to edit this investigation.",
      403,
    );
  }

  const { data: existingWitnesses } = await gate.supabase
    .from("witnesses")
    .select("name, statement")
    .eq("incident_id", inv.incident.id);

  const knownNames = [
    ...(inv.incident.injured_persons ?? []).map((p) => p.name),
    ...(existingWitnesses ?? []).map((w) => w.name),
    ...(body.witnessAdds ?? []).map((w) => w.name),
  ]
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((fullName) => ({ fullName, initials: initialsOf(fullName) }));

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
    (existingWitnesses ?? []).reduce(
      (acc, w) => acc + countWords(w.statement ?? ""),
      0,
    ) +
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
            (w) =>
              `- ${initialsOf(w.name)}: "${redactText(w.statement, knownNames)}"`,
          ),
        ]),
    "",
    "# Additional context",
    pasteText ? redactText(pasteText, knownNames) : "(none)",
  ].join("\n");

  const responseBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sseFrame("progress", { phase: "reading" }));

      try {
        controller.enqueue(sseFrame("progress", { phase: "thinking" }));

        const result = await gate.llm.generateStructured<InvestigationDraftPayload>({
          surface: "investigator",
          tier: "smart",
          system: systemPrompt,
          user: userBlock,
          tool: INVESTIGATOR_TOOL,
          maxOutputTokens: 4096,
          thinking: "auto",
        });

        const draft = result.output;
        const refused = (draft.insufficient_input ?? "").trim().length > 0;

        const { suggestionId } = await logArgusSuggestion({
          orgId: gate.orgId,
          siteId: inv.site_id,
          userId: gate.user.id,
          surface: "investigator",
          targetKind: "investigation",
          targetId: inv.id,
          model: result.modelUsed,
          usage: {
            promptTokens: result.usage.inputTokens,
            completionTokens: result.usage.outputTokens,
            cacheReadTokens: result.usage.cachedInputTokens,
            cacheCreateTokens: 0,
            thinkingTokens: result.usage.thinkingTokens,
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

        controller.enqueue(sseFrame("draft", { suggestionId, draft }));
        controller.enqueue(sseFrame("usage", result.usage));
        controller.enqueue(
          sseFrame("done", {
            reason: refused ? "insufficient_input" : "end_turn",
          }),
        );
        controller.close();
      } catch (err) {
        const message =
          err instanceof ArgusInvalidResponseError
            ? "Argus did not return a structured draft. Try again with more detail."
            : err instanceof Error
              ? err.message
              : String(err);
        controller.enqueue(sseFrame("error", { message }));
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

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
