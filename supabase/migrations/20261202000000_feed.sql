-- T-27: Discover feed. Active sightings and merchant broadcasts from the last
-- 180 days within a radius, newest first, keyset-paginated on (posted_at, item_id).

create or replace function public.distance_mi(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- Haversine, Earth radius 3958.8 mi (matches the API's distanceMiles).
  select 2 * 3958.8 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create type public.feed_row as (
  kind text,
  item_id uuid,
  posted_at timestamptz,
  distance_mi double precision,
  store_id uuid,
  business_name text,
  store_is_verified boolean,
  price_usd numeric,
  condition_grade public.condition_grade,
  special_attributes text,
  store_verified boolean,
  record_id uuid,
  artist_name text,
  album_title text,
  genre text,
  cover_art_url text,
  arrival_summary text,
  photo_url text,
  featured_ids uuid[]
);

create or replace function public.feed_page(
  p_lat double precision,
  p_lng double precision,
  p_radius_mi double precision,
  p_before_ts timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
)
returns setof public.feed_row
language sql
stable
security definer
set search_path = ''
as $$
  with nearby as (
    select st.store_id, st.business_name, st.verification_status = 'verified' as is_verified,
           public.distance_mi(p_lat, p_lng, st.geo_lat::float8, st.geo_lng::float8) as distance_mi
    from public.stores st
    where st.verification_status <> 'rejected'
      and st.geo_lat between p_lat - p_radius_mi / 69.0 and p_lat + p_radius_mi / 69.0
      and st.geo_lng between p_lng - p_radius_mi / (69.0 * greatest(cos(radians(p_lat)), 0.01))
                         and p_lng + p_radius_mi / (69.0 * greatest(cos(radians(p_lat)), 0.01))
  ),
  stores_in_radius as (
    select * from nearby where distance_mi <= p_radius_mi
  ),
  items as (
    select 'sighting'::text, s.sighting_id, s.sighting_timestamp, n.distance_mi, n.store_id,
           n.business_name, n.is_verified, s.price_usd, s.condition_grade, s.special_attributes,
           s.store_verified, r.record_id, r.artist_name, r.album_title, r.genre, r.cover_art_url,
           null::text, null::text, null::uuid[]
    from stores_in_radius n
    join public.sightings s on s.store_id = n.store_id
    join public.master_records r on r.record_id = s.record_id
    where s.status = 'active'
      and s.sighting_timestamp > now() - interval '180 days'
    union all
    select 'broadcast', b.broadcast_id, b.posted_at, n.distance_mi, n.store_id,
           n.business_name, n.is_verified, null, null, null, null, null, null, null, null, null,
           b.arrival_summary, b.photo_url, b.featured_ids
    from stores_in_radius n
    join public.merchant_broadcasts b on b.store_id = n.store_id
    where b.posted_at > now() - interval '180 days'
  )
  select i.*::public.feed_row
  from items i (kind, item_id, posted_at)
  where p_before_ts is null or (i.posted_at, i.item_id) < (p_before_ts, p_before_id)
  order by i.posted_at desc, i.item_id desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.feed_page(double precision, double precision, double precision, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.feed_page(double precision, double precision, double precision, timestamptz, uuid, integer)
  to service_role;

create index merchant_broadcasts_posted_idx on public.merchant_broadcasts (posted_at desc);
