-- ============================================================================
-- Food Rescue — pgTAP Security, RLS & Concurrency Test Suite
-- Run locally with: `supabase test db`
-- ============================================================================

begin;

select plan(7);

-- 1. Verify RLS is enabled on sensitive tables
select ok(
  (select relrowsecurity from pg_class where oid = 'public.listings'::regclass),
  'RLS must be enabled on public.listings'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.listing_pickup_details'::regclass),
  'RLS must be enabled on public.listing_pickup_details'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.listing_messages'::regclass),
  'RLS must be enabled on public.listing_messages'
);

-- 2. Verify private tables revoke direct client writes
select ok(
  not has_table_privilege('authenticated', 'public.listing_pickup_details', 'INSERT'),
  'authenticated role cannot INSERT directly into listing_pickup_details'
);

select ok(
  not has_table_privilege('authenticated', 'public.listing_reports', 'INSERT'),
  'authenticated role cannot INSERT directly into listing_reports'
);

-- 3. Verify SECURITY DEFINER functions pin search_path
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cancel_listing'
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') like '%search_path=public%'
  ),
  'cancel_listing must be SECURITY DEFINER with fixed search_path'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'send_listing_message'
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') like '%search_path=public%'
  ),
  'send_listing_message must be SECURITY DEFINER with fixed search_path'
);

select * from finish();

rollback;
