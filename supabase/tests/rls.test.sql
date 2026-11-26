begin;
select plan(25);

-- Fixtures (as postgres, bypassing RLS)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local', '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'mara@test.local', '{"display_name":"Mara"}');
update public.profiles set user_role = 'store_manager'
  where user_id = '00000000-0000-0000-0000-00000000000c';

insert into public.stores (store_id, manager_user_id, business_name, street_address, city, state,
  zip, geo_lat, geo_lng, verification_status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'Mara''s',
    '1 Main St', 'Springfield', 'IL', '62701', 39.8, -89.6, 'verified'),
  ('10000000-0000-0000-0000-000000000002', null, 'Other Shop',
    '2 Main St', 'Springfield', 'IL', '62701', 39.8, -89.6, 'verified');
insert into public.master_records (record_id, api_source_id, artist_name, album_title)
  values ('20000000-0000-0000-0000-000000000001', 'discogs:1', 'Nirvana', 'Nevermind');
insert into public.sightings (sighting_id, record_id, store_id, user_id, price_usd, condition_grade, status) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 25, 'vg', 'active'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 25, 'vg', 'active'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 25, 'vg', 'archived');
insert into public.crate_items (user_id, record_id, list_type) values
  ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', 'collection');

-- Guests
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*) from public.stores where city = 'Springfield' and street_address like '_ Main St'), 2::bigint, 'guests read the store directory');
select is((select count(*) from public.sightings where sighting_id::text like '30000000-%'), 3::bigint, 'guests read sightings');
select throws_ok($$select license_doc_url from public.stores$$, '42501', null,
  'guests cannot read business license links');
select is((select count(*) from public.profiles), 0::bigint, 'guests read no profiles');
select is((select count(*) from public.crate_items), 0::bigint, 'guests read no crate items');
select throws_ok(
  $$insert into public.sightings (record_id, store_id, price_usd, condition_grade)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'vg')$$,
  '42501', null, 'guests cannot report sightings');

-- Alice, a collector
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select array_agg(display_name) from public.profiles), array['Alice'], 'users read only their own profile');
select is((select count(*) from public.crate_items), 0::bigint, 'users cannot read another user''s crate');
select throws_ok(
  $$insert into public.sightings (record_id, store_id, user_id, price_usd, condition_grade)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-00000000000a', 1, 'vg')$$,
  '42501', null, 'collectors report through the API, not by direct insert');
select is_empty(
  $$update public.profiles set display_name = 'Hacked'
    where user_id = '00000000-0000-0000-0000-00000000000b' returning 1$$,
  'users cannot modify another user''s profile');
select is_empty(
  $$update public.crate_items set user_notes = 'mine now'
    where user_id = '00000000-0000-0000-0000-00000000000b' returning 1$$,
  'users cannot modify another user''s crate items');
select throws_ok(
  $$insert into public.crate_items (user_id, record_id, list_type)
    values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', 'want_list')$$,
  '42501', null, 'users cannot add to another user''s crate');
select lives_ok(
  $$insert into public.crate_items (user_id, record_id, list_type)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', 'want_list')$$,
  'users manage their own crate');
select throws_ok(
  $$update public.profiles set user_role = 'store_manager'
    where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'users cannot change their own role');
select throws_ok(
  $$update public.stores set verification_status = 'verified'$$,
  '42501', null, 'clients cannot change verification_status');
select is_empty(
  $$update public.sightings set status = 'sold_out' returning 1$$,
  'collectors cannot change sighting status');
select throws_ok($$truncate public.crate_items$$, '42501', null, 'clients cannot truncate tables');

-- Mara, verified manager of store 1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select results_eq(
  $$update public.sightings set status = 'sold_out', store_verified = true
    where sighting_id::text like '30000000-%' and status = 'active' returning sighting_id$$,
  $$values ('30000000-0000-0000-0000-000000000001'::uuid)$$,
  'managers update sightings only in their own verified store');
select throws_ok(
  $$update public.sightings set status = 'active'
    where sighting_id = '30000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'managers cannot revive archived sightings');
select throws_ok(
  $$update public.sightings set status = 'archived'
    where sighting_id = '30000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'managers cannot archive sightings');
select lives_ok(
  $$update public.stores set phone = '555-0100', tags = '{jazz}'
    where store_id = '10000000-0000-0000-0000-000000000001'$$,
  'managers edit their listing details');
select throws_ok(
  $$update public.stores set business_name = 'Something Else'
    where store_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'managers cannot rename a verified store');
select lives_ok(
  $$insert into public.merchant_broadcasts (store_id, arrival_summary)
    values ('10000000-0000-0000-0000-000000000001', 'New jazz arrivals')$$,
  'managers broadcast for their own store');
select throws_ok(
  $$insert into public.merchant_broadcasts (store_id, arrival_summary)
    values ('10000000-0000-0000-0000-000000000002', 'Fake news')$$,
  '42501', null, 'managers cannot broadcast for another store');
select throws_ok(
  $$update public.stores set manager_user_id = null$$,
  '42501', null, 'managers cannot reassign store ownership');

select * from finish();
rollback;
