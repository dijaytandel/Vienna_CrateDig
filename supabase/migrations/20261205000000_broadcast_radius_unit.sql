-- The default radius is 5, 10 or 25 in the user's chosen unit, so a km user's
-- broadcast range must be converted before comparing against miles.
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
                  <= case when p.distance_unit = 'km'
                          then p.default_radius_miles / 1.609344
                          else p.default_radius_miles end));
$$;

revoke execute on function public.broadcast_push_targets(uuid) from public, anon, authenticated;
grant execute on function public.broadcast_push_targets(uuid) to service_role;
