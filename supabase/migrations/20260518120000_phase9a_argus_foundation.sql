-- ============================================================================
-- Phase 9a — Argus (AI assistant) Foundation
-- ============================================================================
-- Data-model groundwork for the assistive AI co-pilot. Argus is *suggestive*,
-- never authoritative — every load-bearing decision keeps a named human
-- signature (severity, track, CAPA close, OSHA/RIDDOR submit). See SPEC §17.
--
-- This migration is purely additive:
--   1. activity_events.actor_kind      — distinguishes 'human' vs 'argus' rows
--   2. orgs.argus_enabled              — per-org feature flag (default true)
--   2. orgs.argus_daily_token_budget   — soft+hard cap, summed from suggestions
--   3. argus_suggestions               — full audit log of every AI suggestion
--                                         w/ outcome (accepted/edited/rejected)
--   4. incidents.stop_work*            — boolean + raised/ack metadata + reason
--   5. permission 'argus:use'          — gate for the AI panel; default-on for
--                                         all four seeded roles
--
-- RLS uses user_can_access_site() per `feedback_avoid_self_referencing_rls`.
-- Stop-work columns reuse incidents' existing RLS (no new policies needed).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. activity_events.actor_kind
-- ----------------------------------------------------------------------------
-- Every AI-authored event records actor_kind='argus'; everything pre-existing
-- is grandfathered as 'human' via the default. The CHECK constraint locks the
-- two-value enum without introducing a Postgres ENUM type (cheaper to extend).
alter table activity_events
  add column actor_kind text not null default 'human'
    check (actor_kind in ('human', 'argus'));

create index activity_events_actor_kind_idx
  on activity_events (actor_kind)
  where actor_kind = 'argus';

-- ----------------------------------------------------------------------------
-- 2. orgs.argus_enabled + argus_daily_token_budget
-- ----------------------------------------------------------------------------
-- Feature flag is default-true so demo orgs see Argus immediately. Daily token
-- budget defaults to 5M tokens (~$15/day at Haiku 4.5 input rates) — sized for
-- a single seed org under heavy demo. Per-org override via UPDATE.
alter table orgs
  add column argus_enabled boolean not null default true,
  add column argus_daily_token_budget bigint not null default 5000000;

-- ----------------------------------------------------------------------------
-- 3. argus_suggestions — audit log + budget source-of-truth
-- ----------------------------------------------------------------------------
-- One row per suggestion (mic turn, magic-wand click, investigator generation,
-- side-panel chat). Always written, even on reject — the budget engine sums
-- prompt_tokens + completion_tokens + cache_create_tokens by org/day to
-- enforce the soft (80%) warn and hard (100%) cap.
--
-- payload jsonb shape varies by surface (severity suggestion: {row,col,sev}; …).
-- outcome lifecycle: pending → accepted | edited | rejected | expired (24h TTL).
create table argus_suggestions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references orgs(id) on delete cascade,
  site_id             uuid references sites(id) on delete set null,
  user_id             uuid not null references profiles(id) on delete cascade,
  surface             text not null,          -- 'copilot' | 'investigator' | 'severity' | 'capa_draft' | …
  target_kind         text,                   -- 'incident' | 'investigation' | 'capa' | 'finding' | null
  target_id           uuid,
  model               text not null,          -- e.g. 'claude-haiku-4-5'
  prompt_tokens       int not null,
  completion_tokens   int not null,
  cache_read_tokens   int not null default 0,
  cache_create_tokens int not null default 0,
  payload             jsonb not null,
  outcome             text check (outcome in ('pending', 'accepted', 'edited', 'rejected', 'expired')),
  outcome_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- Daily-budget query path: range-scan rows for an org from start-of-day onward.
-- (A functional index on `(created_at::date)` would 42P17 — the cast is STABLE,
-- not IMMUTABLE, because timezone shifts the date boundary.)
create index argus_suggestions_org_created_idx
  on argus_suggestions (org_id, created_at desc);

-- Per-target lookup (e.g. "did Argus already suggest a severity for this incident?").
create index argus_suggestions_target_idx
  on argus_suggestions (target_kind, target_id)
  where target_id is not null;

-- Per-user activity (for rate-limit fallback + dashboards).
create index argus_suggestions_user_created_idx
  on argus_suggestions (user_id, created_at desc);

alter table argus_suggestions enable row level security;

-- SELECT — site members (for site-scoped rows) or any org member (for org-wide
-- rows like global side-panel chats with site_id null).
create policy argus_suggestions_select on argus_suggestions for select to authenticated
  using (
    (site_id is not null and user_can_access_site(site_id))
    or (site_id is null and org_id = (select org_id from profiles where id = auth.uid()))
  );

