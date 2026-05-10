import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { getLLM, ArgusOfflineError, type LLMProvider } from "./llm";
import { checkArgusBudget } from "./budget";
import { checkRateLimit } from "./ratelimit";
import { argusErrorStream } from "./stream";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Centralized gate stack for every Argus surface. `/api/argus/stream` (9a),
 * `/api/argus/copilot` (9b), `/api/argus/investigator` (9c), and
 * `/api/argus/wand` (9d) all call this.
 *
 * Returns either `{ ok: true, … }` with a usable LLM provider + user context,
 * OR `{ ok: false, response }` with a pre-formed SSE error Response the route
 * handler should return verbatim. Client-side, all gate failures look
 * identical (an SSE `error` frame followed by `done`), so the panel can
 * render a friendly message without branching on HTTP.
 */
export interface GateOk {
  ok: true;
  llm: LLMProvider;
  supabase: SupabaseClient<Database>;
  user: User;
  orgId: string;
}
export interface GateFail {
  ok: false;
  response: Response;
}
export type GateResult = GateOk | GateFail;

/** Bucket inferred from surface name. Heavy = smart-tier deep analyses. */
const HEAVY_SURFACES = new Set<string>([
  "investigator",
  "capa_draft",
  "reportability",
  "capa_metadata",
]);

export async function runArgusGates(surface: string): Promise<GateResult> {
  const { user, profile, supabase } = await requireUser();

  if (!(await orgCan("argus:use"))) {
    return {
      ok: false,
      response: argusErrorStream("Argus is not enabled for your role.", 403),
    };
  }

  // org_id present on every profile post-Phase-12; treat unset as auth fail.
  if (!profile.org_id) {
    return {
      ok: false,
      response: argusErrorStream("No organization on profile.", 403),
    };
  }

  const bucket = HEAVY_SURFACES.has(surface) ? "heavy" : "inline";
  const rl = checkRateLimit(user.id, bucket);
  if (!rl.allowed) {
    return {
      ok: false,
      response: argusErrorStream(
        `You are sending Argus requests too quickly. Try again in ${Math.ceil(rl.resetMs / 1000)}s.`,
        429,
      ),
    };
  }

  let budget;
  try {
    budget = await checkArgusBudget(profile.org_id);
  } catch (err) {
    return {
      ok: false,
      response: argusErrorStream(
        `Could not verify Argus budget: ${err instanceof Error ? err.message : String(err)}`,
        500,
      ),
    };
  }
  if (budget.blocked) {
    return {
      ok: false,
      response: argusErrorStream(
        "Your organization has reached today's Argus token budget. Try again tomorrow.",
        429,
      ),
    };
  }

  const llm = getLLM();
  if (!llm.isConfigured()) {
    return {
      ok: false,
      response: argusErrorStream(
        "Argus is offline (no API key configured).",
        503,
      ),
    };
  }

  // Surfaces a friendly 503 rather than a 500 if the adapter throws on
  // construction (e.g. malformed key picked up at first call).
  try {
    llm.isConfigured();
  } catch (err) {
    if (err instanceof ArgusOfflineError) {
      return { ok: false, response: argusErrorStream(err.message, 503) };
    }
    throw err;
  }

  return { ok: true, llm, supabase, user, orgId: profile.org_id };
}
