/**
 * Escape user input for use inside Supabase PostgREST .ilike() / .or() filters.
 *
 * - `%` and `_` are SQL LIKE wildcards — escape so they match literally.
 * - `,` and `)` would break out of `.or('a.ilike.%q%,b.ilike.%q%')` syntax.
 * - `\` is the LIKE escape character — must come first.
 *
 * Returns a string safe to interpolate into a PostgREST filter expression.
 */
export function escapeIlike(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "\\,")
    .replace(/\)/g, "\\)");
}
