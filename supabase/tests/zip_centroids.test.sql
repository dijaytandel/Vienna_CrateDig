begin;
select plan(5);

select cmp_ok((select count(*) from public.zip_centroids), '>', 33000::bigint,
  'zip_centroids covers the national ZCTA list');
select results_eq(
  $$ select geo_lat::numeric(6, 2), geo_lng::numeric(7, 2) from public.zip_centroids where zip = '97205' $$,
  $$ values (45.52::numeric(6, 2), -122.71::numeric(7, 2)) $$,
  '97205 resolves to downtown Portland');

set local role anon;
select isnt_empty($$ select 1 from public.zip_centroids where zip = '10001' $$,
  'guests can look up a ZIP');
select throws_ok($$ insert into public.zip_centroids values ('00000', 0, 0) $$, '42501', null,
  'guests cannot add ZIPs');
reset role;

set local role authenticated;
select throws_ok($$ delete from public.zip_centroids where zip = '97205' $$, '42501', null,
  'signed-in users cannot remove ZIPs');
reset role;

select * from finish();
rollback;
