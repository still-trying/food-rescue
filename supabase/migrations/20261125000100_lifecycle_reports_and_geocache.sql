-- ============================================================================
-- Food Rescue — Lifecycle RPCs, Reports & Geocode Cache Migration
-- ============================================================================
-- Run this migration against your Supabase project to enable:
--   1. cancel_listing(p_listing_id)  (donor cancels own available listing)
--   2. unclaim_listing(p_listing_id) (claimant releases claim before pickup)
--   3. listing_reports table + report_listing(p_listing_id, p_reason, p_details)
--   4. geocode_cache table (used by `geocode-area` Edge Function)
-- ============================================================================

-- 1. Geocode Cache table (for Edge Function proxy)
create table if not exists public.geocode_cache (
  query_key text primary key,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;
-- Only service_role (Edge Functions) reads/writes geocode_cache.
revoke all on public.geocode_cache from anon, authenticated;

-- 2. Listing Reports table
create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in ('unsafe_food', 'spam', 'wrong_location', 'harassment', 'other')
  ),
  details text check (details is null or char_length(details) <= 300),
  created_at timestamptz not null default now(),
  unique (listing_id, reported_by)
);

alter table public.listing_reports enable row level security;
revoke all on public.listing_reports from anon, authenticated;
grant select on public.listing_reports to authenticated;

drop policy if exists "listing_reports_select_own" on public.listing_reports;
create policy "listing_reports_select_own"
on public.listing_reports
for select
to authenticated
using (reported_by = (select auth.uid()));

-- 3. Donor Cancel Available Listing RPC
create or replace function public.cancel_listing(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.listings
  where id = p_listing_id
    and posted_by = v_user_id
    and status = 'available';

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;

revoke all on function public.cancel_listing(uuid) from public;
grant execute on function public.cancel_listing(uuid) to authenticated;

-- 4. Claimant Release / Unclaim Listing RPC
create or replace function public.unclaim_listing(p_listing_id uuid)
returns public.listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated public.listings;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.listings
  set status = 'available',
      claimed_by = null
  where id = p_listing_id
    and claimed_by = v_user_id
    and status = 'claimed'
    and pickup_window_end > now()
  returning * into v_updated;

  if not found then
    return null;
  end if;

  return v_updated;
end;
$$;

revoke all on function public.unclaim_listing(uuid) from public;
grant execute on function public.unclaim_listing(uuid) to authenticated;

-- 5. Report Listing RPC
create or replace function public.report_listing(
  p_listing_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing_owner uuid;
  v_report_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select posted_by into v_listing_owner
  from public.listings
  where id = p_listing_id;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_listing_owner = v_user_id then
    raise exception 'Cannot report your own listing';
  end if;

  insert into public.listing_reports (listing_id, reported_by, reason, details)
  values (
    p_listing_id,
    v_user_id,
    p_reason,
    nullif(btrim(coalesce(p_details, '')), '')
  )
  on conflict (listing_id, reported_by)
  do update set
    reason = excluded.reason,
    details = excluded.details
  returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.report_listing(uuid, text, text) from public;
grant execute on function public.report_listing(uuid, text, text) to authenticated;

-- 6. Optional Scheduled Hygiene (requires pg_cron extension enabled)
-- select cron.schedule(
--   'archive-expired-unclaimed-listings',
--   '0 * * * *',
--   $$delete from public.listings where status = 'available' and pickup_window_end < now() - interval '7 days';$$
-- );

