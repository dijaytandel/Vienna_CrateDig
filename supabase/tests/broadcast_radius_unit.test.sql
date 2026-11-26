begin;
select plan(2);

\set store '''00000000-0000-4000-8000-000000000001'''
insert into auth.users (id, email) values
  ('a2000000-0000-4000-8000-000000000001', 'unit@x.test');

-- A home ZIP 3.5-4.5 mi from the store: inside 5 mi, outside 5 km (3.1 mi).
update public.profiles
   set default_radius_miles = 5,
       default_zip = (select z.zip from public.zip_centroids z, public.stores s
                       where s.store_id = :store
                         and public.distance_mi(z.geo_lat::float8, z.geo_lng::float8,
                                                s.geo_lat::float8, s.geo_lng::float8) between 3.5 and 4.5
                       order by z.zip limit 1)
 where email = 'unit@x.test';
select public.save_push_subscription('a2000000-0000-4000-8000-000000000001',
  '{"endpoint": "https://push.test/unit", "keys": {"p256dh": "k", "auth": "a"}}');

select ok(exists (select 1 from public.broadcast_push_targets(:store)
                   where user_id = 'a2000000-0000-4000-8000-000000000001'),
  'a 5 mi radius reaches a store 4 mi away');

update public.profiles set distance_unit = 'km' where email = 'unit@x.test';
select ok(not exists (select 1 from public.broadcast_push_targets(:store)
                       where user_id = 'a2000000-0000-4000-8000-000000000001'),
  'a 5 km radius does not');

select * from finish();
rollback;
