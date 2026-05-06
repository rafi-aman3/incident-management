-- ----------------------------------------------------------------------------
-- Phase 6a polish — fix site_members RLS recursion
--
-- The original site_members_read policy from 20260505120000_init.sql was:
--
--   profile_id = auth.uid()
--   or exists (select 1 from site_members sm
--               where sm.site_id = site_members.site_id
--                 and sm.profile_id = auth.uid())
--
-- The exists subquery references site_members from inside the site_members
-- policy — Postgres evaluates the policy on each candidate row of the
-- subquery, which evaluates the policy again, etc. PG returns:
--
--   "infinite recursion detected in policy for relation site_members"
--
-- This blows up every authenticated read against the table:
-- requireUser()'s membership join, the topbar SiteSwitcher, RBAC checks
-- — all silently return zero rows + an error. From the user's POV: their
-- session shows 0 memberships even though the rows exist (and a
-- service-role pnpm db:check confirms 6 rows for admin@demo.local).
--
-- Fix: delegate the peer-visibility check to user_can_access_site() — a
-- SECURITY DEFINER helper from the init migration that already does the
-- recursive-ancestor walk over sites without re-entering RLS. Same intent
-- as the original policy, no self-reference.
-- ----------------------------------------------------------------------------

drop policy if exists site_members_read on site_members;

create policy site_members_read on site_members for select to authenticated
  using (
    profile_id = auth.uid()
    or user_can_access_site(site_id)
  );
