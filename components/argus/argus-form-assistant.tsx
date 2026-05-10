"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoice } from "./use-voice";
import { VoiceButton } from "./voice-button";
import { PhotoCaptureButton } from "./photo-capture-button";

/**
 * Inline collapsible "Argus Form Assistant" strip mounted in the Report
 * Wizard chrome (above the step tabs / WizardProgress). Per
 * `assets/incident-reporting-2.png`, this is a horizontal cyan strip that
 * collapses to a one-line header and expands into the chat surface.
 *
 * The strip's primary job is **auto-filling the wizard form fields** via
 * the `update_incident_field` tool. After each turn, if any fill tool fired,
 * the strip calls `router.refresh()` so the server-rendered wizard re-reads
 * the draft and the form components remount with new initial values
 * (the wizard page passes `key={incident.updated_at}` for that purpose).
 *
 * Conversation state is held in component memory only — Phase 9b doesn't
 * persist the chat across page loads. Each panel session is ephemeral.
 */

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolEvent =
  | { kind: "tool_use"; name: string; id: string; input: Record<string, unknown> }
  | { kind: "tool_result"; id: string; result: string };

const ACCENT = "var(--argus-accent, #00D4FF)";

export function ArgusFormAssistant({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState("");

  const voice = useVoice();

  // Mirror the live transcript into the textarea while recording.
  useEffect(() => {
    if (voice.state === "recording" || voice.state === "transcribing") {
      setDraft(voice.transcript);
    }
  }, [voice.transcript, voice.state]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText, toolEvents]);

  async function send() {
    const trimmed = draft.trim();
    if (!trimmed || streaming) return;

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

    let didFillField = false;

    try {
      const res = await fetch("/api/argus/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, history: newHistory }),
      });
      if (!res.body) {
        setError("Empty response from Argus.");
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
            if (d.name === "update_incident_field") didFillField = true;
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

      if (assistantText) {
        setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
      }
      setStreamingText("");
      setPendingPhotos([]);

      // If any auto-fill happened, re-fetch the wizard page so the form
      // components remount with the new server-rendered values.
      if (didFillField) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
    }
  }

  // Collapsed view — single-line cyan header with a chevron.
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm transition hover:bg-accent/30"
        style={{
          borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 50%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 6%, transparent)",
        }}
      >
        <span className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
          Argus Form Assistant
          <span className="text-muted-foreground font-normal">— describe what happened, I&apos;ll fill the form.</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      className="rounded-md border bg-background shadow-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 50%, transparent)",
      }}
    >
      <header
        className="flex items-center justify-between gap-2 rounded-t-md border-b px-3 py-2 text-sm"
        style={{
          borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 50%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 8%, transparent)",
        }}
      >
        <span className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
          Argus Form Assistant — Incident Report
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Collapse Argus"
          className="rounded p-1 hover:bg-accent"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && !streaming && (
          <p className="text-muted-foreground">
            Tap the mic and describe what happened — &ldquo;Worker fell off scaffold this morning, north side of Building 7.&rdquo; I&apos;ll fill Title, Area, Location, and Description for you. Edit any value before submitting.
          </p>
        )}

        <ul className="space-y-2">
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
        <div
          className="border-t px-3 py-1.5 text-xs"
          style={{ borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 50%, transparent)" }}
        >
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
        style={{ borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 50%, transparent)" }}
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
          placeholder={voice.state === "recording" ? "Listening…" : "Describe what happened…"}
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
  if (name === "update_incident_field") {
    const field = String(input.field ?? "");
    const value = String(input.value ?? "");
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 italic text-foreground/80"
        style={{ backgroundColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 15%, transparent)" }}
      >
        <Pencil className="h-3 w-3" />
        <span className="font-medium capitalize">{field}</span>
        <span className="text-muted-foreground"> · {truncate(value, 60)}</span>
      </span>
    );
  }

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
  if (toolName === "update_incident_field") return "Field filled";
  return toolName;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}
