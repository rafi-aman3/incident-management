-- ============================================================================
-- Phase 18 — Onboarding + Get Started redesign
-- ============================================================================
-- 1. orgs.onboarding_use_cases text[]   — wizard step 2 pick + later edits
-- 2. orgs.onboarding_dismissed text[]   — per-org dismissed checklist item ids
-- 3. Backfill onboarding_use_cases for existing orgs from real activity
-- ============================================================================

begin;

-- 1 + 2. New columns on orgs --------------------------------------------------
alter table public.orgs
  add column onboarding_use_cases text[] not null default '{}',
  add column onboarding_dismissed text[] not null default '{}';

comment on column public.orgs.onboarding_use_cases is
  'Use-case keys picked in the onboarding wizard step 2. Allowed values: incidents, inspections, hazards_jsa, assets_documents, planner. Editable later from /get-started.';
comment on column public.orgs.onboarding_dismissed is
  'Item ids the org has dismissed from /get-started (e.g. invite_team). Counts toward the done numerator.';

-- 3. Backfill use-cases from existing activity --------------------------------
-- Every existing org gets onboarding_use_cases inferred from whether they've
-- used each module. Empty result is fine (silent orgs see only the always-
-- shown Workspace section). Joins via sites for tables that don't carry
-- org_id directly.
update public.orgs o set onboarding_use_cases = array(
  select v.uc from (values
    ('incidents',        exists(select 1 from public.incidents      where org_id = o.id and is_sandbox = false and deleted_at is null)),
    ('inspections',      exists(select 1 from public.inspections    where org_id = o.id and deleted_at is null)),
    ('hazards_jsa',      exists(select 1 from public.hazards        where org_id = o.id)
                       or exists(select 1 from public.jsas          where org_id = o.id)),
    ('assets_documents', exists(select 1 from public.assets         where org_id = o.id)
                       or exists(select 1 from public.documents     where org_id = o.id and archived_at is null)),
    ('planner',          exists(select 1 from public.template_assignments ta
                                join public.sites s on s.id = ta.site_id
                                where s.org_id = o.id and ta.unassigned_at is null))
  ) v(uc, has_it)
  where v.has_it = true
);

commit;
