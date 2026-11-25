-- ============================================================================
-- Food Rescue — Edit Listing, In-App Pickup Chat, Paginated Feed & Rate Limits
-- ============================================================================

-- 1. In-app messaging between donor and active claimant
create table if not exists public.listing_messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists listing_messages_listing_created_idx
  on public.listing_messages (listing_id, created_at asc);

alter table public.listing_messages enable row level security;
revoke all on public.listing_messages from anon, authenticated;
grant select on public.listing_messages to authenticated;

drop policy if exists "listing_messages_select_participants" on public.listing_messages;
create policy "listing_messages_select_participants"
on public.listing_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_messages.listing_id
      and (
        l.posted_by = (select auth.uid())
        or (
          l.claimed_by = (select auth.uid())
          and l.status in ('claimed', 'picked_up')
        )
      )
  )
);

-- 2. Send listing message RPC (donor <-> claimant only)
create or replace function public.send_listing_message(
  p_listing_id uuid,
  p_body text
)
returns public.listing_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trimmed text := btrim(coalesce(p_body, ''));
  v_msg public.listing_messages;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(v_trimmed) < 1 or char_length(v_trimmed) > 500 then
    raise exception 'Message must be between 1 and 500 characters';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and (
        l.posted_by = v_user_id
        or (
          l.claimed_by = v_user_id
          and l.status in ('claimed', 'picked_up')
        )
      )
  ) then
    raise exception 'Not authorized to message on this listing';
  end if;

  insert into public.listing_messages (listing_id, sender_id, body)
  values (p_listing_id, v_user_id, v_trimmed)
  returning * into v_msg;

  return v_msg;
end;
$$;

revoke all on function public.send_listing_message(uuid, text) from public;
grant execute on function public.send_listing_message(uuid, text) to authenticated;

-- 3. Donor edit available listing RPC
create or replace function public.edit_listing(
  p_listing_id uuid,
  p_title text,
  p_description text,
  p_quantity text,
  p_pickup_window_end timestamptz
)
returns public.listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_updated public.listings;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(v_title) < 2 or char_length(v_title) > 100 then
    raise exception 'Title must be between 2 and 100 characters';
  end if;

  update public.listings
  set title = v_title,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      quantity = nullif(btrim(coalesce(p_quantity, '')), ''),
      pickup_window_end = p_pickup_window_end
  where id = p_listing_id
    and posted_by = v_user_id
    and status = 'available'
    and p_pickup_window_end > pickup_window_start
    and p_pickup_window_end > now()
  returning * into v_updated;

  if not found then
    return null;
  end if;

  return v_updated;
end;
$$;

revoke all on function public.edit_listing(uuid, text, text, text, timestamptz) from public;
grant execute on function public.edit_listing(uuid, text, text, text, timestamptz) to authenticated;

-- 4. Server-side paginated feed RPC (avoids downloading historical expired rows)
create or replace function public.get_listings_feed(
  p_limit integer default 100,
  p_offset integer default 0
)
returns setof public.listings
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select *
  from public.listings
  where status <> 'available'
     or pickup_window_end > now()
  order by created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_listings_feed(integer, integer) to authenticated;

-- 5. Anti-hoarding & spam guard triggers (server-enforced rate limits)
create or replace function public.enforce_listing_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_posts integer;
  v_active_claims integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into v_active_posts
    from public.listings
    where posted_by = new.posted_by
      and status = 'available'
      and pickup_window_end > now();

    if v_active_posts >= 10 then
      raise exception 'Active listing limit reached (max 10 active available listings)';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'available'
     and new.status = 'claimed'
     and new.claimed_by is not null then
    select count(*) into v_active_claims
    from public.listings
    where claimed_by = new.claimed_by
      and status = 'claimed';

    if v_active_claims >= 3 then
      raise exception 'Active claim limit reached (max 3 simultaneous claims)';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_listing_limits on public.listings;
create trigger trg_enforce_listing_limits
before insert or update on public.listings
for each row
execute function public.enforce_listing_limits();

