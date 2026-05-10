"use client";

import { useEffect, useState } from "react";
import { Sparkles, Plus, Loader2, FileText, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoice } from "./use-voice";
import { VoiceButton } from "./voice-button";
import { ArgusInvestigatorWitness } from "./argus-investigator-witness";
import type {
  InvestigatorPhase,
  InvestigatorWitnessAdd,
} from "./use-argus-investigator-stream";
import { initialsOf } from "@/lib/argus/redact";

const ACCENT = "var(--argus-accent, #00D4FF)";

export interface InvestigatorSeed {
  description: string | null;
  type: string;
  area: string | null;
  location: string | null;
  occurredAt: string;
}

export interface InvestigatorExistingWitness {
  id: string;
  name: string;
  statement: string | null;
}

export function ArgusInvestigatorInput({
  seed,
  existingWitnesses,
  paste,
  onPasteChange,
  witnessAdds,
  onWitnessAddsChange,
  phase,
  onGenerate,
}: {
  seed: InvestigatorSeed;
  existingWitnesses: InvestigatorExistingWitness[];
  paste: string;
  onPasteChange: (v: string) => void;
  witnessAdds: InvestigatorWitnessAdd[];
  onWitnessAddsChange: (next: InvestigatorWitnessAdd[]) => void;
  phase: InvestigatorPhase;
  onGenerate: () => void;
}) {
  const voice = useVoice();
  const [voiceTarget, setVoiceTarget] = useState<"paste" | null>(null);

  useEffect(() => {
    if (voice.state === "recording" && voiceTarget === "paste") {
      onPasteChange(voice.transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.transcript, voice.state, voiceTarget]);

  const isStreaming = phase === "reading" || phase === "streaming";

  const totalWitnessCount = existingWitnesses.length + witnessAdds.length;
  const totalWords = countWords(paste) + countWords(seed.description ?? "");
  const canGenerate =
    !isStreaming && (totalWitnessCount > 0 || (paste.trim().length > 0 && totalWords >= 50));

  const generateHint = isStreaming
    ? "Generating…"
    : totalWitnessCount === 0 && paste.trim().length === 0
      ? "Add at least one witness statement or paste-in detail to generate."
      : totalWitnessCount === 0 && totalWords < 50
        ? "Need at least one witness statement, or about 50+ words of detail, before generating."
        : null;

  return (
    <div
      className="rounded-lg border bg-card"
      style={{
        borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 35%, transparent)",
      }}
    >
      <header
        className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3"
        style={{
          borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 35%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 6%, transparent)",
        }}
      >
        <div>
          <p
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide"
            style={{ color: ACCENT }}
          >
            <Sparkles className="h-3 w-3" /> Source material
          </p>
          <h2 className="text-base font-semibold">
            What Argus will read when drafting
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Names are stripped to initials before the prompt leaves your org. Argus uses only what&apos;s here — no invention.
          </p>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <div className="rounded-md border bg-muted/40 p-3 text-[13px]">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3 w-3" /> Incident description (read-only seed)
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            <span className="capitalize">{seed.type.replace(/_/g, " ")}</span>
            <span className="mx-1.5">·</span>
            <Calendar className="-mt-0.5 inline h-3 w-3" /> {formatOccurred(seed.occurredAt)}
            {(seed.area || seed.location) && (
              <>
                <span className="mx-1.5">·</span>
                <MapPin className="-mt-0.5 inline h-3 w-3" />{" "}
                {[seed.area, seed.location].filter(Boolean).join(" / ")}
              </>
            )}
          </p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">
            {seed.description?.trim() || (
              <span className="italic text-muted-foreground">
                No description on the incident. Add detail below or via the witness statements.
              </span>
            )}
          </p>
        </div>

        {existingWitnesses.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 text-[13px]">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Existing witness statements ({existingWitnesses.length})
            </p>
            <ul className="space-y-2">
              {existingWitnesses.map((w) => (
                <li key={w.id} className="leading-relaxed">
                  <span className="font-medium">{initialsOf(w.name)}</span>
                  <span className="ml-1 text-muted-foreground">
                    : {w.statement?.trim() || (
                      <span className="italic">(no statement text)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Add detail (paste or voice)
              </p>
              <p className="text-[11px] text-muted-foreground">
                Optional. The investigator&apos;s own paste of timeline notes, additional facts, or follow-up findings.
              </p>
            </div>
            <VoiceButton
              state={voiceTarget === "paste" ? voice.state : "idle"}
              isSupported={voice.isSupported}
              onStart={() => {
                setVoiceTarget("paste");
                voice.start();
              }}
              onStop={() => {
                voice.stop();
                setVoiceTarget(null);
              }}
            />
          </div>
          <Textarea
            value={paste}
            onChange={(e) => onPasteChange(e.target.value)}
            placeholder={
              voice.state === "recording" && voiceTarget === "paste"
                ? "Listening…"
                : "Paste or dictate additional context Argus should consider when drafting."
            }
            rows={4}
            maxLength={20000}
            className="text-sm"
          />
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Add witness statements
              </p>
              <p className="text-[11px] text-muted-foreground">
                Held in this tab until you push a draft. They don&apos;t hit the witness list until then.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onWitnessAddsChange([
                  ...witnessAdds,
                  { name: "", contact: "", statement: "" },
                ])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add witness
            </Button>
          </div>

          {witnessAdds.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-[13px] text-muted-foreground">
              None yet — voice or text input both work.
            </p>
          ) : (
            <ul className="space-y-3">
              {witnessAdds.map((w, idx) => (
                <li key={idx}>
                  <ArgusInvestigatorWitness
                    value={w}
                    onChange={(next) => {
                      const out = [...witnessAdds];
                      out[idx] = next;
                      onWitnessAddsChange(out);
                    }}
                    onRemove={() =>
                      onWitnessAddsChange(witnessAdds.filter((_, i) => i !== idx))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <p className="text-[11px] text-muted-foreground">
            {generateHint}
          </p>
          <Button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="font-semibold"
            style={
              canGenerate
                ? { backgroundColor: ACCENT, color: "#003" }
                : undefined
            }
          >
            {isStreaming ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Generate timeline + RCA
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function formatOccurred(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
