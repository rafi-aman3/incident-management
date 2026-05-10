-- ============================================================================
-- Phase 9b — Argus Copilot in Report Wizard
-- ============================================================================
-- Two minimal additions on top of the 9a foundation:
--
--   1. notification_kind enum gains 'stop_work_raised' so the existing
--      `notifications` table can carry the alert. Recipient = site EHS lead
--      (resolved from sites.site_ehs_lead_id) when set; otherwise null
--      (banner-only mode, picked up from incidents.stop_work=true on dashboard
--      regardless of recipient_id).
--
--   2. profiles.argus_copilot_disabled boolean — per-user opt-out for the
--      floating Copilot panel. Defaults false (panel visible). Useful when a
--      worker finds the panel intrusive on a small phone screen, without
--      yanking the org-level argus_enabled flag for everyone.
--
-- ALTER TYPE … ADD VALUE notes:
--   - Must run outside a transaction block on Postgres < 12. Modern Supabase
--     CLI (which we use) handles this transparently for the IF NOT EXISTS form.
--   - IF NOT EXISTS makes the migration idempotent — safe to re-run after
--     partial failures.
-- ============================================================================

alter type notification_kind add value if not exists 'stop_work_raised';

alter table profiles
  add column if not exists argus_copilot_disabled boolean not null default false;
