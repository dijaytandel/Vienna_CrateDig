-- Minimal dev seed for T-03. The full U.S. metro seed (10+ stores, broadcasts,
-- demo accounts) is T-11.

insert into public.stores
  (store_id, business_name, street_address, city, state, zip, geo_lat, geo_lng, phone,
   website_url, operating_hours, payment_methods, tags, verification_status)
values
  ('00000000-0000-4000-8000-000000000001', 'Groove Merchant Records', '1021 SW Morrison St',
   'Portland', 'OR', '97205', 45.521600, -122.682600, '(503) 555-0142', 'https://example.com/groove',
   '{"mon":{"open":"11:00","close":"19:00"},"tue":{"open":"11:00","close":"19:00"},"wed":{"open":"11:00","close":"19:00"},"thu":{"open":"11:00","close":"20:00"},"fri":{"open":"11:00","close":"21:00"},"sat":{"open":"10:00","close":"21:00"},"sun":{"open":"12:00","close":"18:00"}}',
   '{Cash,Card,"Apple Pay"}', '{Jazz,Soul,Funk}', 'verified'),
  ('00000000-0000-4000-8000-000000000002', 'Second Spin Vinyl', '3360 SE Division St',
   'Portland', 'OR', '97202', 45.504800, -122.630400, '(503) 555-0187', null,
   '{}', '{Cash}', '{Punk,Indie}', 'pending');

insert into public.master_records
  (record_id, api_source_id, artist_name, album_title, song_title, record_label, release_year, genre)
values
  ('00000000-0000-4000-9000-000000000001', 'discogs:master:5460', 'Miles Davis', 'Kind of Blue',
   'So What', 'Columbia', 1959, 'Jazz'),
  ('00000000-0000-4000-9000-000000000002', 'discogs:master:24047', 'Fleetwood Mac', 'Rumours',
   'Dreams', 'Warner Bros. Records', 1977, 'Rock');

insert into public.sightings (record_id, store_id, price_usd, condition_grade, special_attributes, store_verified)
values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001', 28.00, 'near_mint',
   '180g remaster', true),
  ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-000000000001', 22.50, 'vg_plus',
   'First pressing', false);

insert into public.merchant_broadcasts (store_id, arrival_summary, featured_ids)
values
  ('00000000-0000-4000-8000-000000000001', 'Fresh jazz and soul crates just landed — 200+ used LPs priced and in the bins.',
   '{00000000-0000-4000-9000-000000000001}');
