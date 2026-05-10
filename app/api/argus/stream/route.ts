import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runArgusGates } from "@/lib/argus/gates";
import { TIER_BY_SURFACE, type ArgusSurface } from "@/lib/argus/models";
import { argusErrorStream, streamArgusResponse } from "@/lib/argus/stream";
import { logArgusSuggestion } from "@/lib/argus/log";
import { redactText } from "@/lib/argus/redact";
import {
  DEFAULT_ARGUS_CONTEXT,
  type ArgusPageContext,
  type ArgusRecordKind,
  type ArgusRouteKey,
} from "@/lib/argus/page-context";

/**
 * Phase 9a "ping" endpoint — single-turn, no tool-use. POST { surface, prompt } → SSE.
 * Phase 9e widens the surface set with `panel_chat`: the global side panel
 * sends a `pageContext` payload alongside the prompt; the route handler
 * builds a system block grounded on the user's current page (route + record
 * summaries + small aggregates) and streams a single Flash turn.
 *
 * 9b's Copilot lives at `/api/argus/copilot` because it needs an agentic
 * tool-use loop; this endpoint stays single-shot for the panel + future
 * inline classifiers.
 */

type ArgusBody = {
  surface: "ping" | ArgusSurface;
  prompt?: string;
  pageContext?: unknown;
};

const PING_SYSTEM_PROMPT =
  "You are Argus, an EHS safety co-pilot. Be brief, specific, and action-oriented. You never finalize decisions — you suggest and let the human commit.";

let cachedPanelPrompt: string | null = null;
async function loadPanelSystemPrompt(): Promise<string> {
  if (cachedPanelPrompt) return cachedPanelPrompt;
  const filePath = path.join(
    process.cwd(),
    "lib/argus/system-prompts/panel.md",
  );
  cachedPanelPrompt = await fs.readFile(filePath, "utf-8");
  return cachedPanelPrompt;
}

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

  const isPanelChat = surface === "panel_chat";
  const pageContext = isPanelChat ? sanitizePageContext(body.pageContext) : null;
  const system = isPanelChat
    ? await buildPanelSystemPrompt(pageContext ?? DEFAULT_ARGUS_CONTEXT)
    : PING_SYSTEM_PROMPT;

  const stream = await gate.llm.streamText({
    surface,
    tier,
    system,
    messages: [{ role: "user", text: redactText(prompt) }],
  });

  return streamArgusResponse(stream, async (final, fullText) => {
    await logArgusSuggestion({
      orgId: gate.orgId,
      siteId: pageContext?.siteId ?? null,
      userId: gate.user.id,
      surface,
      targetKind: pickTargetKind(pageContext),
      targetId: pickTargetId(pageContext),
      model: final.modelUsed,
      usage: {
        promptTokens: final.usage.inputTokens,
        completionTokens: final.usage.outputTokens,
        cacheReadTokens: final.usage.cachedInputTokens,
        cacheCreateTokens: 0,
        thinkingTokens: final.usage.thinkingTokens,
      },
      payload: {
        prompt,
        response: fullText,
        ...(pageContext
          ? { pageContext: JSON.parse(JSON.stringify(pageContext)) }
          : {}),
      },
    });
  });
}

const VALID_ROUTES: ReadonlySet<ArgusRouteKey> = new Set([
  "dashboard",
  "incident_detail",
  "investigation_detail",
  "capa_detail",
  "inspection_detail",
  "capa_index",
  "inspections_index",
  "reports_index",
  "unknown",
]);

const VALID_RECORD_KINDS: ReadonlySet<ArgusRecordKind> = new Set([
  "incident",
  "investigation",
  "capa",
  "inspection",
  "report",
]);

/**
 * Defence-in-depth shape check + secondary redact pass on every free-text
 * field. Pages already redact their record titles before passing them to
 * `<ArgusContextPayload>`; this catches anything that slipped through.
 * Returns null if the payload is unusable.
 */
function sanitizePageContext(raw: unknown): ArgusPageContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const route =
    typeof r.route === "string" && VALID_ROUTES.has(r.route as ArgusRouteKey)
      ? (r.route as ArgusRouteKey)
      : "unknown";
  const routeLabel =
    typeof r.routeLabel === "string" && r.routeLabel.length > 0
      ? r.routeLabel.slice(0, 120)
      : "Argus";
  const siteId = typeof r.siteId === "string" ? r.siteId : null;
  const siteLabel =
    typeof r.siteLabel === "string" ? r.siteLabel.slice(0, 80) : null;

  const records = Array.isArray(r.records)
    ? r.records
        .slice(0, 5)
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const o = row as Record<string, unknown>;
          if (
            typeof o.kind !== "string" ||
            !VALID_RECORD_KINDS.has(o.kind as ArgusRecordKind)
          ) {
            return null;
          }
          return {
            kind: o.kind as ArgusRecordKind,
            id: typeof o.id === "string" ? o.id : "",
            refCode: typeof o.refCode === "string" ? o.refCode : null,
            title:
              typeof o.title === "string"
                ? redactText(o.title.slice(0, 200))
                : null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
    : [];

  const aggregates: Record<string, number> = {};
  if (r.aggregates && typeof r.aggregates === "object") {
    for (const [k, v] of Object.entries(r.aggregates as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        aggregates[k.slice(0, 40)] = v;
      }
    }
  }

  return {
    route,
    routeLabel: redactText(routeLabel),
    siteId,
    siteLabel: siteLabel ? redactText(siteLabel) : null,
    records,
    aggregates,
  };
}

async function buildPanelSystemPrompt(ctx: ArgusPageContext): Promise<string> {
  const base = await loadPanelSystemPrompt();
  const lines: string[] = [base.trim(), "", "# Page context"];
  lines.push(`Route: ${ctx.route}`);
  lines.push(`Route label: ${ctx.routeLabel}`);
  if (ctx.siteLabel) lines.push(`Site: ${ctx.siteLabel}`);
  if (ctx.aggregates && Object.keys(ctx.aggregates).length > 0) {
    lines.push("Aggregates:");
    for (const [k, v] of Object.entries(ctx.aggregates)) {
      lines.push(`  - ${k}: ${v}`);
    }
  }
  if (ctx.records && ctx.records.length > 0) {
    lines.push("Visible records:");
    for (const rec of ctx.records) {
      const ref = rec.refCode ? `${rec.refCode}` : `id ${rec.id.slice(0, 8)}`;
      const title = rec.title ? ` — ${rec.title}` : "";
      lines.push(`  - ${rec.kind} ${ref}${title}`);
    }
  } else {
    lines.push("Visible records: none on this page.");
  }
  return lines.join("\n");
}

function pickTargetKind(
  ctx: ArgusPageContext | null,
): "incident" | "investigation" | "capa" | "inspection" | "report" | "page" | null {
  if (!ctx) return null;
  // Detail pages key the audit row to the primary record; index pages key
  // it to 'page' so cross-user reads can hit the same row in a future cache.
  if (ctx.records && ctx.records.length > 0) {
    switch (ctx.route) {
      case "incident_detail":
        return "incident";
      case "investigation_detail":
        return "investigation";
      case "capa_detail":
        return "capa";
      case "inspection_detail":
        return "inspection";
    }
  }
  return "page";
}

function pickTargetId(ctx: ArgusPageContext | null): string | null {
  if (!ctx) return null;
  if (ctx.records && ctx.records.length > 0) {
    switch (ctx.route) {
      case "incident_detail":
      case "investigation_detail":
      case "capa_detail":
      case "inspection_detail":
        return ctx.records[0].id || null;
    }
  }
  return null;
}
