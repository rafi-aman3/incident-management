import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { runArgusGates } from "@/lib/argus/gates";
import { logArgusSuggestion } from "@/lib/argus/log";
import { WAND_TOOLS, type WandSurface } from "@/lib/argus/tools";
import { redactText, initialsOf } from "@/lib/argus/redact";
import { can } from "@/lib/auth/can";
import { ArgusInvalidResponseError } from "@/lib/argus/llm";
import type { Json } from "@/lib/supabase/types";

/**
 * Phase 9d — Argus magic wands. POST { surface, payload } → JSON envelope:
 *   { ok: true,  suggestionId, output, modelUsed, usage }
 *   { ok: false, error }
 *
 * Non-streaming. Sub-second on Flash, 2–8s on Pro with thinking. SSE is
 * reserved for Copilot (multi-turn) and Investigator (progress event).
 *
 * Reportability uses a 24h cache keyed on incident.updated_at — repeated
 * OSHA-300 page loads with the same incident don't re-bill the model.
 *
 * No new RBAC keys. Visibility: argus:use + the surface's underlying write
 * permission (incident:create / capa:verify / capa:create / report:read).
 */

type WandBody =
  | {
      surface: "risk_matrix";
      payload: {
        incidentId: string;
        description: string;
        type: string;
        area?: string;
      };
    }
  | {
      surface: "finding_severity";
      payload: {
        findingId: string;
        siteId: string;
        description: string;
        hazardCategory?: string;
      };
    }
  | {
      surface: "verification_method";
      payload: {
        capaId: string;
        siteId: string;
        capaSummary: string;
      };
    }
  | {
      surface: "reportability";
      payload: {
        incidentId: string;
        jurisdiction: "US" | "GB";
      };
    }
  | {
      surface: "capa_metadata";
      payload: {
        investigationId: string;
        siteId: string;
      };
    }
  | {
      surface: "hazard_controls";
      payload: {
        siteId: string;
        candidateId?: string;
        hazardId?: string;
        title: string;
        category: string;
        description?: string;
        proposedMetadata?: Record<string, unknown>;
      };
    }
  | {
      surface: "step_hazards";
      payload: {
        siteId: string;
        jsaId: string;
        jobTitle: string;
        jobDescription?: string;
        area?: string;
        stepDescription: string;
      };
    }
  | {
      surface: "step_controls";
      payload: {
        siteId: string;
        jsaId: string;
        jobTitle: string;
        area?: string;
        stepDescription: string;
        hazardDescription: string;
        hazardCategory: string;
        likelihood: string;
        consequence: string;
      };
    };

const REPORTABILITY_CACHE_HOURS = 24;

// Zod mirrors of each tool's schema for defence-in-depth validation. The model
// has already constrained itself to the JSONSchema, but a malformed extra key
// or wrong type would otherwise pass through verbatim.
const matrixOutputSchema = z.object({
  likelihood: z.number().int().min(1).max(5),
  consequence: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  insufficient_input: z.string().optional(),
});

const verificationOutputSchema = z.object({
  method: z.enum([
    "inspection",
    "monitoring",
    "audit_trend",
    "re_interview",
    "document_review",
  ]),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  insufficient_input: z.string().optional(),
});

const reportabilityOutputSchema = z.object({
  verdict: z.enum(["reportable", "not_reportable", "uncertain"]),
  citation: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  threshold_met: z.array(z.string()),
  insufficient_input: z.string().optional(),
});

const capaMetadataOutputSchema = z.object({
  type: z.enum(["corrective", "preventive"]),
  title: z.string().max(80),
  suggested_owner_role: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  insufficient_input: z.string().optional(),
});

const hazardControlsOutputSchema = z.object({
  controls: z
    .array(
      z.object({
        level: z.enum(["elimination", "substitution", "engineering", "administrative", "ppe"]),
        description: z.string().min(10).max(300),
        rationale: z.string().min(10).max(200),
      }),
    )
    .min(2)
    .max(6),
  ppe_only_warning: z.boolean().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  insufficient_input: z.string().optional(),
});

