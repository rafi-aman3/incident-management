"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoice } from "./use-voice";
import { VoiceButton } from "./voice-button";
import { PhotoCaptureButton } from "./photo-capture-button";

/**
 * Floating Copilot panel mounted on the Report Wizard pages. Bottom-right
 * card; collapsed → 48px FAB, expanded → ~380px-wide chat window.
 *
 * Conversation state is held in component memory only — Phase 9b doesn't
 * persist the chat across page loads (per plan §Out of scope: conversation
 * persistence across sessions). Each panel session is ephemeral; the audit
 * trail lives in `argus_suggestions` rows written by the route handler +
 * tool execute() calls.
 */

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolEvent =
  | { kind: "tool_use"; name: string; id: string; input: Record<string, unknown> }
  | { kind: "tool_result"; id: string; result: string };

const ACCENT = "var(--argus-accent, #00D4FF)";

export function ArgusCopilot({ incidentId }: { incidentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Tool events keyed by tool_use id, rendered inline with the assistant turn that produced them.
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState("");

  const voice = useVoice();

  // When voice transcribes, push the transcript into the textarea.
  useEffect(() => {
    if (voice.state === "recording" || voice.state === "transcribing") {
      setDraft(voice.transcript);
    }
  }, [voice.transcript, voice.state]);

  // Auto-scroll the conversation pane on new content.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText, toolEvents]);

  async function send() {
    const trimmed = draft.trim();
    if (!trimmed || streaming) return;

    // Surface any pending photos to the model so it knows to call attach_photo.
    const photoLines =
      pendingPhotos.length > 0
        ? `\n(Photos attached this turn: ${pendingPhotos
            .map((p) => `file_id=${p.id} file_name=${p.name}`)
            .join("; ")})`
        : "";

    const userContent = `${trimmed}${photoLines}`;
    const newHistory: ChatMessage[] = [...messages, { role: "user", content: userContent }];

    setMessages(newHistory);
    setDraft("");
    setError(null);
    setStreamingText("");
    setStreaming(true);
    voice.reset();

    try {
      const res = await fetch("/api/argus/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, history: newHistory }),
      });
      if (!res.body) {
        setError("Empty response from Copilot.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

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
          let data: unknown;
          try {
            data = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          if (evt === "token") {
            const d = data as { text?: string };
            assistantText += d.text ?? "";
            setStreamingText(assistantText);
          } else if (evt === "tool_use") {
            const d = data as { name: string; id: string; input: Record<string, unknown> };
            setToolEvents((prev) => [...prev, { kind: "tool_use", ...d }]);
          } else if (evt === "tool_result") {
            const d = data as { id: string; result: string };
            setToolEvents((prev) => [...prev, { kind: "tool_result", ...d }]);
          } else if (evt === "error") {
            const d = data as { message?: string };
            setError(d.message ?? "Argus error");
          }
        }
      }

      // Persist the assistant text into messages, clear the streaming buffer
      // so the next turn renders cleanly.
      if (assistantText) {
        setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
      }
      setStreamingText("");
      setPendingPhotos([]); // photos only persist for the turn they were uploaded on
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Open Argus Copilot"
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border bg-background shadow-lg hover:scale-105 active:scale-95 transition"
        style={{ borderColor: ACCENT }}
      >
        <Sparkles className="h-5 w-5" style={{ color: ACCENT }} />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-30 flex w-[calc(100vw-2rem)] max-w-sm flex-col rounded-lg border bg-background shadow-xl"
      style={{ borderColor: ACCENT, height: "min(540px, calc(100vh - 8rem))" }}
    >
      <header
        className="flex items-center justify-between gap-2 rounded-t-lg border-b px-3 py-2"
        style={{ borderColor: ACCENT }}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
          Argus Copilot
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Minimize Argus"
          className="rounded p-1 hover:bg-accent"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && !streaming && (
          <p className="text-muted-foreground">
            Tap the mic and describe what you&apos;re seeing — &ldquo;Worker on roof, no harness, replacing tiles.&rdquo; I&apos;ll log the observation, attach your photo, and raise stop-work if you say so.
          </p>
        )}

        <ul className="space-y-3">
          {messages.map((m, idx) => (
            <li key={idx} className={m.role === "user" ? "text-right" : ""}>
              <span
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 ${
                  m.role === "user" ? "bg-muted" : "bg-accent/30"
                }`}
              >
                {m.content}
              </span>
            </li>
          ))}

          {/* Tool events — render inline, distinct from chat bubbles */}
          {toolEvents.map((te, idx) => (
            <li key={`te-${idx}`} className="text-xs">
              {te.kind === "tool_use" ? (
                <ToolUseChip name={te.name} input={te.input} />
              ) : (
                <ToolResultChip result={te.result} />
              )}
            </li>
          ))}

          {streamingText && (
            <li>
              <span className="inline-block max-w-[85%] whitespace-pre-wrap rounded-lg bg-accent/30 px-3 py-1.5">
                {streamingText}
                <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-foreground/60" aria-hidden />
              </span>
            </li>
          )}
        </ul>

        {error && (
          <p className="mt-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
            {error}
          </p>
        )}
      </div>

      {pendingPhotos.length > 0 && (
        <div className="border-t px-3 py-1.5 text-xs" style={{ borderColor: ACCENT }}>
          <span className="text-muted-foreground">
            {pendingPhotos.length} photo{pendingPhotos.length > 1 ? "s" : ""} ready: {pendingPhotos.map((p) => p.name).join(", ")}
          </span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-end gap-1.5 border-t p-2"
        style={{ borderColor: ACCENT }}
      >
        <VoiceButton
          state={voice.state}
          isSupported={voice.isSupported}
          onStart={voice.start}
          onStop={voice.stop}
        />
        <PhotoCaptureButton
          incidentId={incidentId}
          onUploaded={(id, name) => setPendingPhotos((prev) => [...prev, { id, name }])}
        />
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={voice.state === "recording" ? "Listening…" : "Describe what you see…"}
          rows={2}
          disabled={streaming}
          className="resize-none flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || streaming}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function ToolUseChip({ name, input }: { name: string; input: Record<string, unknown> }) {
  const Icon =
    name === "log_observation"
      ? Eye
      : name === "attach_photo"
        ? ImageIcon
        : name === "raise_stop_work"
          ? AlertOctagon
          : Sparkles;

  const summary =
    name === "log_observation"
      ? String(input.text ?? "")
      : name === "attach_photo"
        ? String(input.caption ?? "Photo")
        : name === "raise_stop_work"
          ? String(input.reason ?? "")
          : "";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 italic text-foreground/80"
      style={{ backgroundColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 12%, transparent)" }}
    >
      <Icon className="h-3 w-3" />
      <span className="font-medium">{labelFor(name)}</span>
      {summary && <span className="text-muted-foreground"> · {truncate(summary, 60)}</span>}
    </span>
  );
}

function ToolResultChip({ result }: { result: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CheckCircle2 className="h-3 w-3 text-green-600" />
      <span>{truncate(result, 80)}</span>
    </span>
  );
}

function labelFor(toolName: string): string {
  if (toolName === "log_observation") return "Observation logged";
  if (toolName === "attach_photo") return "Photo attached";
  if (toolName === "raise_stop_work") return "Stop-work raised";
  return toolName;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}
