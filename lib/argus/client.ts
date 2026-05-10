import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic SDK singleton. Server-only — `ANTHROPIC_API_KEY` must never reach
 * the browser. The route handler in `app/api/argus/stream/route.tsx` and the
 * server actions in `lib/argus/log.ts` are the only places this should be
 * imported from; UI components should call those, not this client directly.
 */
let cachedClient: Anthropic | null = null;

export function getArgusClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ArgusOfflineError(
        "ANTHROPIC_API_KEY is not set — Argus is offline.",
      );
    }
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

export function isArgusConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Thrown when the SDK can't be instantiated (e.g. missing key). The route
 *  handler converts this to a 503 'AI is offline' response, not a 500. */
export class ArgusOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgusOfflineError";
  }
}
