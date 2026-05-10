/**
 * Browser Web Speech API contracts. The hook implementation lives in
 * `components/argus/use-voice.ts` — this file is the type surface, kept
 * server-importable so server actions can match shapes when they accept
 * voice transcripts.
 *
 * Phase 9.0 ships English-only with text-input fallback for unsupported
 * browsers. Whisper / Deepgram is a 9.1 escalation path if Safari iOS
 * drop-off justifies it (per plan, §Risks).
 */

export type VoiceState = "idle" | "recording" | "transcribing" | "error";

export interface VoiceTranscript {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export interface UseVoiceResult {
  state: VoiceState;
  transcript: string;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  error?: string;
}
