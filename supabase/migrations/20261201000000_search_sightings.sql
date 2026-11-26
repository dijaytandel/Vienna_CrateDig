-- T-24: radius and keyword search over active sightings.
-- Every whitespace-separated term of p_q must appear in the artist, album or
-- genre (case- and accent-insensitive). Results are sorted nearest first, then
-- newest, before the limit, so a busy area never hides the closest copies.

create index stores_geo_idx on public.stores (geo_lat, geo_lng);

create type public.search_hit as (
  sighting_id uuid,
  price_usd numeric,
  condition_grade public.condition_grade,
  special_attributes text,
  store_verified boolean,
  sighting_timestamp timestamptz,
  record_id uuid,
  artist_name text,
  album_title text,
  genre text,
  cover_art_url text,
  store_id uuid,
  business_name text,
  geo_lat numeric,
  geo_lng numeric,
  store_is_verified boolean,
  distance_mi double precision
);

create or replace function public.search_candidates(
  p_q text,
  p_lat double precision,
  p_lng double precision,
  p_radius_mi double precision
)
returns setof public.search_hit
language sql
stable
security definer
set search_path = ''
as $$
  with box as (
    select p_radius_mi / 69.0 as dlat,
           p_radius_mi / (69.0 * greatest(cos(radians(p_lat)), 0.01)) as dlng
  )
  select * from (
    select s.sighting_id, s.price_usd, s.condition_grade, s.special_attributes, s.store_verified,
           s.sighting_timestamp, r.record_id, r.artist_name, r.album_title, r.genre,
           r.cover_art_url, st.store_id, st.business_name, st.geo_lat, st.geo_lng,
           st.verification_status = 'verified',
           -- Haversine, Earth radius 3958.8 mi (matches the API's distanceMiles).
           2 * 3958.8 * asin(sqrt(
             power(sin(radians(st.geo_lat::float8 - p_lat) / 2), 2)
             + cos(radians(p_lat)) * cos(radians(st.geo_lat::float8))
               * power(sin(radians(st.geo_lng::float8 - p_lng) / 2), 2)
           )) as distance_mi
    from box, public.sightings s
    join public.stores st on st.store_id = s.store_id
    join public.master_records r on r.record_id = s.record_id
    where s.status = 'active'
      and st.verification_status <> 'rejected'
      and st.geo_lat between p_lat - box.dlat and p_lat + box.dlat
      and st.geo_lng between p_lng - box.dlng and p_lng + box.dlng
      and not exists (
        select 1
        from unnest(regexp_split_to_array(trim(coalesce(p_q, '')), '\s+')) as term
        where term <> ''
          and strpos(
            lower(extensions.unaccent(
              r.artist_name || ' ' || r.album_title || ' ' || coalesce(r.genre, ''))),
            lower(extensions.unaccent(term))
          ) = 0
      )
  ) c
  where c.distance_mi <= p_radius_mi;
$$;

create or replace function public.search_sightings(
  p_q text,
  p_genre text,
  p_lat double precision,
  p_lng double precision,
  p_radius_mi double precision,
  p_limit integer default 200
)
returns setof public.search_hit
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.search_candidates(p_q, p_lat, p_lng, p_radius_mi) c
  where p_genre is null
     or lower(extensions.unaccent(c.genre)) = lower(extensions.unaccent(p_genre))
  order by c.distance_mi, c.sighting_timestamp desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- Genres among the keyword matches, for the search screen's genre dropdown.
create or replace function public.search_genres(
  p_q text,
  p_lat double precision,
  p_lng double precision,
  p_radius_mi double precision
)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct c.genre
  from public.search_candidates(p_q, p_lat, p_lng, p_radius_mi) c
  where c.genre is not null
  order by c.genre;
$$;

revoke execute on function public.search_candidates(text, double precision, double precision, double precision)
  from public, anon, authenticated;
revoke execute on function public.search_sightings(text, text, double precision, double precision, double precision, integer)
  from public, anon, authenticated;
revoke execute on function public.search_genres(text, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.search_candidates(text, double precision, double precision, double precision)
  to service_role;
grant execute on function public.search_sightings(text, text, double precision, double precision, double precision, integer)
  to service_role;
grant execute on function public.search_genres(text, double precision, double precision, double precision)
  to service_role;
