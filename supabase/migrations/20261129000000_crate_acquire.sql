-- T-14 / T-19: crate item details, duplicate rules and the acquire transaction.

alter table public.crate_items
  add column condition_grade public.condition_grade,
  add column special_attributes text[] not null default '{}'
    check (cardinality(special_attributes) <= 10),
  add column client_ref uuid unique;

-- Owning two copies is allowed (the API warns first); a Want List entry is one per record.
alter table public.crate_items drop constraint crate_items_user_id_record_id_list_type_key;
create unique index crate_items_want_list_once
  on public.crate_items (user_id, record_id) where list_type = 'want_list';

grant select, insert, update, delete on public.crate_items to authenticated;

-- Moves a Want List item to the Collection and closes that store's active sightings
-- of the record, all in one transaction. Called by the API with the service role.
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

  return jsonb_build_object('closedSightingIds', to_jsonb(v_closed));
end;
$$;

revoke execute on function public.acquire_crate_item(uuid, uuid, uuid, numeric) from public, anon, authenticated;
