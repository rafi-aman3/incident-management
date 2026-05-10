/**
 * Server-Sent Events helper for Argus route handlers. Wraps an Anthropic
 * `MessageStream` (or any async iterable of token events) into a Web
 * `Response` with `Content-Type: text/event-stream`.
 *
 * Wire format — three event types the client cares about:
 *   event: token   data: {"text": "..."}      // delta of model output
 *   event: usage   data: {"input": N, …}      // emitted once at end
 *   event: done    data: {"reason": "..."}    // terminal — close after
 *
 * The client side (`useArgusStream` hook in components/argus/) consumes
 * these via `EventSource` and accumulates `token` events into the rendered
 * text; `usage` is dispatched to a billing meter; `done` closes the channel.
 */

import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.mjs";

export interface ArgusStreamUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
}

const encoder = new TextEncoder();

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Pipe an Anthropic SDK stream to a Server-Sent Events Response. The caller
 * gets back a `Response` ready to return from a Next.js route handler.
 *
 * `onFinal` runs after the stream completes — use it to call `logArgusSuggestion`
 * with token totals.
 */
export function streamArgusResponse(
  messageStream: MessageStream,
  onFinal?: (usage: ArgusStreamUsage, fullText: string) => Promise<void> | void,
): Response {
  let textBuffer = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        messageStream.on("text", (delta) => {
          textBuffer += delta;
          controller.enqueue(sse("token", { text: delta }));
        });

        const final = await messageStream.finalMessage();

        const usage: ArgusStreamUsage = {
          inputTokens: final.usage.input_tokens ?? 0,
          outputTokens: final.usage.output_tokens ?? 0,
          cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
          cacheCreateTokens: final.usage.cache_creation_input_tokens ?? 0,
        };

        controller.enqueue(sse("usage", usage));

        if (onFinal) {
          await onFinal(usage, textBuffer);
        }

        controller.enqueue(sse("done", { reason: final.stop_reason ?? "end_turn" }));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(sse("error", { message }));
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Quick offline / blocked / rate-limited response. Same wire format so the
 *  client can render a friendly message without a special branch. */
export function argusErrorStream(reason: string, status = 503): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sse("error", { message: reason }));
      controller.enqueue(sse("done", { reason: "error" }));
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
