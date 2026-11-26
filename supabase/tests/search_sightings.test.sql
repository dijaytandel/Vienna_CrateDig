begin;
select plan(6);

-- Portland box covering every seeded store.
create temp view hits as
  select * from public.search_sightings(null, 45, 46, -123.5, -122);

select ok((select count(*) from hits) > 0, 'blank query returns active sightings in the box');
select is(
  (select count(*) from hits h join public.sightings s using (sighting_id) where s.status <> 'active'),
  0::bigint, 'only active sightings');

select ok(
  (select count(*) from public.search_sightings('MILES blue', 45, 46, -123.5, -122)) > 0
  and not exists (
    select 1 from public.search_sightings('MILES blue', 45, 46, -123.5, -122)
    where artist_name <> 'Miles Davis'),
  'every term must match artist, album or genre, case-insensitively');

update public.master_records set artist_name = 'Björk' where record_id = (
  select record_id from public.sightings where status = 'active' limit 1);
select ok(
  (select count(*) from public.search_sightings('bjork', 45, 46, -123.5, -122)) > 0,
  'accent-insensitive');

select is(
  (select count(*) from public.search_sightings(null, 10, 11, 10, 11)), 0::bigint,
  'nothing outside the box');

select ok(
  not has_function_privilege('anon',
    'public.search_sightings(text, numeric, numeric, numeric, numeric, integer)', 'execute'),
  'clients cannot call it directly');

select * from finish();
rollback;
