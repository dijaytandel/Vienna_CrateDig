-- Web push for merchant broadcasts (T-31).
-- Subscriptions live on the profile (keeps the six-table model); one entry per
-- device: {"endpoint": "https://...", "keys": {"p256dh": "...", "auth": "..."}}.
-- Clients never read or write this column; the API does with the service role.
alter table public.profiles
  add column push_subscriptions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(push_subscriptions) = 'array' and jsonb_array_length(push_subscriptions) <= 10);

-- Stores a device's subscription for a user and turns broadcast push on.
-- A device belongs to one account at a time, so the endpoint is dropped from
-- every other profile first. Keeps the 9 most recent other devices.
create or replace function public.save_push_subscription(p_user_id uuid, p_subscription jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_endpoint text := p_subscription ->> 'endpoint';
begin
  if v_endpoint is null or v_endpoint !~ '^https://' then
    raise exception 'subscription endpoint must be https' using errcode = '22023';
  end if;
  update public.profiles
     set push_subscriptions = (
           select coalesce(jsonb_agg(e), '[]'::jsonb)
             from jsonb_array_elements(push_subscriptions) e
            where e ->> 'endpoint' <> v_endpoint)
   where user_id <> p_user_id
     and push_subscriptions @> jsonb_build_array(jsonb_build_object('endpoint', v_endpoint));
  update public.profiles
     set push_subscriptions = (
           select jsonb_agg(e order by ord)
             from (
               select p_subscription as e, 0 as ord
               union all
               select e, ord from (
                 select e, ord
                   from jsonb_array_elements(push_subscriptions) with ordinality as t(e, ord)
                  where e ->> 'endpoint' <> v_endpoint
                  order by ord desc
                  limit 9) recent
             ) kept),
         push_broadcasts_enabled = true,
         updated_at = now()
   where user_id = p_user_id;
end;
$$;

-- Removes a device's subscription. With a user, only from that user (and push
-- turns off when it was their last device); without one, from anyone (used
-- when the push service reports the subscription is gone).
create or replace function public.remove_push_subscription(p_endpoint text, p_user_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
     set push_subscriptions = kept.subs,
         push_broadcasts_enabled = case
           when p_user_id is not null and jsonb_array_length(kept.subs) = 0 then false
           else p.push_broadcasts_enabled end,
         updated_at = now()
    from (
      select pr.user_id,
             coalesce((select jsonb_agg(e) from jsonb_array_elements(pr.push_subscriptions) e
                        where e ->> 'endpoint' <> p_endpoint), '[]'::jsonb) as subs
        from public.profiles pr
       where (p_user_id is null or pr.user_id = p_user_id)
         and pr.push_subscriptions @> jsonb_build_array(jsonb_build_object('endpoint', p_endpoint))
    ) kept
   where p.user_id = kept.user_id;
$$;

-- Who to notify about a new broadcast from a store: opted-in users with a
-- subscription who favorited the store, or whose home ZIP is within their
-- default radius of it. The store's own manager is skipped.
create or replace function public.broadcast_push_targets(p_store_id uuid)
returns table (user_id uuid, subscriptions jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.push_subscriptions
    from public.stores s
    join public.profiles p on p.push_broadcasts_enabled
                          and jsonb_array_length(p.push_subscriptions) > 0
                          and p.user_id is distinct from s.manager_user_id
    left join public.zip_centroids z on z.zip = p.default_zip
   where s.store_id = p_store_id
     and (s.store_id = any (p.favorite_store_ids)
          or (z.zip is not null
              and public.distance_mi(z.geo_lat::float8, z.geo_lng::float8,
                                     s.geo_lat::float8, s.geo_lng::float8)
                  <= p.default_radius_miles));
$$;

revoke execute on function public.save_push_subscription(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.remove_push_subscription(text, uuid) from public, anon, authenticated;
revoke execute on function public.broadcast_push_targets(uuid) from public, anon, authenticated;
grant execute on function public.save_push_subscription(uuid, jsonb) to service_role;
grant execute on function public.remove_push_subscription(text, uuid) to service_role;
grant execute on function public.broadcast_push_targets(uuid) to service_role;