const stepHazardsOutputSchema = z.object({
  hazards: z
    .array(
      z.object({
        hazard_description: z.string().min(8).max(240),
        hazard_category: z.enum([
          "physical",
          "chemical",
          "biological",
          "psychosocial",
          "mechanical",
          "electrical",
          "ergonomic",
          "environmental",
        ]),
        likelihood: z.enum(["rare", "unlikely", "possible", "likely", "almost_certain"]),
        consequence: z.enum(["insignificant", "minor", "moderate", "major", "catastrophic"]),
        rationale: z.string().min(10).max(240),
      }),
    )
    .min(2)
    .max(6),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  insufficient_input: z.string().optional(),
});

const stepControlsOutputSchema = z.object({
  controls: z
    .array(
      z.object({
        control_level: z.enum([
          "elimination",
          "substitution",
          "engineering",
          "administrative",
          "ppe",
        ]),
        control_description: z.string().min(10).max(300),
        rationale: z.string().min(10).max(200),
      }),
    )
    .min(2)
    .max(6),
  ppe_only_warning: z.boolean().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  insufficient_input: z.string().optional(),
});

const SCHEMAS_BY_SURFACE: Record<WandSurface, z.ZodType<unknown>> = {
  risk_matrix: matrixOutputSchema,
  finding_severity: matrixOutputSchema,
  verification_method: verificationOutputSchema,
  reportability: reportabilityOutputSchema,
  capa_metadata: capaMetadataOutputSchema,
  hazard_controls: hazardControlsOutputSchema,
  step_hazards: stepHazardsOutputSchema,
  step_controls: stepControlsOutputSchema,
};

const SYSTEM_PROMPT_BY_SURFACE: Record<WandSurface, string> = {
  risk_matrix: "wand-risk-matrix.md",
  finding_severity: "wand-finding-severity.md",
  verification_method: "wand-verification-method.md",
  reportability: "wand-reportability.md",
  capa_metadata: "wand-capa-metadata.md",
  hazard_controls: "wand-hazard-controls.md",
  step_hazards: "wand-step-hazards.md",
  step_controls: "wand-step-controls.md",
};

const promptCache = new Map<string, string>();
async function loadPrompt(file: string): Promise<string> {
  const cached = promptCache.get(file);
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "lib/argus/system-prompts", file);
  const text = await fs.readFile(filePath, "utf-8");
  promptCache.set(file, text);
  return text;
}

