-- ============================================================================
-- Phase 1 — resolve_permissions(site_id) helper
-- ============================================================================
-- Adds a SQL function that returns the full union of role + team permissions
-- for the current authenticated user, scoped to one site.
--
-- Mirrors the logic in has_permission() but returns the entire set so app code
-- (lib/rbac/resolve.ts) can fetch once per request and cache via React.cache,
-- avoiding N round-trips for sidebar / page-level can() checks.
-- ============================================================================

create or replace function resolve_permissions(p_site_id uuid)
  returns setof text
  language sql
  stable
  security definer
  set search_path = public
as $$
  -- Role permissions: direct site_member binding OR include_children ancestor walk
  select rp.permission_key
    from site_members sm
    join role_permissions rp on rp.role_id = sm.role_id
   where sm.profile_id = auth.uid()
     and (
       sm.site_id = p_site_id
       or (sm.include_children and exists (
         with recursive descendants as (
           select id from sites where id = sm.site_id
           union all
           select s.id
             from sites s
             join descendants d on s.parent_site_id = d.id
         )
         select 1 from descendants where id = p_site_id
       ))
     )
  union
  -- Team permissions: team_members ∩ team_sites
  select tp.permission_key
    from team_members tm
    join team_permissions tp on tp.team_id = tm.team_id
    join team_sites ts on ts.team_id = tm.team_id
   where tm.profile_id = auth.uid()
     and ts.site_id = p_site_id;
$$;
