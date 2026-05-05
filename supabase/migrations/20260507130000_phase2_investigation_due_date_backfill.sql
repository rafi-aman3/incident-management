-- ============================================================================
-- Phase 2 — investigation due_date safety-net backfill
-- ============================================================================
-- classify_incident_v1 (Phase 1 RPC) already sets investigations.due_date on
-- insert: Track A → +14d, Track B → +7d. This migration only backfills rows
-- that bypassed the RPC (e.g. seed scripts that inserted directly), so the
-- WHERE clause is a no-op when the RPC ran.
--
-- Track is read from the source incident; uses current_date (not the original
-- classified_at) so backfilled rows aren't immediately overdue.
-- ============================================================================

update investigations
   set due_date = (
     case (select track from incidents where id = investigations.incident_id)
       when 'A' then current_date + 14
       when 'B' then current_date + 7
       else null
     end
   )
 where due_date is null
   and deleted_at is null;
