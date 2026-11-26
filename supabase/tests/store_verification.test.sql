begin;
select plan(11);

\set a '''b1000000-0000-4000-8000-000000000001'''
\set b '''b1000000-0000-4000-8000-000000000002'''
\set x '''c1000000-0000-4000-8000-000000000001'''
\set y '''c1000000-0000-4000-8000-000000000002'''
\set verified '''00000000-0000-4000-8000-000000000001'''
insert into auth.users (id, email) values (:a, 'a@claim.test'), (:b, 'b@claim.test');
insert into public.stores (store_id, business_name, street_address, city, state, zip, geo_lat, geo_lng)
values (:x, 'Claim X', '1 X St', 'Portland', 'OR', '97205', 45.52, -122.68),
       (:y, 'Claim Y', '2 Y St', 'Portland', 'OR', '97205', 45.52, -122.68);

select public.claim_store(:a, :x, 'https://license.test/a');
select results_eq(
  $$select manager_user_id, license_doc_url, verification_status::text from public.stores
    where store_id = 'c1000000-0000-4000-8000-000000000001'$$,
  $$values ('b1000000-0000-4000-8000-000000000001'::uuid, 'https://license.test/a', 'pending')$$,
  'a claim records the applicant, license and pending status');
select throws_ok(format('select public.claim_store(%L, %L, %L)', :b, :x, 'https://l.test/b'),
  'CD409', 'this store already has a pending claim', 'a pending claim blocks other applicants');
select throws_ok(format('select public.claim_store(%L, %L, %L)', :b, :verified, 'https://l.test/b'),
  'CD409', 'this store is already verified', 'verified stores cannot be claimed');
select throws_ok(format('select public.claim_store(%L, %L, %L)', :b, :y, 'http://l.test/b'),
  'CD400', 'license URL must start with https://', 'license URLs must be https');

-- A pending claimant cannot edit the listing directly.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :a)::text, true);
update public.stores set phone = '(503) 555-0000' where store_id = :x;
reset role;
select is((select phone from public.stores where store_id = :x), null,
  'pending claimants cannot edit the store');

select public.claim_store(:a, :y, 'https://license.test/a2');
select is((select manager_user_id from public.stores where store_id = :x), null,
  'claiming another store withdraws the earlier claim');

select public.admin_review_store(:y, 'verified');
select is((select user_role::text from public.profiles where user_id = :a), 'store_manager',
  'approval makes the applicant a store manager');
select throws_ok(format('select public.claim_store(%L, %L, %L)', :a, :x, 'https://l.test/a'),
  'CD409', 'you already manage a verified store', 'verified managers cannot claim a second store');

select public.claim_store(:b, :x, 'https://license.test/b');
select public.admin_review_store(:x, 'rejected');
select is((select verification_status::text from public.stores where store_id = :x), 'rejected',
  'rejection is visible on the store');
select public.claim_store(:b, :x, 'https://license.test/b2');
select is((select verification_status::text from public.stores where store_id = :x), 'pending',
  'a rejected applicant can apply again with a new license');

set local role authenticated;
select throws_ok(format('select public.claim_store(%L, %L, %L)', :b, :y, 'https://l.test/b'),
  '42501', null, 'clients cannot call claim_store directly');
reset role;

select * from finish();
rollback;
