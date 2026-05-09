"use client";

/**
 * Site Setup Wizard — localStorage draft persistence.
 *
 * Each step's form auto-saves its current FormData to localStorage on every
 * input/change with a 600ms debounce. On mount, if a saved draft exists for
 * the (siteId, slug) pair, it's surfaced via the `draft` return value so the
 * step can pre-fill its `defaultValue` props and useState seeds. A
 * `<DraftRestoredBanner>` component renders above the form when a draft is
 * loaded, with a Discard button that wipes the entry and reloads the page.
 *
 * Clear semantics (per Phase 13 plan):
 *   - When step N+1 mounts, step N's draft is cleared (the user successfully
 *     navigated forward, so the server has the canonical data).
 *   - When the Confirm step (step 9) mounts, ALL drafts for this siteId are
 *     cleared (the user is about to launch).
 *   - 24-hour TTL on stale entries.
 *
 * Failure modes covered: tab close, page refresh, browser crash, accidental
 * navigation away. Network-error-during-save is also covered as a side
 * effect — but `useActionState` already retains form state across submission
 * failures, so localStorage is belt + suspenders for that case.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { SETUP_STEPS, type SetupStepSlug } from "./steps";

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = "site-setup-draft";

type DraftValues = Record<string, string | string[]>;
type StoredDraft = { ts: number; values: DraftValues };

export function draftKey(siteId: string, slug: SetupStepSlug): string {
  return `${KEY_PREFIX}:${siteId}:${slug}:v1`;
}

/** FormData → JSON-friendly object that preserves multi-value fields (text[]). */
function formDataToObject(fd: FormData): DraftValues {
  const out: DraftValues = {};
  for (const key of new Set(Array.from(fd.keys()))) {
    const all = fd.getAll(key).map((v) => String(v));
    out[key] = all.length === 1 ? (all[0] as string) : all;
  }
  return out;
}

function readDraft(storageKey: string): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed.ts !== "number") {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(storageKey: string, values: DraftValues): void {
  if (typeof window === "undefined") return;
  try {
    const draft: StoredDraft = { ts: Date.now(), values };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Quota exceeded etc. — silently ignore. Wizard still works without persist.
  }
}

export function clearDraft(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {}
}

/** Clears every site-setup draft entry for this siteId across all 9 slugs. */
export function clearAllDraftsForSite(siteId: string): void {
  if (typeof window === "undefined") return;
  for (const step of SETUP_STEPS) {
    clearDraft(draftKey(siteId, step.slug));
  }
}

/** Clears the previous step's draft (used on step N+1 mount to clean up). */
export function clearPriorStepDraft(siteId: string, currentSlug: SetupStepSlug): void {
  const idx = SETUP_STEPS.findIndex((s) => s.slug === currentSlug);
  if (idx <= 0) return;
  const priorSlug = SETUP_STEPS[idx - 1]!.slug;
  clearDraft(draftKey(siteId, priorSlug));
}

/**
 * Hook the wizard's per-step forms attach to. Returns:
 *   - `formRef` — attach to the <form ref={...}>
 *   - `draft` — the parsed values object if a saved draft was found, else null
 *   - `restoredAt` — Date the draft was last saved, for the banner copy
 *   - `clearAndReload()` — Discard button handler that wipes + reloads
 */
export function useDraftPersistence(storageKey: string): {
  formRef: RefObject<HTMLFormElement | null>;
  draft: DraftValues | null;
  restoredAt: Date | null;
  clearAndReload: () => void;
} {
  // Read once at mount — useState init runs synchronously, so the values are
  // available before useState seeds in the consuming step component.
  const [snapshot] = useState<{ draft: DraftValues | null; restoredAt: Date | null }>(() => {
    const stored = readDraft(storageKey);
    return stored
      ? { draft: stored.values, restoredAt: new Date(stored.ts) }
      : { draft: null, restoredAt: null };
  });

  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const commit = () => {
      const fd = new FormData(form);
      writeDraft(storageKey, formDataToObject(fd));
    };
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(commit, 600);
    };

    form.addEventListener("input", handler);
    form.addEventListener("change", handler);
    return () => {
      if (timer) clearTimeout(timer);
      form.removeEventListener("input", handler);
      form.removeEventListener("change", handler);
    };
  }, [storageKey]);

  const clearAndReload = () => {
    clearDraft(storageKey);
    if (typeof window !== "undefined") window.location.reload();
  };

  return {
    formRef,
    draft: snapshot.draft,
    restoredAt: snapshot.restoredAt,
    clearAndReload,
  };
}

/**
 * Helper to pull a single field from the draft if present, else fall back
 * to the server-provided initial. String/number scalars only — for
 * arrays/booleans, read draft[key] directly.
 */
export function pickFromDraft(
  draft: DraftValues | null,
  key: string,
  fallback: string
): string {
  if (!draft) return fallback;
  const v = draft[key];
  if (typeof v === "string") return v;
  return fallback;
}

/** Same as pickFromDraft but for array (text[]) fields. */
export function pickArrayFromDraft<T extends string>(
  draft: DraftValues | null,
  key: string,
  fallback: T[]
): T[] {
  if (!draft) return fallback;
  const v = draft[key];
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.length > 0) return [v as T];
  return fallback;
}

/** Format a relative time string for the restored banner. */
function formatRelative(ts: Date): string {
  const diffMs = Date.now() - ts.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export function describeRestoredAt(ts: Date | null): string {
  if (!ts) return "";
  return formatRelative(ts);
}
