-- ============================================================================
-- Food Rescue — Dietary/Safety Metadata, User Profiles & 2-Step Pickup PIN
-- ============================================================================

-- 1. Optional Food Safety & Dietary Metadata on `listings`
alter table public.listings
  add column if not exists dietary_type text
    check (dietary_type is null or dietary_type in ('veg', 'vegan', 'non_veg', 'eggetarian')),
  add column if not exists allergens text[] not null default '{}',
  add column if not exists storage_type text
    check (storage_type is null or storage_type in ('hot', 'refrigerated', 'room_temp', 'frozen'));

create or replace function public.set_listing_safety_metadata(
  p_listing_id uuid,
  p_dietary_type text default null,
  p_allergens text[] default '{}',
  p_storage_type text default null
)
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
  set dietary_type = p_dietary_type,
      allergens = coalesce(p_allergens, '{}'),
      storage_type = p_storage_type
  where id = p_listing_id
    and posted_by = v_user_id
    and status = 'available'
  returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.set_listing_safety_metadata(uuid, text, text[], text) from public;
grant execute on function public.set_listing_safety_metadata(uuid, text, text[], text) to authenticated;

-- 2. User Profiles & Organization Badges
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) <= 100),
  organization_name text check (organization_name is null or char_length(btrim(organization_name)) <= 120),
  organization_type text check (
    organization_type is null or organization_type in ('individual', 'restaurant', 'bakery', 'ngo', 'catering', 'grocery')
  ),
  is_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()) and is_verified = false);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create or replace function public.protect_profile_verification_flag()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_verified := false;
    elsif tg_op = 'UPDATE' then
      new.is_verified := old.is_verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_verification on public.profiles;
create trigger trg_protect_profile_verification
before insert or update on public.profiles
for each row
execute function public.protect_profile_verification_flag();

-- 3. Optional 4-Digit Handoff PIN on `listing_pickup_details`
alter table public.listing_pickup_details
  add column if not exists pickup_pin text
    check (pickup_pin is null or pickup_pin ~ '^[0-9]{4}$');

create or replace function public.generate_pickup_pin(p_listing_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_pin text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.listings
    where id = p_listing_id
      and (posted_by = v_user_id or claimed_by = v_user_id)
      and status = 'claimed'
  ) then
    raise exception 'Not authorized';
  end if;

  select pickup_pin into v_pin
  from public.listing_pickup_details
  where listing_id = p_listing_id;

  if v_pin is null then
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    update public.listing_pickup_details
    set pickup_pin = v_pin
    where listing_id = p_listing_id;
  end if;

  return v_pin;
end;
$$;

revoke all on function public.generate_pickup_pin(uuid) from public;
grant execute on function public.generate_pickup_pin(uuid) to authenticated;

create or replace function public.verify_and_mark_picked_up(
  p_listing_id uuid,
  p_pin text
)
returns public.listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expected_pin text;
  v_updated public.listings;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select d.pickup_pin into v_expected_pin
  from public.listing_pickup_details d
  where d.listing_id = p_listing_id;

  if v_expected_pin is not null and v_expected_pin <> coalesce(btrim(p_pin), '') then
    raise exception 'Incorrect pickup PIN';
  end if;

  update public.listings
  set status = 'picked_up'
  where id = p_listing_id
    and status = 'claimed'
    and (claimed_by = v_user_id or posted_by = v_user_id)
  returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.verify_and_mark_picked_up(uuid, text) from public;
grant execute on function public.verify_and_mark_picked_up(uuid, text) to authenticated;

