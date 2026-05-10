-- ============================================================================
-- Phase 9a — drop FKs on incidents.stop_work_*_by → profiles
-- ============================================================================
-- The Phase 9a foundation migration added two FKs from `incidents` to
-- `profiles` (`stop_work_raised_by`, `stop_work_acknowledged_by`) on top of
-- the existing `reporter_id` FK. PostgREST then refuses to auto-embed the
-- already-shipped `reporter:reporter_id(full_name, email)` shorthand because
-- there are now three candidate relationships from `incidents` → `profiles`,
-- and Supabase's TS type generation surfaces this as `SelectQueryError` at
-- every existing call site (incidents detail, investigations, OSHA 301 PDF).
--
-- Rather than rewrite every consumer with `incidents!incidents_<col>_fkey`
-- hints (~6 files), drop the FK constraints on the two audit columns. They
-- still store profile IDs; profiles are soft-deleted only (no hard delete in
-- this product), so referential integrity can't be violated in practice.
--
-- Trade-off explicitly logged: stop-work raiser/acker IDs are uuid columns
-- with no FK; SPEC §17 should record this if it's revisited.
-- ============================================================================

alter table incidents
  drop constraint if exists incidents_stop_work_raised_by_fkey,
  drop constraint if exists incidents_stop_work_acknowledged_by_fkey;
