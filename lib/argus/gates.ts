import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { isArgusConfigured, getArgusClient, ArgusOfflineError } from "./client";
import { checkArgusBudget } from "./budget";
import { checkRateLimit } from "./ratelimit";
import { argusErrorStream } from "./stream";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Centralized gate stack for every Argus surface. Both `/api/argus/stream`
 * (9a ping) and `/api/argus/copilot` (9b) call this; future surfaces in
 * 9c–9e will too.
 *
 * Returns either `{ ok: true, … }` with a usable Anthropic client + user
 * context, OR `{ ok: false, response }` with a pre-formed SSE error
 * Response the route handler should return verbatim. Client-side, all
 * gate failures look identical (an SSE `error` frame followed by `done`),
 * so the panel can render a friendly message without branching on HTTP.
 */
export interface GateOk {
  ok: true;
  client: Anthropic;
  supabase: SupabaseClient<Database>;
  user: User;
  orgId: string;
}
export interface GateFail {
  ok: false;
  response: Response;
}
export type GateResult = GateOk | GateFail;

/** Bucket inferred from surface name. Heavy = Sonnet-tier deep analyses. */
const HEAVY_SURFACES = new Set<string>(["investigator", "capa_draft", "reportability"]);

export async function runArgusGates(surface: string): Promise<GateResult> {
  const { user, profile, supabase } = await requireUser();

  if (!(await orgCan("argus:use"))) {
    return { ok: false, response: argusErrorStream("Argus is not enabled for your role.", 403) };
  }

  // org_id present on every profile post-Phase-12; treat unset as auth fail.
  if (!profile.org_id) {
    return { ok: false, response: argusErrorStream("No organization on profile.", 403) };
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

  if (!isArgusConfigured()) {
    return { ok: false, response: argusErrorStream("Argus is offline (no API key configured).", 503) };
  }

  let client;
  try {
    client = getArgusClient();
  } catch (err) {
    if (err instanceof ArgusOfflineError) {
      return { ok: false, response: argusErrorStream(err.message, 503) };
    }
    throw err;
  }

  return { ok: true, client, supabase, user, orgId: profile.org_id };
}
