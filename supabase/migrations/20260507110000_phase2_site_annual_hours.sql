-- ============================================================================
-- Phase 2 — site_annual_hours: per-site, per-year hours-worked input for the
-- OSHA 300A Annual Summary (TRIR / DART / Severity Rate calculation).
-- ============================================================================
-- ui-flow §8.15 floats "sites.annual_hours_<year> JSONB or similar"; a
-- dedicated child table is cleaner for the 300A query and tracks
-- updated_by / updated_at for audit. One row per (site, year).
--
-- Read: any site member (RLS).
-- Write: requires permission `report:edit_hours` (ehs_manager + site_admin).
-- ============================================================================

create table site_annual_hours (
  site_id      uuid not null references sites(id) on delete cascade,
  year         smallint not null check (year between 2000 and 2100),
  hours_worked bigint not null check (hours_worked >= 0),
  updated_by   uuid references profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (site_id, year)
);

create trigger site_annual_hours_updated
  before update on site_annual_hours
  for each row execute function set_updated_at();

alter table site_annual_hours enable row level security;

create policy site_annual_hours_read on site_annual_hours for select to authenticated
  using (user_can_access_site(site_id));

create policy site_annual_hours_insert on site_annual_hours for insert to authenticated
  with check (
    has_permission('report:edit_hours', site_id)
    and updated_by = auth.uid()
  );

create policy site_annual_hours_update on site_annual_hours for update to authenticated
  using (has_permission('report:edit_hours', site_id))
  with check (
    has_permission('report:edit_hours', site_id)
    and updated_by = auth.uid()
  );

create policy site_annual_hours_delete on site_annual_hours for delete to authenticated
  using (has_permission('report:edit_hours', site_id));
