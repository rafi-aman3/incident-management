"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

function formatRelative(ms: number): string {
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  const h = Math.floor(ms / 3_600_000);
  return `${h}h ago`;
}

/**
 * Pill in the runner topbar that signals network + save state.
 * Cycles between:
 *   - "Saving…" (any in-flight save)
 *   - "Saved 12s ago" (online, last successful save)
 *   - "Offline — last saved 2m ago" (offline, with a prior save)
 *   - "Offline" (offline, never saved)
 *   - "Save failed" (last save errored, online)
 */
export function NetworkIndicator({
  status,
  lastSavedAt,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
}) {
  const [online, setOnline] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  // Re-read tick so the relative-time string refreshes
  void tick;

  const relative = lastSavedAt
    ? formatRelative(Date.now() - lastSavedAt.getTime())
    : null;

  let label: string;
  let icon: React.ReactNode;
  let tone: "neutral" | "warning" | "error";

  if (status === "saving") {
    label = "Saving…";
    icon = <Loader2 className="h-3 w-3 animate-spin" aria-hidden />;
    tone = "neutral";
  } else if (!online) {
    label = relative ? `Offline — last saved ${relative}` : "Offline";
    icon = <CloudOff className="h-3 w-3" aria-hidden />;
    tone = "warning";
  } else if (status === "error") {
    label = "Save failed";
    icon = <CloudOff className="h-3 w-3" aria-hidden />;
    tone = "error";
  } else if (relative) {
    label = `Saved ${relative}`;
    icon = <Cloud className="h-3 w-3" aria-hidden />;
    tone = "neutral";
  } else {
    label = "Not saved yet";
    icon = <Cloud className="h-3 w-3" aria-hidden />;
    tone = "neutral";
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
        tone === "neutral" && "border-border bg-muted/50 text-muted-foreground",
        tone === "warning" &&
          "border-warning/40 bg-warning/10 text-warning-foreground",
        tone === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