function jsonError(error: string, status = 400): Response {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let body: WandBody;
  try {
    body = (await request.json()) as WandBody;
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  if (!body || !body.surface) {
    return jsonError("surface is required.", 400);
  }

  const gate = await runArgusGates(body.surface);
  if (!gate.ok) {
    // Gate returns SSE for streaming routes; for the wand route we want JSON.
    // Read the body and translate; status code is preserved.
    const text = await gate.response.text();
    const message =
      /data: (\{.*"message":\s*"([^"]+)".*\})/.exec(text)?.[2] ??
      "Argus is unavailable.";
    return jsonError(message, gate.response.status);
  }

  switch (body.surface) {
    case "risk_matrix":
      return await handleRiskMatrix(gate, body.payload);
    case "finding_severity":
      return await handleFindingSeverity(gate, body.payload);
    case "verification_method":
      return await handleVerificationMethod(gate, body.payload);
    case "reportability":
      return await handleReportability(gate, body.payload);
    case "capa_metadata":
      return await handleCapaMetadata(gate, body.payload);
    case "hazard_controls":
      return await handleHazardControls(gate, body.payload);
    case "step_hazards":
      return await handleStepHazards(gate, body.payload);
    case "step_controls":
      return await handleStepControls(gate, body.payload);
    default: {
      const _: never = body;
      void _;
      return jsonError("Unknown surface.", 400);
    }
  }
}

type Gate = Extract<Awaited<ReturnType<typeof runArgusGates>>, { ok: true }>;

// ---------- Wand 1 — risk_matrix ----------

async function handleRiskMatrix(
  gate: Gate,
  payload: Extract<WandBody, { surface: "risk_matrix" }>["payload"],
) {
  const { data: incident, error } = await gate.supabase
    .from("incidents")
    .select("id, site_id, reporter_id, status")
    .eq("id", payload.incidentId)
    .maybeSingle();

  if (error || !incident) return jsonError("Incident not found.", 404);
  if (incident.reporter_id !== gate.user.id) {
    return jsonError("You are not the reporter of this draft.", 403);
  }

  const knownNames = await knownNamesForIncident(gate, incident.id);

  const userBlock = [
    "# Incident",
    `Type: ${payload.type}`,
    payload.area ? `Area: ${payload.area}` : null,
    "",
    "# Description",
    redactText(payload.description, knownNames),
  ]
    .filter(Boolean)
    .join("\n");

  return await callWand({
    gate,
    surface: "risk_matrix",
    tier: "fast",
    userBlock,
    targetKind: "incident",
    targetId: incident.id,
    siteId: incident.site_id,
    activityIncidentId: incident.id,
  });
}

// ---------- Wand 2 — finding_severity ----------

async function handleFindingSeverity(
  gate: Gate,
  payload: Extract<WandBody, { surface: "finding_severity" }>["payload"],
) {
  if (!(await can("finding:escalate", payload.siteId))) {
    return jsonError(
      "You do not have permission to escalate findings on this site.",
      403,
    );
  }

  const userBlock = [
    "# Inspection finding (closed)",
    payload.hazardCategory ? `Hazard category: ${payload.hazardCategory}` : null,
    "",
    "# Observed condition",
    payload.description,
  ]
    .filter(Boolean)
    .join("\n");

  return await callWand({
    gate,
    surface: "finding_severity",
    tier: "fast",
    userBlock,
    targetKind: "finding",
    targetId: payload.findingId,
    siteId: payload.siteId,
  });
}

// ---------- Wand 3 — verification_method ----------

async function handleVerificationMethod(
  gate: Gate,
  payload: Extract<WandBody, { surface: "verification_method" }>["payload"],
) {
  if (!(await can("capa:verify", payload.siteId))) {
    return jsonError(
      "You do not have permission to verify CAPAs on this site.",
      403,
    );
  }

  const userBlock = `# CAPA action description\n\n${payload.capaSummary}`;

  return await callWand({
    gate,
    surface: "verification_method",
    tier: "fast",
    userBlock,
    targetKind: "capa",
    targetId: payload.capaId,
    siteId: payload.siteId,
    activityCapaId: payload.capaId,
  });
}

// ---------- Wand 4 — reportability (read-only, with 24h cache) ----------

async function handleReportability(
  gate: Gate,
  payload: Extract<WandBody, { surface: "reportability" }>["payload"],
) {
  const { data: incident, error } = await gate.supabase
    .from("incidents")
    .select(
      `id, site_id, type, title, description, occurred_at, area, location,
       updated_at,
       injured_persons ( name, treatment, days_away, days_restricted, fatality, hospitalized )`,
    )
    .eq("id", payload.incidentId)
    .maybeSingle();

  if (error || !incident) return jsonError("Incident not found.", 404);

  // 24h cache: same target, model output captured while incident.updated_at
  // hasn't changed since. Kept as a key in the suggestion payload so we can
  // invalidate by mutation rather than purely by clock.
  const sinceMs = REPORTABILITY_CACHE_HOURS * 60 * 60 * 1000;
  const sinceISO = new Date(Date.now() - sinceMs).toISOString();
  const { data: cached } = await gate.supabase
    .from("argus_suggestions")
    .select("id, payload, created_at, model")
    .eq("surface", "reportability")
    .eq("target_kind", "incident")
    .eq("target_id", incident.id)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    cached &&
    typeof cached.payload === "object" &&
    cached.payload !== null &&
    !Array.isArray(cached.payload) &&
    (cached.payload as Record<string, Json>).incident_updated_at ===
      incident.updated_at
  ) {
    const c = cached.payload as Record<string, Json>;
    return NextResponse.json({
      ok: true,
      suggestionId: cached.id,
      output: c.output ?? null,
      modelUsed: cached.model,
      usage: null,
      cached: true,
    });
  }

  const knownNames = await knownNamesForIncident(gate, incident.id);

  const userBlock = [
    `# Incident IR-${incident.id.slice(0, 8)}`,
    `Type: ${incident.type}`,
    `Jurisdiction: ${payload.jurisdiction === "US" ? "United States — OSHA / 29 CFR 1904" : "United Kingdom — RIDDOR 2013"}`,
    `Occurred: ${incident.occurred_at}`,
    incident.area ? `Area: ${incident.area}` : null,
    incident.location ? `Location: ${incident.location}` : null,
    "",
    "# Title",
    incident.title,
    "",
    "# Description",
    redactText(incident.description ?? "(no description)", knownNames),
    "",
    "# Injured persons / outcomes",
    (incident.injured_persons ?? [])
      .map((p) => {
        const parts: string[] = [`- ${initialsOf(p.name ?? "")}`];
        if (p.treatment) parts.push(`treatment: ${p.treatment}`);
        if (p.days_away != null) parts.push(`days away: ${p.days_away}`);
        if (p.days_restricted != null)
          parts.push(`days restricted: ${p.days_restricted}`);
        if (p.fatality) parts.push(`fatality`);
        if (p.hospitalized) parts.push(`hospitalized`);
        return parts.join(", ");
      })
      .join("\n") || "(none recorded)",
  ]
    .filter(Boolean)
    .join("\n");

  return await callWand({
    gate,
    surface: "reportability",
    tier: "smart",
    thinking: "auto",
    userBlock,
    targetKind: "incident",
    targetId: incident.id,
    siteId: incident.site_id,
    activityIncidentId: incident.id,
    extraPayload: { incident_updated_at: incident.updated_at },
  });
}

