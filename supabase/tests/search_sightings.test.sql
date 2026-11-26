begin;
select plan(9);

-- Downtown Portland, 25 mi covers every seeded store.
select ok(
  (select count(*) from public.search_sightings(null, null, 45.52, -122.68, 25)) > 0,
  'blank query returns active sightings in the radius');
select is(
  (select count(*) from public.search_sightings(null, null, 45.52, -122.68, 25) h
     join public.sightings s using (sighting_id) where s.status <> 'active'),
  0::bigint, 'only active sightings');
select ok(
  not exists (select 1 from public.search_sightings(null, null, 45.52, -122.68, 5)
              where distance_mi > 5),
  'nothing beyond the radius');

select ok(
  (select count(*) from public.search_sightings('MILES blue', null, 45.52, -122.68, 25)) > 0
  and not exists (
    select 1 from public.search_sightings('MILES blue', null, 45.52, -122.68, 25)
    where artist_name <> 'Miles Davis'),
  'every term must match artist, album or genre, case-insensitively');

update public.master_records set artist_name = 'Björk' where record_id = (
  select record_id from public.sightings where status = 'active' limit 1);
select ok(
  (select count(*) from public.search_sightings('bjork', null, 45.52, -122.68, 25)) > 0,
  'accent-insensitive keywords');

select ok(
  not exists (select 1 from public.search_sightings(null, 'JAZZ', 45.52, -122.68, 25)
              where genre <> 'Jazz'),
  'genre filter ignores case');

select is(
  (select array_agg(distance_mi) from (
     select distance_mi from public.search_sightings(null, null, 45.52, -122.68, 25)) d),
  (select array_agg(distance_mi order by distance_mi) from (
     select distance_mi from public.search_sightings(null, null, 45.52, -122.68, 25)) d),
  'sorted nearest first');

select ok(
  'Jazz' = any(array(select public.search_genres(null, 45.52, -122.68, 25))),
  'genres lists the genres of matches');

select ok(
  not has_function_privilege('anon',
    'public.search_sightings(text, text, double precision, double precision, double precision, integer)',
    'execute'),
  'clients cannot call it directly');

select * from finish();
rollback;
