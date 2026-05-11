/**
 * Phase 17 — Cookies tab "Clear non-essential local data" button.
 *
 * Wipes the localStorage / cookie entries listed in the Cookies card as
 * "Non-essential". Essential entries (Supabase auth refresh, next-themes
 * preference) are untouched — the user stays signed in and keeps their
 * theme choice.
 */
const NON_ESSENTIAL_LOCAL_STORAGE_PREFIXES = [
  "argus.search.recent",
  "sonner.",
];

const NON_ESSENTIAL_COOKIES = ["sidebar_pinned"];

export function clearLocalData() {
  if (typeof window === "undefined") return;

  // localStorage — exact match + prefix sweep.
  try {
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (
        NON_ESSENTIAL_LOCAL_STORAGE_PREFIXES.some(
          (p) => key === p || key.startsWith(p),
        )
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore localStorage access errors (private mode, quota, etc.)
  }

  // Cookies — overwrite with Max-Age=0. The path mirrors how the cookie was
  // set; sidebar_pinned uses '/' (see sidebar-cookie.ts).
  for (const name of NON_ESSENTIAL_COOKIES) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}
