"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseVoiceResult, VoiceState } from "@/lib/argus/voice";

/**
 * Web Speech API hook. State machine:
 *   idle → recording → transcribing → idle
 *
 * `transcript` accumulates `isFinal` results; interim results are merged into
 * the displayed value but don't accumulate. Errors set state="error" with a
 * human-readable message in `error`.
 *
 * `isSupported` is `false` in Firefox / older Safari → the caller renders a
 * textarea instead of the mic button. iOS Safari often pauses recognition
 * mid-utterance — detection-level workaround is "tap mic again to resume,"
 * documented in the panel's tooltip.
 */

// SpeechRecognition is exposed under different names in Chrome/Safari/Edge.
// The vendor-prefixed shape on `window` isn't typed in lib.dom; cast through
// `unknown` so this compiles without polluting the global type space.
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as SpeechRecognitionConstructor | undefined) ??
    (w.webkitSpeechRecognition as SpeechRecognitionConstructor | undefined) ??
    null
  );
}

export function useVoice(): UseVoiceResult {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | undefined>();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const isSupported = Boolean(getRecognitionCtor());

  useEffect(() => {
    return () => {
      // Cleanup on unmount — abort any in-flight recognition.
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  const start = useCallback(() => {
    setError(undefined);
    if (!isSupported) {
      setError("Speech recognition not supported in this browser. Use the text input.");
      setState("error");
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false; // one utterance per tap
    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";
    setTranscript("");

    recognition.addEventListener("start", () => setState("recording"));

    recognition.addEventListener("result", (ev: Event) => {
      const evt = ev as SpeechRecognitionEvent;
      let interim = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const result = evt.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalTranscriptRef.current += text;
        } else {
          interim += text;
        }
      }
      setTranscript((finalTranscriptRef.current + interim).trim());
    });

    recognition.addEventListener("error", (ev: Event) => {
      const evt = ev as SpeechRecognitionErrorEvent;
      // 'no-speech' fires routinely when the user pauses; don't surface.
      if (evt.error === "no-speech") return;
      setError(evt.message ?? evt.error ?? "Speech recognition error");
      setState("error");
    });

    recognition.addEventListener("end", () => {
      setState((prev) => (prev === "error" ? "error" : "idle"));
    });

    try {
      recognition.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setTranscript("");
    setError(undefined);
    finalTranscriptRef.current = "";
  }, []);

  return { state, transcript, isSupported, start, stop, reset, error };
}