// ---------- Wand 5 — capa_metadata ----------

async function handleCapaMetadata(
  gate: Gate,
  payload: Extract<WandBody, { surface: "capa_metadata" }>["payload"],
) {
  if (!(await can("capa:create", payload.siteId))) {
    return jsonError(
      "You do not have permission to create CAPAs on this site.",
      403,
    );
  }

  const { data: inv, error } = await gate.supabase
    .from("investigations")
    .select(
      `id, findings, root_cause_summary,
       incident:incident_id (
         type, title, area
       )`,
    )
    .eq("id", payload.investigationId)
    .maybeSingle();

  if (error || !inv) return jsonError("Investigation not found.", 404);

  const userBlock = [
    "# Source incident",
    inv.incident
      ? `Type: ${inv.incident.type} · Area: ${inv.incident.area ?? "(unspecified)"} · Title: ${inv.incident.title}`
      : "(unavailable)",
    "",
    "# Root-cause summary",
    inv.root_cause_summary?.trim() || "(empty)",
    "",
    "# Findings",
    inv.findings?.trim() || "(empty)",
  ].join("\n");

  return await callWand({
    gate,
    surface: "capa_metadata",
    tier: "smart",
    thinking: "auto",
    userBlock,
    targetKind: "investigation",
    targetId: inv.id,
    siteId: payload.siteId,
    activityInvestigationId: inv.id,
  });
}

// ---------- Wand 6 — hazard_controls (Phase 14) ----------

