/**
 * Server-Sent Events helpers for Argus route handlers. Provider-agnostic —
 * works with any `StreamTextResult` from `@/lib/argus/llm`.
 *
 * Wire format:
 *   event: token   data: {"text": "..."}      // delta of model output
 *   event: usage   data: {<UsageNormalized>}  // emitted once at end
 *   event: done    data: {"reason": "..."}    // terminal — close after
 *   event: error   data: {"message": "..."}   // surfaced on adapter throw
 *
 * Clients consume via `EventSource` and accumulate `token` events into the
 * rendered text; `usage` flows to a billing meter; `done` closes the channel.
 *
 * Routes that need richer wire formats (Copilot's `tool_use` / `tool_result`,
 * Investigator's `progress` / `draft`) inline their own SSE pump and use
 * `sseFrame` + `argusErrorStream` only.
 */

import type { StreamTextFinal, StreamTextResult } from "./llm";

const encoder = new TextEncoder();

export function sseFrame(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

/**
 * Pipe a provider-agnostic `StreamTextResult` to an SSE Response. The optional
 * `onFinal` runs after the stream completes — pass it `logArgusSuggestion`
 * with the aggregate token totals and final model id.
 */
export function streamArgusResponse(
  stream: StreamTextResult,
  onFinal?: (final: StreamTextFinal, fullText: string) => Promise<void> | void,
): Response {
  let textBuffer = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream.textChunks) {
          if (!chunk.text) continue;
          textBuffer += chunk.text;
          controller.enqueue(sseFrame("token", { text: chunk.text }));
        }

        const final = await stream.finalMessage();

        controller.enqueue(sseFrame("usage", final.usage));

        if (onFinal) {
          await onFinal(final, textBuffer);
        }

        controller.enqueue(
          sseFrame("done", { reason: final.stopReason || "stop" }),
        );
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(sseFrame("error", { message }));
        controller.enqueue(sseFrame("done", { reason: "error" }));
        controller.close();
      }
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}

/** Quick offline / blocked / rate-limited response. Same wire format so the
 *  client can render a friendly message without a special branch. */
export function argusErrorStream(reason: string, status = 503): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sseFrame("error", { message: reason }));
      controller.enqueue(sseFrame("done", { reason: "error" }));
      controller.close();
    },
  });

  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
