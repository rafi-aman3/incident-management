-- ============================================================================
-- Phase 14 hotfix — generate_hazard_ref_code() referenced a non-existent column
-- ============================================================================
-- The original migration assumed `sites.short_code` existed. It doesn't —
-- sites only has name/country/region. Rebuild the function to derive the
-- 3-letter site prefix from `name` directly:
--   - take alphanumeric chars only, uppercase
--   - first 3 chars
--   - fallback to 'XXX' if the result is empty
--
-- The sequence math (count of existing rows for this prefix+year, +1) is
-- unchanged.
-- ============================================================================

create or replace function generate_hazard_ref_code(p_site_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_site_name text;
  v_site_code text;
  v_year      int := extract(year from now())::int;
  v_seq       int;
  v_prefix    text;
begin
  select name into v_site_name from sites where id = p_site_id;
  -- Strip non-alphanumeric, uppercase, take first 3 chars; fallback 'XXX'.
  v_site_code := upper(substring(regexp_replace(coalesce(v_site_name, ''), '[^A-Za-z0-9]', '', 'g') from 1 for 3));
  if v_site_code is null or v_site_code = '' then
    v_site_code := 'XXX';
  end if;
  v_prefix := 'HAZ-' || v_site_code || '-' || v_year::text || '-';
  select coalesce(max((regexp_match(ref_code, '-(\d+)$'))[1]::int), 0) + 1
    into v_seq
    from hazards
   where ref_code like v_prefix || '%';
  return v_prefix || lpad(v_seq::text, 4, '0');
end $$;
