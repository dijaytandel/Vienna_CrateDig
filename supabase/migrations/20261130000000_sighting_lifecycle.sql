-- T-21 / T-22 / T-32: sighting archival, idempotent reports and an audit trail
-- of every status or verification change. Sightings are never deleted.

create extension if not exists pg_cron;
create extension if not exists unaccent with schema extensions;

alter table public.sightings add column client_ref uuid unique;

create index sightings_active_idx on public.sightings (sighting_timestamp desc)
  where status = 'active';
create index sightings_user_time_idx on public.sightings (user_id, sighting_timestamp desc);

-- Who changed what. actor_id comes from the API (app.actor) or the caller's JWT.
create table public.sighting_events (
  event_id bigint generated always as identity primary key,
  sighting_id uuid not null references public.sightings (sighting_id) on delete cascade,
  actor_id uuid references public.profiles (user_id) on delete set null,
  action text not null check (action in ('confirm', 'flag', 'mark_sold', 'acquire', 'archive', 'update')),
  from_status public.sighting_status not null,
  to_status public.sighting_status not null,
  store_verified boolean not null,
  created_at timestamptz not null default now()
);
create index sighting_events_sighting_idx on public.sighting_events (sighting_id, created_at);
alter table public.sighting_events enable row level security;
revoke all on public.sighting_events from anon, authenticated;

create or replace function public.log_sighting_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(nullif(current_setting('app.actor', true), '')::uuid, auth.uid());
  v_action text := nullif(current_setting('app.action', true), '');
begin
  if new.status is not distinct from old.status
    and new.store_verified is not distinct from old.store_verified then
    return new;
  end if;
  v_action := coalesce(v_action, case
    when new.status = 'archived' then 'archive'
    when new.status = 'flagged' then 'flag'
    when new.status = 'sold_out' then 'mark_sold'
    when new.store_verified and not old.store_verified then 'confirm'
    else 'update' end);
  insert into public.sighting_events
    (sighting_id, actor_id, action, from_status, to_status, store_verified)
  values (new.sighting_id, v_actor, v_action, old.status, new.status, new.store_verified);
  new.updated_at := now();
  return new;
end;
$$;

create trigger sightings_log_event
  before update of status, store_verified on public.sightings
  for each row execute function public.log_sighting_event();

-- Acquire marks sightings sold out on the collector's behalf; label those events.
create or replace function public.acquire_crate_item(
  p_user uuid,
  p_item uuid,
  p_store uuid,
  p_price numeric
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_item public.crate_items;
  v_closed uuid[] := '{}';
begin
  select * into v_item
  from public.crate_items
  where crate_item_id = p_item and user_id = p_user
  for update;
  if not found then
    raise exception 'crate item not found' using errcode = 'CD404';
  end if;
  if v_item.list_type <> 'want_list' then
    raise exception 'item is already in the collection' using errcode = 'CD409';
  end if;
  if p_store is not null and not exists (select 1 from public.stores where store_id = p_store) then
    raise exception 'store not found' using errcode = 'CD422';
  end if;

  perform set_config('app.actor', p_user::text, true);
  perform set_config('app.action', 'acquire', true);

  update public.crate_items
  set list_type = 'collection',
      acquired_at = now(),
      purchased_store_id = p_store,
      purchase_price_usd = coalesce(p_price, purchase_price_usd)
  where crate_item_id = p_item;

  if p_store is not null then
    with closed as (
      update public.sightings
      set status = 'sold_out'
      where store_id = p_store and record_id = v_item.record_id and status = 'active'
      returning sighting_id
    )
    select coalesce(array_agg(sighting_id), '{}') into v_closed from closed;
  end if;

  perform set_config('app.action', '', true);
  return jsonb_build_object('closedSightingIds', to_jsonb(v_closed));
end;
$$;

-- Daily archival of active sightings past their archive date (never deleted).
create or replace function public.archive_expired_sightings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.sightings
  set status = 'archived'
  where status = 'active' and archive_date <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.archive_expired_sightings() from public, anon, authenticated;

select cron.schedule('archive-expired-sightings', '15 3 * * *',
  'select public.archive_expired_sightings()');

-- Service-role call to change a sighting as a verified manager, logging the actor.
create or replace function public.moderate_sighting(p_actor uuid, p_sighting uuid, p_action text)
returns public.sightings
language plpgsql
set search_path = ''
as $$
declare
  v_row public.sightings;
begin
  perform set_config('app.actor', p_actor::text, true);
  perform set_config('app.action', p_action, true);
  update public.sightings
  set store_verified = case when p_action = 'confirm' then true else store_verified end,
      status = case p_action
        when 'flag' then 'flagged'::public.sighting_status
        when 'mark_sold' then 'sold_out'::public.sighting_status
        else status end
  where sighting_id = p_sighting and status <> 'archived'
  returning * into v_row;
  if not found then
    raise exception 'sighting not found' using errcode = 'CD404';
  end if;
  perform set_config('app.action', '', true);
  return v_row;
end;
$$;
revoke execute on function public.moderate_sighting(uuid, uuid, text) from public, anon, authenticated;