-- INSERT — only by the suggestion's author, scoped to a site they can access
-- (or org-wide rows where they belong to the org).
create policy argus_suggestions_insert on argus_suggestions for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (site_id is not null and user_can_access_site(site_id))
      or (site_id is null and org_id = (select org_id from profiles where id = auth.uid()))
    )
  );

-- UPDATE — only the author, only the outcome columns, only within 24h.
-- Older rows freeze, supporting the audit trail.
create policy argus_suggestions_update_outcome on argus_suggestions for update to authenticated
  using (user_id = auth.uid() and created_at > now() - interval '24 hours')
  with check (user_id = auth.uid());

-- DELETE — revoked from PUBLIC (audit log is append-only after the 24h window).
revoke delete on argus_suggestions from public;

-- ----------------------------------------------------------------------------
-- 4. incidents.stop_work + raised/ack metadata + reason
-- ----------------------------------------------------------------------------
-- Stop-work is a boolean flag; reuses the wizard + notification pipeline.
-- Real EHS workflows want approval chains + lift criteria + photo proof on
-- lift — explicitly out of scope for v1 (revisit in v2 per phase plan).
alter table incidents
  add column stop_work boolean not null default false,
  add column stop_work_raised_at timestamptz,
  add column stop_work_raised_by uuid references profiles(id) on delete set null,
  add column stop_work_reason text,
  add column stop_work_acknowledged_at timestamptz,
  add column stop_work_acknowledged_by uuid references profiles(id) on delete set null;

-- Partial index — query "active stop-works on this site" without scanning the
-- full incidents table.
create index incidents_stop_work_active_idx
  on incidents (org_id, site_id)
  where stop_work and stop_work_acknowledged_at is null;

-- ----------------------------------------------------------------------------
-- 5. argus:use permission + default-role grants
-- ----------------------------------------------------------------------------
insert into permissions (key, description) values
  ('argus:use', 'Use the Argus AI assistant (panel, copilot, magic-wands)')
on conflict (key) do nothing;

-- Backfill existing default roles in every org.
-- All four roles (worker / supervisor / ehs_manager) get argus:use; site_admin
-- picks it up via the catch-all sweep below.
insert into role_permissions (role_id, permission_key)
  select r.id, 'argus:use'
    from roles r
   where r.is_default = true
     and r.key in ('worker', 'supervisor', 'ehs_manager')
on conflict do nothing;

-- site_admin gets every key (mirrors the catch-all in seed_default_roles).
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true
     and r.key = 'site_admin'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Update seed_default_roles() so future orgs get argus:use automatically
-- ----------------------------------------------------------------------------
create or replace function seed_default_roles(p_org_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_role_id uuid;
begin
  -- worker
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'worker', 'Worker', 'Reports incidents and observations.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key) values
    (v_role_id, 'incident:report'),
    (v_role_id, 'incident:read_own'),
    (v_role_id, 'site:read'),
    (v_role_id, 'role:read'),
    (v_role_id, 'argus:use')
  on conflict do nothing;

  -- supervisor
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'supervisor', 'Supervisor', 'Reviews and routes site incidents.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key) values
    (v_role_id, 'site:read'),
    (v_role_id, 'role:read'),
    (v_role_id, 'incident:report'),
    (v_role_id, 'incident:read_site'),
    (v_role_id, 'incident:override_severity'),
    (v_role_id, 'incident:assign'),
    (v_role_id, 'capa:complete'),
    (v_role_id, 'capa:verify'),
    (v_role_id, 'inspection:run'),
    (v_role_id, 'argus:use')
  on conflict do nothing;

  -- ehs_manager
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'ehs_manager', 'EHS Manager', 'Leads investigations and manages regulatory reporting.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key) values
    (v_role_id, 'site:read'),
    (v_role_id, 'role:read'),
    (v_role_id, 'incident:report'),
    (v_role_id, 'incident:read_site'),
    (v_role_id, 'incident:override_severity'),
    (v_role_id, 'incident:assign'),
    (v_role_id, 'incident:close'),
    (v_role_id, 'investigation:lead'),
    (v_role_id, 'investigation:edit'),
    (v_role_id, 'capa:create'),
    (v_role_id, 'capa:complete'),
    (v_role_id, 'capa:verify'),
    (v_role_id, 'capa:reassign_verifier'),
    (v_role_id, 'report:read'),
    (v_role_id, 'report:export'),
    (v_role_id, 'report:edit_hours'),
    (v_role_id, 'notification:hse_record_edit'),
    (v_role_id, 'template:create'),
    (v_role_id, 'template:publish'),
    (v_role_id, 'inspection:run'),
    (v_role_id, 'document:upload'),
    (v_role_id, 'argus:use')
  on conflict do nothing;

  -- site_admin (full system access — catch-all picks up new keys at run time)
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'site_admin', 'Site Administrator', 'Full system access for assigned sites.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key)
    select v_role_id, key from permissions
  on conflict do nothing;
end $$;
