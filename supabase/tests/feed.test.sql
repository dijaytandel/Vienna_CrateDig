begin;
select plan(7);

-- Downtown Portland; 25 mi covers every seeded store.
select ok((select count(*) from public.feed_page(45.52, -122.68, 25)) > 0, 'feed has items');
select ok(
  (select bool_and(kind in ('sighting', 'broadcast')) and count(distinct kind) = 2
     from public.feed_page(45.52, -122.68, 25, null, null, 100)),
  'mixes sightings and broadcasts');
select ok(
  (select bool_and(prev is null or prev >= posted_at) from (
     select posted_at, lag(posted_at) over () as prev
     from public.feed_page(45.52, -122.68, 25, null, null, 100)) t),
  'newest first');

update public.sightings set status = 'sold_out'
  where sighting_id = (select item_id from public.feed_page(45.52, -122.68, 25) where kind = 'sighting' limit 1)
  returning sighting_id \gset sold_
select is(
  (select count(*) from public.feed_page(45.52, -122.68, 25, null, null, 100)
     where item_id = :'sold_sighting_id'),
  0::bigint, 'only active sightings');

insert into public.merchant_broadcasts (broadcast_id, store_id, arrival_summary, posted_at)
values ('70000000-0000-0000-0000-000000000001', '00000000-0000-4000-8000-000000000001',
        'Old news', now() - interval '181 days');
select is(
  (select count(*) from public.feed_page(45.52, -122.68, 25, null, null, 100)
     where item_id = '70000000-0000-0000-0000-000000000001'),
  0::bigint, 'items older than 180 days are left out');

with first as (
  select posted_at, item_id from public.feed_page(45.52, -122.68, 25, null, null, 5)
  order by posted_at, item_id limit 1
)
select ok(
  (select bool_and((p.posted_at, p.item_id) < (f.posted_at, f.item_id))
     from first f, public.feed_page(45.52, -122.68, 25, f.posted_at, f.item_id, 5) p),
  'the cursor returns only older items');

select ok(
  not has_function_privilege('anon',
    'public.feed_page(double precision, double precision, double precision, timestamptz, uuid, integer)',
    'execute'),
  'clients cannot call it directly');

select * from finish();
rollback;
