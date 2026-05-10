/**
 * Backward-compatible facade over the `lib/argus/llm` provider abstraction.
 * Re-exports `getLLM`, `isArgusConfigured`, and `ArgusOfflineError` so existing
 * imports (`@/lib/argus/client`) keep working during the 9d transition.
 *
 * Prefer importing from `@/lib/argus/llm` directly for new code.
 */

export { getLLM, isArgusConfigured, ArgusOfflineError } from "./llm";
