begin;
select plan(8);

create temp table t as
  select sighting_id, store_id from public.sightings
  where status = 'active' and not store_verified order by sighting_id limit 1;

-- New sightings archive 180 days after they were seen.
insert into public.sightings (record_id, store_id, price_usd, condition_grade, sighting_timestamp)
values ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001', 10, 'vg',
  '2026-01-01T00:00:00Z');
select is((select archive_date from public.sightings where sighting_timestamp = '2026-01-01T00:00:00Z'),
  '2026-06-30T00:00:00Z'::timestamptz, 'archive_date defaults to +180 days');

-- Back-dated rows archive; fresh ones stay active; nothing is deleted.
insert into public.sightings (record_id, store_id, price_usd, condition_grade, sighting_timestamp)
values ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-000000000001', 10, 'vg',
  now() - interval '181 days');
select ok(public.archive_expired_sightings() >= 2, 'expired sightings archived');
select is((select status::text from public.sightings where sighting_timestamp = '2026-01-01T00:00:00Z'),
  'archived', 'old row archived, not deleted');
select is((select count(*) from public.sightings where status = 'active' and archive_date <= now()), 0::bigint,
  'no expired active sightings remain');
select is((select count(*) from cron.job where jobname = 'archive-expired-sightings'), 1::bigint,
  'daily cron job scheduled');
select is((select action from public.sighting_events
  where sighting_id = (select sighting_id from public.sightings where sighting_timestamp = '2026-01-01T00:00:00Z')),
  'archive', 'archival is logged');

-- Moderation logs the actor.
insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', 'mgr@x.test');
select is((public.moderate_sighting('55555555-5555-4555-8555-555555555555',
  (select sighting_id from t), 'confirm')).store_verified, true, 'confirm sets store_verified');
select is((select actor_id from public.sighting_events where sighting_id = (select sighting_id from t)
  order by event_id desc limit 1), '55555555-5555-4555-8555-555555555555'::uuid, 'actor logged');

select * from finish();
rollback;
