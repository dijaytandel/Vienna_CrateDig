begin;
select plan(8);

create temp table t as
  select sighting_id, record_id, store_id from public.sightings where status = 'active' order by sighting_id limit 1;

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'acq@x.test');
insert into public.crate_items (crate_item_id, user_id, record_id, list_type)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
  (select record_id from t),
  'want_list');

-- Store selected: that store's active sightings of the record close, others stay.
select is(
  jsonb_array_length(public.acquire_crate_item('11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    (select store_id from t),
    19.5) -> 'closedSightingIds') >= 1,
  true, 'closes the active sighting at the chosen store');
select is((select status::text from public.sightings where sighting_id = (select sighting_id from t)),
  'sold_out', 'sighting is sold out, not deleted');
select is((select list_type::text from public.crate_items where crate_item_id = '22222222-2222-4222-8222-222222222222'),
  'collection', 'item moved to collection');
select isnt((select acquired_at from public.crate_items where crate_item_id = '22222222-2222-4222-8222-222222222222'),
  null, 'acquired_at set');
select is((select purchase_price_usd from public.crate_items where crate_item_id = '22222222-2222-4222-8222-222222222222'),
  19.50::numeric, 'price saved');

select throws_ok($$ select public.acquire_crate_item('11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222', null, null) $$, 'CD409', null, 'collection items cannot be acquired');

-- Acquired elsewhere: no sightings change.
insert into public.crate_items (crate_item_id, user_id, record_id, list_type)
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111',
  (select record_id from public.master_records offset 2 limit 1), 'want_list');
select is(jsonb_array_length(public.acquire_crate_item('11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333', null, null) -> 'closedSightingIds'), 0,
  'acquired elsewhere closes nothing');

-- Unknown store rolls the whole call back.
insert into public.crate_items (crate_item_id, user_id, record_id, list_type)
values ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111',
  (select record_id from public.master_records offset 3 limit 1), 'want_list');
select throws_ok($$ select public.acquire_crate_item('11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444', '99999999-9999-4999-8999-999999999999', null) $$,
  'CD422', null, 'unknown store is rejected and nothing changes');

select * from finish();
rollback;
