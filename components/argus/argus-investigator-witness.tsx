"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useVoice } from "./use-voice";
import { VoiceButton } from "./voice-button";
import type { InvestigatorWitnessAdd } from "./use-argus-investigator-stream";

/**
 * Single editable witness row used inside the Argus Investigator input
 * panel. Voice button mirrors the live transcript into the statement field
 * while recording. Contact is optional. Held client-side until first Push;
 * see `feedback_argus_assistive_only` and the 9c plan §5 (open question 5).
 */
export function ArgusInvestigatorWitness({
  value,
  onChange,
  onRemove,
}: {
  value: InvestigatorWitnessAdd;
  onChange: (next: InvestigatorWitnessAdd) => void;
  onRemove: () => void;
}) {
  const voice = useVoice();
  const [voiceTarget, setVoiceTarget] = useState<"statement" | null>(null);

  useEffect(() => {
    if (voice.state === "recording" && voiceTarget === "statement") {
      onChange({ ...value, statement: voice.transcript });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.transcript, voice.state, voiceTarget]);

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Witness name"
          maxLength={200}
          className="flex-1"
        />
        <Input
          value={value.contact ?? ""}
          onChange={(e) => onChange({ ...value, contact: e.target.value })}
          placeholder="Contact (optional)"
          maxLength={200}
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove witness"
          title="Remove witness"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={value.statement}
          onChange={(e) => onChange({ ...value, statement: e.target.value })}
          placeholder={
            voice.state === "recording" && voiceTarget === "statement"
              ? "Listening…"
              : "Witness statement (text or voice)"
          }
          rows={3}
          maxLength={5000}
          className="flex-1 text-sm"
        />
        <VoiceButton
          state={voiceTarget === "statement" ? voice.state : "idle"}
          isSupported={voice.isSupported}
          onStart={() => {
            setVoiceTarget("statement");
            voice.start();
          }}
          onStop={() => {
            voice.stop();
            setVoiceTarget(null);
          }}
        />
      </div>
    </div>
  );
}
