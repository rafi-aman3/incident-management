"use client";

import { useState, useTransition } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useArgusPageContext } from "@/components/argus/argus-context";
import {
  ARGUS_PANEL_SUGGESTIONS,
  type ArgusPageContext,
} from "@/lib/argus/page-context";

/**
 * Phase 9a — empty Argus side panel shell, upgraded in 9e to be
 * page-context-aware.
 *
 * The panel:
 *   - reads the active `<ArgusContextPayload>` registration via
 *     `useArgusPageContext()`
 *   - renders a header chip showing the route + (when known) the current site
 *   - offers per-route suggestion chips that auto-fill + auto-submit
 *   - posts to `/api/argus/stream` with `surface: 'panel_chat'` and the
 *     redacted page-context payload, which the route handler uses to build
 *     the system prompt
 *
 * Cyan (`#00D4FF`) is the Argus accent — held dormant in v1 per
 * `docs/design.md`, promoted now to mark AI-active states. Brand purple
 * (#735CDD) stays for "AI-suggested" form-field treatments.
 *
 * Multi-turn conversation, persistent compose lane, and the side-panel
 * dot-indicator come in a follow-up slice; this commit keeps the existing
 * single-turn UX and adds the context plumbing.
 */
export function ArgusSidePanel({ initialOpen = false }: { initialOpen?: boolean }) {
  const pageContext = useArgusPageContext();
  const [open, setOpen] = useState(initialOpen);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isStreaming, setIsStreaming] = useState(false);

  const suggestions = ARGUS_PANEL_SUGGESTIONS[pageContext.route] ?? [];
  const headerChip = buildHeaderChip(pageContext);

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setResponse("");
    setError(null);
    setIsStreaming(true);

    startTransition(async () => {
      try {
        const res = await fetch("/api/argus/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surface: "panel_chat",
            prompt: trimmed,
            pageContext,
          }),
        });

        if (!res.body) {
          setError("Empty response from Argus.");
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl;
          while ((nl = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 2);
            const eventMatch = frame.match(/^event: (.+)$/m);
            const dataMatch = frame.match(/^data: (.+)$/m);
            if (!eventMatch || !dataMatch) continue;
            const evt = eventMatch[1];
            try {
              const data = JSON.parse(dataMatch[1]);
              if (evt === "token") {
                setResponse((prev) => prev + (data.text ?? ""));
              } else if (evt === "error") {
                setError(data.message ?? "Argus error.");
              }
            } catch {
              // Malformed frame — ignore.
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStreaming(false);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitPrompt(prompt);
  }

  function handleSuggestion(s: string) {
    setPrompt(s);
    submitPrompt(s);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            pageContext.hasActiveSignal
              ? "Ask Argus — attention needed"
              : "Ask Argus"
          }
          title={
            pageContext.hasActiveSignal
              ? "Ask Argus — attention needed"
              : "Ask Argus"
          }
          className="relative"
        >
          <Sparkles className="h-4 w-4" style={{ color: "var(--argus-accent, #00D4FF)" }} />
          {pageContext.hasActiveSignal && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-background"
              style={{ backgroundColor: "var(--argus-accent, #00D4FF)" }}
            />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--argus-accent, #00D4FF)" }} />
            Argus
          </SheetTitle>
          {headerChip && (
            <div
              className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              style={{ borderColor: "var(--argus-accent, #00D4FF)" }}
            >
              {headerChip}
            </div>
          )}
          <SheetDescription>
            Your AI safety co-pilot. Argus suggests — you decide. Severity, CAPA closure,
            and regulatory submissions always need a human signature.
          </SheetDescription>
        </SheetHeader>

        {suggestions.length > 0 && !response && !isStreaming && (
          <div className="px-4 pb-1 pt-2">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Try one
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestion(s)}
                  className="rounded-full border bg-card px-2.5 py-1 text-left text-xs hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          {response ? (
            <pre className="whitespace-pre-wrap font-sans">{response}</pre>
          ) : (
            <p className="text-muted-foreground">
              Ask Argus is ready. Pick a suggestion above or type your own question.
            </p>
          )}
          {error && (
            <p className="mt-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
              {error}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t p-4 space-y-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask Argus…"
            rows={3}
            disabled={isStreaming || isPending}
            className="resize-none"
          />
          <Button type="submit" disabled={!prompt.trim() || isStreaming || isPending} className="w-full">
            {isStreaming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Streaming…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send
              </>
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function buildHeaderChip(ctx: ArgusPageContext): string | null {
  if (ctx.route === "unknown") return null;
  return ctx.siteLabel ? `${ctx.routeLabel} · ${ctx.siteLabel}` : ctx.routeLabel;
}
