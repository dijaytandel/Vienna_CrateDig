-- T-24: keyword search over active sightings inside a lat/lng box.
-- Every whitespace-separated term must appear in artist, album or genre
-- (case- and accent-insensitive). Exact distance and the genre filter are
-- applied by the API.

create index stores_geo_idx on public.stores (geo_lat, geo_lng);

create or replace function public.search_sightings(
  p_q text,
  p_min_lat numeric,
  p_max_lat numeric,
  p_min_lng numeric,
  p_max_lng numeric,
  p_limit integer default 1000
)
returns table (
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
  store_is_verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.sighting_id, s.price_usd, s.condition_grade, s.special_attributes, s.store_verified,
         s.sighting_timestamp, r.record_id, r.artist_name, r.album_title, r.genre,
         r.cover_art_url, st.store_id, st.business_name, st.geo_lat, st.geo_lng,
         st.verification_status = 'verified'
  from public.sightings s
  join public.stores st on st.store_id = s.store_id
  join public.master_records r on r.record_id = s.record_id
  where s.status = 'active'
    and st.verification_status <> 'rejected'
    and st.geo_lat between p_min_lat and p_max_lat
    and st.geo_lng between p_min_lng and p_max_lng
    and not exists (
      select 1
      from unnest(regexp_split_to_array(trim(coalesce(p_q, '')), '\s+')) as term
      where term <> ''
        and strpos(
          lower(extensions.unaccent(r.artist_name || ' ' || r.album_title || ' ' || coalesce(r.genre, ''))),
          lower(extensions.unaccent(term))
        ) = 0
    )
  order by s.sighting_timestamp desc
  limit least(greatest(p_limit, 1), 5000);
$$;

revoke execute on function public.search_sightings(text, numeric, numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.search_sightings(text, numeric, numeric, numeric, numeric, integer)
  to service_role;