async function handleHazardControls(
  gate: Gate,
  payload: Extract<WandBody, { surface: "hazard_controls" }>["payload"],
) {
  if (!(await can("hazard:report", payload.siteId))) {
    return jsonError(
      "You do not have permission to suggest controls on this site.",
      403,
    );
  }

  // Target the candidate row when available; fall back to hazard or site.
  const targetKind: "incident" | "investigation" | "capa" | "finding" = "finding";
  // Note: argus_suggestions.target_kind is a free-form text in the v1 schema —
  // 'finding' is the closest existing taxonomy member. The Phase 14 wand
  // doesn't need a new target_kind row to be useful.
  const targetId = payload.candidateId ?? payload.hazardId ?? payload.siteId;

  // Strip free-text user input through the PII redactor before egress.
  const safeTitle = redactText(payload.title, []);
  const safeDescription = payload.description
    ? redactText(payload.description, [])
    : "(no description)";

  let metadataBlock = "";
  const md = payload.proposedMetadata;
  if (md && typeof md === "object") {
    const sdsId = typeof md.sds_id === "string" ? md.sds_id : null;
    const cas = typeof md.cas_number === "string" ? md.cas_number : null;
    const productName = typeof md.product_name === "string" ? md.product_name : null;
    const hStatement = typeof md.h_statement === "string" ? md.h_statement : null;
    const signal = typeof md.signal_word === "string" ? md.signal_word : null;
    const pictograms = Array.isArray(md.pictograms) ? md.pictograms.filter((p) => typeof p === "string") : [];
    const suggestedFromSds = Array.isArray(md.suggested_controls) ? md.suggested_controls : [];

    if (productName || sdsId || hStatement) {
      const lines: string[] = ["# SDS source"];
      if (productName) lines.push(`Product: ${productName}`);
      if (cas) lines.push(`CAS: ${cas}`);
      if (sdsId) lines.push(`SDS ID: ${sdsId}`);
      if (signal) lines.push(`Signal word: ${signal}`);
      if (pictograms.length > 0) lines.push(`Pictograms: ${pictograms.join(", ")}`);
      if (hStatement) lines.push(`H-statement: ${hStatement}`);
      if (suggestedFromSds.length > 0) {
        lines.push("");
        lines.push("Baseline suggestions from SDS catalog (use as starting point but consider hierarchy):");
        for (const sc of suggestedFromSds) {
          if (sc && typeof sc === "object" && "level" in sc && "description" in sc) {
            const c = sc as { level: string; description: string };
            lines.push(`- [${c.level}] ${c.description}`);
          }
        }
      }
      metadataBlock = "\n\n" + lines.join("\n");
    }
  }

  const userBlock =
    [
      "# Hazard",
      `Category: ${payload.category}`,
      `Title: ${safeTitle}`,
      "",
      "# Description",
      safeDescription,
    ].join("\n") + metadataBlock;

  return await callWand({
    gate,
    surface: "hazard_controls",
    tier: "smart",
    thinking: "auto",
    userBlock,
    targetKind,
    targetId,
    siteId: payload.siteId,
  });
}

// ---------- Wand 7 — step_hazards (Phase 15) ----------

async function handleStepHazards(
  gate: Gate,
  payload: Extract<WandBody, { surface: "step_hazards" }>["payload"],
) {
  if (!(await can("jsa:draft", payload.siteId))) {
    return jsonError("You do not have permission to draft JSAs on this site.", 403);
  }
  // PII redaction defence-in-depth: free-text step descriptions can leak names.
  const safeStep = redactText(payload.stepDescription, []);
  const safeJobTitle = redactText(payload.jobTitle, []);
  const safeJobDescription = payload.jobDescription
    ? redactText(payload.jobDescription, [])
    : null;

  const userBlock = [
    "# Job",
    `Title: ${safeJobTitle}`,
    payload.area ? `Area: ${payload.area}` : null,
    safeJobDescription ? `\nDescription: ${safeJobDescription}` : null,
    "",
    "# Step",
    safeStep,
  ]
    .filter(Boolean)
    .join("\n");

  return await callWand({
    gate,
    surface: "step_hazards",
    tier: "smart",
    thinking: "auto",
    userBlock,
    targetKind: "finding",
    targetId: payload.jsaId,
    siteId: payload.siteId,
  });
}

// ---------- Wand 8 — step_controls (Phase 15) ----------

