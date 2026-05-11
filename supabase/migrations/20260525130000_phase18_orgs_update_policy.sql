-- ============================================================================
-- Phase 18 follow-up — orgs UPDATE RLS policy
-- ============================================================================
-- init.sql shipped `orgs_read` only. With RLS enabled but no UPDATE policy,
-- supabase-js .update() calls silently no-op (0 rows affected, no error).
-- Phase 17's updateOrg and Phase 18's dismissItem / undismissItem /
-- updateUseCases all need this policy to apply their mutations.
--
-- Gate: caller must be a member of the org AND hold `org:configure`. Mirrors
-- the orgCan('org:configure') guard already enforced in the server actions.
-- ============================================================================

begin;

create policy orgs_update on public.orgs for update to authenticated
  using (id = current_org() and has_org_permission('org:configure'))
  with check (id = current_org() and has_org_permission('org:configure'));

commit;
