-- ============================================================================
-- Food Rescue — Supabase Security & Schema Hardening Reference
-- ============================================================================
-- NOTE: This file is a security audit reference / template for verifying your
-- live Supabase database in the SQL Editor (or capturing into
-- `supabase/migrations/` once dumped from your live project).
-- Do NOT blindly overwrite production tables without inspecting existing data.
-- ============================================================================

-- 1. Verify RLS is enabled on BOTH tables and Realtime is NOT exposing private details
alter table public.listings enable row level security;
alter table public.listing_pickup_details enable row level security;

-- Ensure `listing_pickup_details` is NOT in the `supabase_realtime` publication:
-- alter publication supabase_realtime drop table public.listing_pickup_details;

-- 2. Verify strict RLS on `listing_pickup_details` (donor or successful claimant ONLY)
revoke all on public.listing_pickup_details from anon, authenticated;
grant select on public.listing_pickup_details to authenticated;

drop policy if exists "pickup_details_select_authorized" on public.listing_pickup_details;
create policy "pickup_details_select_authorized"
on public.listing_pickup_details
for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_pickup_details.listing_id
      and (
        l.posted_by = (select auth.uid())
        or (
          l.claimed_by = (select auth.uid())
          and l.status in ('claimed', 'picked_up')
        )
      )
  )
);

-- 3. Recommended server-side constraints on `listings` and `listing_pickup_details`
-- alter table public.listings
--   add constraint listings_pickup_window_valid check (pickup_window_end > pickup_window_start),
--   add constraint listings_title_len check (char_length(btrim(title)) between 2 and 100),
--   add constraint listings_approx_lat_range check (approx_latitude is null or approx_latitude between -90 and 90),
--   add constraint listings_approx_lon_range check (approx_longitude is null or approx_longitude between -180 and 180);
--
-- alter table public.listing_pickup_details
--   add constraint pickup_address_len check (char_length(btrim(pickup_address)) between 5 and 300),
--   add constraint contact_phone_e164 check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$');

-- 4. Hardened SECURITY DEFINER RPC requirements checklist:
--    Every SECURITY DEFINER function MUST include:
--      SET search_path = public, pg_temp
--    and verify:
--      - `auth.uid() is not null`
--      - In `claim_listing`:
--          * `posted_by <> auth.uid()` (prevent self-claiming)
--          * `status = 'available' and pickup_window_end > now()`
--          * Active claim cap (e.g., max 3 active claimed listings per user to prevent hoarding)
--      - In `mark_listing_picked_up`:
--          * `claimed_by = auth.uid() and status = 'claimed'`

-- 5. Storage bucket (`listing-photos`) hardening checklist:
--    - Restrict MIME types to image/jpeg, image/png, image/webp
--    - Restrict max file size to 5 MB (5242880 bytes)
--    - Insert policy: `bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]`
--    - Delete policy: `bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]`

