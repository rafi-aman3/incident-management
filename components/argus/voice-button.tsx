"use client";

import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceState } from "@/lib/argus/voice";

/**
 * Mic button for the Copilot panel. Cyan when recording (pulse), greyed out
 * when unsupported. The hook (useVoice) is intentionally not bundled here —
 * it lives in the panel parent so the parent can also listen to the
 * transcript and decide when to forward it as a message.
 */
export function VoiceButton({
  state,
  isSupported,
  onStart,
  onStop,
  className,
}: {
  state: VoiceState;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}) {
  const recording = state === "recording";

  if (!isSupported) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        title="Voice input not supported in this browser — use the text field"
        className={className}
      >
        <MicOff className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={recording ? "default" : "ghost"}
      size="icon"
      onClick={recording ? onStop : onStart}
      title={recording ? "Stop recording" : "Tap to dictate"}
      aria-pressed={recording}
      className={className}
      style={
        recording
          ? { backgroundColor: "var(--argus-accent, #00D4FF)", color: "#003" }
          : undefined
      }
    >
      <Mic className={`h-4 w-4 ${recording ? "animate-pulse" : ""}`} />
    </Button>
  );
}
