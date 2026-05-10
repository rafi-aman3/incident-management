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

/**
 * Phase 9a — empty Argus side panel shell.
 *
 * Mounts a topbar avatar that opens a right-aligned Sheet. Inside the panel,
 * a single textarea posts to `/api/argus/stream` and renders the streamed
 * response live. This is the foundation of the global side panel finalized
 * in 9e (page-context aware, dashboard insight tiles); 9b–9d add the Copilot,
 * Investigator, and magic-wand surfaces independently.
 *
 * Cyan (`#00D4FF`) is the Argus accent — held dormant in v1 per `docs/design.md`,
 * promoted now to mark AI-active states. Brand purple (#735CDD) stays for
 * "AI-suggested" form-field treatments.
 */
export function ArgusSidePanel() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isStreaming, setIsStreaming] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;

    setResponse("");
    setError(null);
    setIsStreaming(true);

    startTransition(async () => {
      try {
        const res = await fetch("/api/argus/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ surface: "ping", prompt }),
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

          // Parse SSE frames: lines like "event: token\ndata: {...}\n\n"
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ask Argus"
          title="Ask Argus"
          className="relative"
        >
          <Sparkles className="h-4 w-4" style={{ color: "var(--argus-accent, #00D4FF)" }} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--argus-accent, #00D4FF)" }} />
            Argus
          </SheetTitle>
          <SheetDescription>
            Your AI safety co-pilot. Argus suggests — you decide. Severity, CAPA closure,
            and regulatory submissions always need a human signature.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          {response ? (
            <pre className="whitespace-pre-wrap font-sans">{response}</pre>
          ) : (
            <p className="text-muted-foreground">
              Ask Argus is ready. Try: <em>&ldquo;What should I do about a slip on a wet floor?&rdquo;</em>
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
