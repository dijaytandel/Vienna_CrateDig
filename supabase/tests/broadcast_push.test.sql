begin;
select plan(9);

\set store '''00000000-0000-4000-8000-000000000001'''
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'fav@x.test'),
  ('a1000000-0000-4000-8000-000000000002', 'near@x.test'),
  ('a1000000-0000-4000-8000-000000000003', 'far@x.test'),
  ('a1000000-0000-4000-8000-000000000004', 'off@x.test');
update public.profiles set default_zip = '10001' where email in ('fav@x.test', 'far@x.test');
update public.profiles set default_zip = '97205' where email in ('near@x.test', 'off@x.test');
update public.profiles set favorite_store_ids = array[:store]::uuid[] where email = 'fav@x.test';

select public.save_push_subscription(user_id,
  jsonb_build_object('endpoint', 'https://push.test/' || email, 'keys', jsonb_build_object('p256dh', 'k', 'auth', 'a')))
  from public.profiles where email in ('fav@x.test', 'near@x.test', 'far@x.test', 'off@x.test');
update public.profiles set push_broadcasts_enabled = false where email = 'off@x.test';

select ok((select push_broadcasts_enabled from public.profiles where email = 'near@x.test'),
  'saving a subscription turns broadcast push on');
select is(
  (select array_agg(p.email order by p.email)
     from public.broadcast_push_targets(:store) t join public.profiles p using (user_id)
    where p.email like '%@x.test'),
  array['fav@x.test', 'near@x.test'],
  'targets favorites and users within their radius, skips far and opted-out users');

select public.save_push_subscription('a1000000-0000-4000-8000-000000000002',
  '{"endpoint": "https://push.test/near@x.test", "keys": {"p256dh": "k2", "auth": "a2"}}');
select is(
  (select jsonb_array_length(push_subscriptions) from public.profiles where email = 'near@x.test'),
  1, 'resubscribing the same device replaces it');

-- The fav user's device signs into the near account.
select public.save_push_subscription('a1000000-0000-4000-8000-000000000002',
  '{"endpoint": "https://push.test/fav@x.test", "keys": {"p256dh": "k", "auth": "a"}}');
select is(
  (select jsonb_array_length(push_subscriptions) from public.profiles where email = 'fav@x.test'),
  0, 'a device moves off the previous account');
select is(
  (select push_subscriptions -> 0 ->> 'endpoint' from public.profiles where email = 'near@x.test'),
  'https://push.test/fav@x.test', 'newest device comes first');

select public.remove_push_subscription('https://push.test/far@x.test');
select ok(
  (select jsonb_array_length(push_subscriptions) = 0 and push_broadcasts_enabled
     from public.profiles where email = 'far@x.test'),
  'dead subscriptions are dropped without touching the preference');

select public.remove_push_subscription('https://push.test/near@x.test', 'a1000000-0000-4000-8000-000000000002');
select ok((select push_broadcasts_enabled from public.profiles where email = 'near@x.test'),
  'push stays on while another device is subscribed');
select public.remove_push_subscription('https://push.test/fav@x.test', 'a1000000-0000-4000-8000-000000000002');
select ok(not (select push_broadcasts_enabled from public.profiles where email = 'near@x.test'),
  'unsubscribing the last device turns push off');

set local role authenticated;
select throws_ok($$ select * from public.broadcast_push_targets('00000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'clients cannot list push targets');
reset role;

select * from finish();
rollback;