async function handleStepControls(
  gate: Gate,
  payload: Extract<WandBody, { surface: "step_controls" }>["payload"],
) {
  if (!(await can("jsa:draft", payload.siteId))) {
    return jsonError("You do not have permission to draft JSAs on this site.", 403);
  }
  const safeStep = redactText(payload.stepDescription, []);
  const safeJobTitle = redactText(payload.jobTitle, []);
  const safeHazard = redactText(payload.hazardDescription, []);

  const userBlock = [
    "# Job",
    `Title: ${safeJobTitle}`,
    payload.area ? `Area: ${payload.area}` : null,
    "",
    "# Step",
    safeStep,
    "",
    "# Hazard",
    `Category: ${payload.hazardCategory}`,
    `Likelihood: ${payload.likelihood}`,
    `Consequence: ${payload.consequence}`,
    "",
    `Description: ${safeHazard}`,
  ]
    .filter(Boolean)
    .join("\n");

  return await callWand({
    gate,
    surface: "step_controls",
    tier: "smart",
    thinking: "auto",
    userBlock,
    targetKind: "finding",
    targetId: payload.jsaId,
    siteId: payload.siteId,
  });
}

// ---------- Shared core ----------

async function callWand(args: {
  gate: Gate;
  surface: WandSurface;
  tier: "fast" | "smart";
  thinking?: "auto" | "off";
  userBlock: string;
  targetKind: "incident" | "investigation" | "capa" | "finding";
  targetId: string;
  siteId: string;
  activityIncidentId?: string;
  activityInvestigationId?: string;
  activityCapaId?: string;
  extraPayload?: Record<string, Json>;
}) {
  const tool = WAND_TOOLS[args.surface];
  const systemPrompt = await loadPrompt(SYSTEM_PROMPT_BY_SURFACE[args.surface]);
  const validator = SCHEMAS_BY_SURFACE[args.surface];

  let result;
  try {
    result = await args.gate.llm.generateStructured({
      surface: args.surface,
      tier: args.tier,
      thinking: args.thinking,
      system: systemPrompt,
      user: args.userBlock,
      tool,
      maxOutputTokens: args.tier === "smart" ? 2048 : 768,
    });
  } catch (err) {
    const message =
      err instanceof ArgusInvalidResponseError
        ? "Argus did not return a structured suggestion."
        : err instanceof Error
          ? err.message
          : String(err);
    return jsonError(message, 502);
  }

  const validated = validator.safeParse(result.output);
  if (!validated.success) {
    return jsonError(
      `Argus returned a malformed suggestion: ${validated.error.issues[0]?.message ?? "schema mismatch"}`,
      502,
    );
  }

  const insufficient =
    typeof (validated.data as { insufficient_input?: string })
      .insufficient_input === "string" &&
    (validated.data as { insufficient_input?: string }).insufficient_input!
      .trim().length > 0;

  const { suggestionId } = await logArgusSuggestion({
    orgId: args.gate.orgId,
    siteId: args.siteId,
    userId: args.gate.user.id,
    surface: args.surface,
    targetKind: args.targetKind,
    targetId: args.targetId,
    model: result.modelUsed,
    usage: {
      promptTokens: result.usage.inputTokens,
      completionTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cachedInputTokens,
      cacheCreateTokens: 0,
      thinkingTokens: result.usage.thinkingTokens,
    },
    payload: {
      kind: "wand",
      output: validated.data as unknown as Json,
      ...(args.extraPayload ?? {}),
    },
    activityVerb: "argus.wand_suggested",
    activityIncidentId: args.activityIncidentId ?? null,
    activityInvestigationId: args.activityInvestigationId ?? null,
    activityCapaId: args.activityCapaId ?? null,
  });

  return NextResponse.json({
    ok: true,
    suggestionId,
    output: validated.data,
    modelUsed: result.modelUsed,
    usage: result.usage,
    cached: false,
    insufficient,
  });
}

async function knownNamesForIncident(gate: Gate, incidentId: string) {
  const { data: injured } = await gate.supabase
    .from("injured_persons")
    .select("name")
    .eq("incident_id", incidentId);
  const { data: witnesses } = await gate.supabase
    .from("witnesses")
    .select("name")
    .eq("incident_id", incidentId);
  return [
    ...(injured ?? []).map((r) => r.name),
    ...(witnesses ?? []).map((r) => r.name),
  ]
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((fullName) => ({ fullName, initials: initialsOf(fullName) }));
}
