-- ============================================================================
-- Phase 3 — resolve_org_permissions() helper
-- ============================================================================
-- Sibling of resolve_permissions(p_site_id) from Phase 1. Returns the full
-- union of permission keys the current user holds at ANY site they're a
-- member of within their current org. Used for org-scoped checks (templates
-- are org-scoped, not site-scoped) so the app's lib/auth/orgCan.ts can
-- fetch once per request and cache via React.cache.
--
-- Same security model as resolve_permissions: SECURITY DEFINER with a
-- pinned search_path; RLS doesn't apply to the underlying joins because
-- they're driven by auth.uid() and the system role/team tables that are
-- already readable to authenticated users.
-- ============================================================================

create or replace function resolve_org_permissions()
  returns setof text
  language sql
  stable
  security definer
  set search_path = public
as $$
  -- Union of every permission across every site the user is a member of
  select rp.permission_key
    from site_members sm
    join role_permissions rp on rp.role_id = sm.role_id
   where sm.profile_id = auth.uid()
  union
  -- Plus team permissions across every team the user is on (any binding site)
  select tp.permission_key
    from team_members tm
    join team_permissions tp on tp.team_id = tm.team_id
   where tm.profile_id = auth.uid();
$$;
