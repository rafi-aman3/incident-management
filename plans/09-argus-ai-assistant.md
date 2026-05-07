# Phase 09 — Argus (AI assistant)

**Status:** stub claimed 2026-05-07. **Not yet scoped — discussion pending.**
**Goal (provisional):** Add an in-app AI assistant ("Argus") to the EHS Operations Platform. Argus is our equivalent of the references' "ARIA" — same product role, different name. The references show Argus/ARIA as a form-fill assistant inside the Report Incident wizard plus a "Generate with Argus" button on `/incidents`. Final scope decided in this plan once we sit down to discuss.
**Branch (provisional):** `feat/phase-09-argus`
**PR target:** `main`
**Depends on:** Phase 6b (`/incidents` redesign reserves the layout slot for the "Generate with Argus" button next to "Report incident"); Phase 10 (Safety Bulletin) if we want Argus to draft bulletin text.

> **What we *think* this phase will ship — to be confirmed in scoping discussion:**
> - "Generate with Argus" CTA on `/incidents` (next to "Report incident") — opens a guided flow where the user describes what happened in natural language and Argus pre-fills wizard fields.
> - **Argus Form Assistant panel** in the Report Wizard (collapsible, surfaces in `/incidents/new/[step]`) that suggests answers based on the user's free-text description, prior similar incidents, and the asset/location context.
> - **Suggestion-with-attribution UX**: every Argus-generated value is editable + visibly marked as a suggestion until the user confirms it. Never silently overwrites human input.
> - Backend choice (Anthropic Claude API vs other) decided here. Default lean: **Claude API** via `@anthropic-ai/sdk`, with prompt caching enabled per `claude-api` skill defaults.
> - **Server-side only**: API key never reaches the client; all generation flows through a server action / route handler that gates on `can("incident:report", siteId)` (or equivalent for the surface).
> - **Audit trail**: every Argus generation logged to `activity_events` with `kind = 'argus_generation'` so we can see what the model produced + what the human edited before commit.

> **What we *think* is NOT in this phase — to be confirmed:**
> - **No autonomous actions.** Argus suggests; humans commit. No Argus-initiated CAPA assignment, no Argus-initiated severity override, no Argus-initiated notification dispatch.
> - **No Argus on the regulatory PDFs** (OSHA 301, 300, 300A, RIDDOR F2508). Those are legal artifacts — the model doesn't fill them, period.
> - **No Argus in the inspection runner.** Mobile-first inspection flow stays human-only for v1; revisit in a later phase.
> - **No model fine-tuning, no RAG over the org's incident corpus** (yet). Start with prompt-engineered Claude calls + structured-output schemas.

---

## Background

The user-provided reference mocks (`assets/incident-management.png`, `incident-reporting{,-2,-3}.png`) show:
- A teal "Generate with ARIA" button in the top-right of `/incidents`, next to the destructive "Report Incident" button.
- An "ARIA Form Assistant — Incident Report" collapsible panel inside the Report Wizard, sitting between the breadcrumb and the step tabs.
- A pink top-of-page banner: "We are implementing updates to ARIA's route handling for write-intent requests." (Status messaging UX — Argus has its own announcement bar.)

We deliberately strip "Generate with Argus" from Phase 6b because Argus = its own phase. Phase 6b reserves the layout slot in the `<PageHeader/>` so dropping the button into place in Phase 09 is a one-component change, not a layout reflow.

---

## Open scope questions (resolve before drafting fully)

1. **Argus surfaces in v1 of this phase** — which to ship and which to defer?
   - `/incidents` "Generate with Argus" CTA → opens an intake modal → routes to wizard with prefilled fields.
   - Wizard inline assistant panel that improves suggestions step-by-step.
   - Investigation 5-Why scaffolding ("here are 5 candidate root causes given the incident description").
   - CAPA drafting ("propose 2 CAPAs given this finding").
   - Inspection finding triage ("does this finding warrant escalation to incident").
2. **Provider** — Claude API (recommended; we already have an internal `claude-api` skill + the SDK) vs OpenAI vs self-hosted. Pricing, prompt caching, structured outputs all favor Claude.
3. **Where does Argus persist learned context?** Per-org system prompt + per-org corpus? Per-site? Per-user?
4. **Model selection** — Claude **Haiku 4.5** for speed-sensitive surfaces (live wizard suggestions), **Sonnet 4.6** for higher-quality drafting (CAPA, 5-Why), **Opus 4.7** only for explicit "deep mode" requests? Default lean: Haiku 4.5 on every surface, escalate when latency budget allows.
5. **Cost guardrails** — per-org monthly token budget? Per-user rate limit? Off-by-default for orgs that don't opt in?
6. **Argus voice / tone** — calm + factual + no jargon, matching `docs/design.md` copy guidelines. Probably worth a small style guide document.
7. **Prompt-caching strategy** — every Argus call should hit prompt cache for the system prompt + the org's incident-history context window. Per `claude-api` skill defaults: cache the system prompt at ≥1024 tokens, cache org context at ≥1024 tokens, ephemeral cache the user message.
8. **Failure modes** — if Argus is down or returns a bad response, the surface degrades gracefully (panel shows "Argus is having trouble — fill manually or try again"). Never blocks a user from filing a report.
9. **Privacy** — incident descriptions can contain PII (injured person names, witness contact info). Confirm: do we redact before sending to the model, send raw + rely on contractual data handling, or offer per-org opt-in for "send raw"? **Default lean: redact PII server-side before generation.**
10. **Activity-events schema** — `kind = 'argus_generation'` is new. Captures `{ model_id, prompt_tokens, completion_tokens, cached_tokens, latency_ms, surface, accepted: boolean }`. Add to `activity_events` enum.

---

## Definition of done (provisional)

1. Argus pre-fills the wizard from a natural-language description; user can edit every field before commit; every prefilled field is visually marked "Argus suggestion" until confirmed.
2. "Generate with Argus" button on `/incidents` opens the intake modal and routes through.
3. All generation server-side; API key never reaches the client; per-surface RBAC gate on the server action.
4. Every generation logged to `activity_events` with token + latency telemetry.
5. Graceful degradation when Argus is down (no blocking error, just "fill manually" copy).
6. PII redacted before generation (or explicit per-org opt-in to send raw).
7. Per-org monthly token budget enforced server-side; over-budget orgs see "Argus is paused this month" copy without breaking the report flow.
8. Smoke-test guide at `docs/smoke-test-phase9.md` walking through generation + edit + commit + audit-trail verification.

---

## Why a stub now

Phase 6b's `/incidents` redesign reserves the topbar-CTA slot for "Generate with Argus" without rendering it. Phase 6b's wizard polish leaves the header layout flexible enough to slot an Assistant panel later without restructuring. Dropping this stub now claims the phase number (09) and gives Phase 6b a concrete name to point at when it defers the button + panel — so the audit trail in `CLAUDE.md` reads cleanly.

The actual scope conversation happens when the user signals "let's plan phase 09".
