-- Local dev seed (T-11): one U.S. metro (Portland, OR) so every screen has realistic data.
-- Stores, phones and websites are fictional. Master records use `seed:` source ids so they
-- never collide with real Discogs/MusicBrainz ids saved through the catalog proxy.
-- No accounts are seeded; sign up locally to get a collector.

-- Hours: every day mon–sun is present; null means closed.
insert into public.stores
  (store_id, business_name, street_address, city, state, zip, geo_lat, geo_lng, phone,
   website_url, operating_hours, payment_methods, tags, verification_status)
values
  ('00000000-0000-4000-8000-000000000001', 'Groove Merchant Records', '1021 SW Morrison St',
   'Portland', 'OR', '97205', 45.521600, -122.682600, '(503) 555-0142', 'https://example.com/groove-merchant',
   '{"mon":{"open":"11:00","close":"19:00"},"tue":{"open":"11:00","close":"19:00"},"wed":{"open":"11:00","close":"19:00"},"thu":{"open":"11:00","close":"20:00"},"fri":{"open":"11:00","close":"21:00"},"sat":{"open":"10:00","close":"21:00"},"sun":{"open":"12:00","close":"18:00"}}',
   '{Cash,Card,"Apple Pay"}', '{Jazz,Soul,Funk,"Listening station"}', 'verified'),
  ('00000000-0000-4000-8000-000000000002', 'Second Spin Vinyl', '3360 SE Division St',
   'Portland', 'OR', '97202', 45.504800, -122.630400, '(503) 555-0187', null,
   '{"mon":null,"tue":{"open":"12:00","close":"19:00"},"wed":{"open":"12:00","close":"19:00"},"thu":{"open":"12:00","close":"19:00"},"fri":{"open":"12:00","close":"20:00"},"sat":{"open":"11:00","close":"20:00"},"sun":{"open":"12:00","close":"17:00"}}',
   '{Cash}', '{Punk,Indie,"Dollar bins"}', 'pending'),
  ('00000000-0000-4000-8000-000000000003', 'Rose City Crates', '2327 E Burnside St',
   'Portland', 'OR', '97214', 45.522900, -122.641500, '(503) 555-0113', 'https://example.com/rose-city-crates',
   '{"mon":{"open":"11:00","close":"20:00"},"tue":{"open":"11:00","close":"20:00"},"wed":{"open":"11:00","close":"20:00"},"thu":{"open":"11:00","close":"20:00"},"fri":{"open":"11:00","close":"21:00"},"sat":{"open":"10:00","close":"21:00"},"sun":{"open":"11:00","close":"19:00"}}',
   '{Cash,Card,"Apple Pay","Google Pay"}', '{Rock,Indie,"Used LPs","Local artists"}', 'verified'),
  ('00000000-0000-4000-8000-000000000004', 'Low End Theory Records', '4012 N Mississippi Ave',
   'Portland', 'OR', '97227', 45.552300, -122.675800, '(503) 555-0129', 'https://example.com/low-end-theory',
   '{"mon":{"open":"12:00","close":"20:00"},"tue":{"open":"12:00","close":"20:00"},"wed":{"open":"12:00","close":"20:00"},"thu":{"open":"12:00","close":"21:00"},"fri":{"open":"12:00","close":"22:00"},"sat":{"open":"11:00","close":"22:00"},"sun":{"open":"12:00","close":"18:00"}}',
   '{Cash,Card,Venmo}', '{"Hip-Hop",Soul,Funk,"Breaks & samples"}', 'verified'),
  ('00000000-0000-4000-8000-000000000005', 'Hawthorne Hi-Fi & Vinyl', '3532 SE Hawthorne Blvd',
   'Portland', 'OR', '97214', 45.512100, -122.627300, '(503) 555-0175', 'https://example.com/hawthorne-hifi',
   '{"mon":{"open":"10:00","close":"19:00"},"tue":{"open":"10:00","close":"19:00"},"wed":{"open":"10:00","close":"19:00"},"thu":{"open":"10:00","close":"19:00"},"fri":{"open":"10:00","close":"20:00"},"sat":{"open":"10:00","close":"20:00"},"sun":{"open":"11:00","close":"18:00"}}',
   '{Cash,Card,"Apple Pay"}', '{Rock,Jazz,"Audio gear",Audiophile}', 'verified'),
  ('00000000-0000-4000-8000-000000000006', 'Alberta Arts Audio', '1715 NE Alberta St',
   'Portland', 'OR', '97211', 45.559000, -122.647800, '(503) 555-0161', 'https://example.com/alberta-arts-audio',
   '{"mon":null,"tue":null,"wed":{"open":"12:00","close":"19:00"},"thu":{"open":"12:00","close":"19:00"},"fri":{"open":"12:00","close":"21:00"},"sat":{"open":"11:00","close":"21:00"},"sun":{"open":"11:00","close":"18:00"}}',
   '{Cash,Card}', '{World,Reggae,Afrobeat,"Local artists"}', 'verified'),
  ('00000000-0000-4000-8000-000000000007', 'Pearl District Platters', '1130 NW Glisan St',
   'Portland', 'OR', '97209', 45.526500, -122.682900, '(503) 555-0198', 'https://example.com/pearl-platters',
   '{"mon":{"open":"11:00","close":"19:00"},"tue":{"open":"11:00","close":"19:00"},"wed":{"open":"11:00","close":"19:00"},"thu":{"open":"11:00","close":"19:00"},"fri":{"open":"11:00","close":"20:00"},"sat":{"open":"10:00","close":"20:00"},"sun":{"open":"12:00","close":"17:00"}}',
   '{Card,"Apple Pay","Google Pay"}', '{Classical,Jazz,"Rare pressings"}', 'verified'),
  ('00000000-0000-4000-8000-000000000008', 'St. Johns Spin Shop', '8410 N Lombard St',
   'Portland', 'OR', '97203', 45.590400, -122.753300, '(503) 555-0136', 'https://example.com/st-johns-spin',
   '{"mon":{"open":"12:00","close":"18:00"},"tue":{"open":"12:00","close":"18:00"},"wed":{"open":"12:00","close":"18:00"},"thu":{"open":"12:00","close":"18:00"},"fri":{"open":"12:00","close":"19:00"},"sat":{"open":"10:00","close":"19:00"},"sun":null}',
   '{Cash,Card}', '{Country,Folk,Americana,"Dollar bins"}', 'verified'),
  ('00000000-0000-4000-8000-000000000009', 'Sellwood Sound Exchange', '7915 SE 13th Ave',
   'Portland', 'OR', '97202', 45.466400, -122.652800, '(503) 555-0154', 'https://example.com/sellwood-sound',
   '{"mon":{"open":"11:00","close":"18:00"},"tue":{"open":"11:00","close":"18:00"},"wed":{"open":"11:00","close":"18:00"},"thu":{"open":"11:00","close":"18:00"},"fri":{"open":"11:00","close":"19:00"},"sat":{"open":"10:00","close":"19:00"},"sun":{"open":"11:00","close":"17:00"}}',
   '{Cash,Card,Venmo}', '{Rock,Pop,"Used LPs",Trade-ins}', 'verified'),
  ('00000000-0000-4000-8000-000000000010', 'Mt. Tabor Music Mart', '6040 SE Belmont St',
   'Portland', 'OR', '97215', 45.516300, -122.601500, '(503) 555-0108', 'https://example.com/mt-tabor-music',
   '{"mon":{"open":"12:00","close":"20:00"},"tue":{"open":"12:00","close":"20:00"},"wed":{"open":"12:00","close":"20:00"},"thu":{"open":"12:00","close":"20:00"},"fri":{"open":"12:00","close":"21:00"},"sat":{"open":"11:00","close":"21:00"},"sun":{"open":"12:00","close":"19:00"}}',
   '{Cash,Card,"Apple Pay"}', '{Metal,Punk,Hardcore}', 'verified'),
  ('00000000-0000-4000-8000-000000000011', 'Foster Road Flea Vinyl', '6525 SE Foster Rd',
   'Portland', 'OR', '97206', 45.486200, -122.596200, '(503) 555-0170', null,
   '{"mon":null,"tue":null,"wed":null,"thu":{"open":"14:00","close":"19:00"},"fri":{"open":"14:00","close":"19:00"},"sat":{"open":"09:00","close":"17:00"},"sun":{"open":"09:00","close":"17:00"}}',
   '{Cash}', '{"Dollar bins",Oldies,Soul}', 'pending'),
  ('00000000-0000-4000-8000-000000000012', 'Beaverton B-Sides', '12570 SW Broadway St',
   'Beaverton', 'OR', '97005', 45.489800, -122.802300, '(971) 555-0123', 'https://example.com/beaverton-b-sides',
   '{"mon":{"open":"11:00","close":"19:00"},"tue":{"open":"11:00","close":"19:00"},"wed":{"open":"11:00","close":"19:00"},"thu":{"open":"11:00","close":"19:00"},"fri":{"open":"11:00","close":"20:00"},"sat":{"open":"10:00","close":"20:00"},"sun":{"open":"12:00","close":"17:00"}}',
   '{Cash,Card,"Google Pay"}', '{Electronic,"Hip-Hop","New releases"}', 'verified');

insert into public.master_records
  (record_id, api_source_id, artist_name, album_title, song_title, record_label, release_year, genre)
values
  ('00000000-0000-4000-9000-000000000001', 'seed:kind-of-blue', 'Miles Davis', 'Kind of Blue', 'So What', 'Columbia', 1959, 'Jazz'),
  ('00000000-0000-4000-9000-000000000002', 'seed:rumours', 'Fleetwood Mac', 'Rumours', 'Dreams', 'Warner Bros. Records', 1977, 'Rock'),
  ('00000000-0000-4000-9000-000000000003', 'seed:a-love-supreme', 'John Coltrane', 'A Love Supreme', 'Acknowledgement', 'Impulse!', 1965, 'Jazz'),
  ('00000000-0000-4000-9000-000000000004', 'seed:whats-going-on', 'Marvin Gaye', 'What''s Going On', 'What''s Going On', 'Tamla', 1971, 'Soul'),
  ('00000000-0000-4000-9000-000000000005', 'seed:discovery', 'Daft Punk', 'Discovery', 'One More Time', 'Virgin', 2001, 'Electronic'),
  ('00000000-0000-4000-9000-000000000006', 'seed:nevermind', 'Nirvana', 'Nevermind', 'Smells Like Teen Spirit', 'DGC', 1991, 'Rock'),
  ('00000000-0000-4000-9000-000000000007', 'seed:the-low-end-theory', 'A Tribe Called Quest', 'The Low End Theory', 'Check the Rhime', 'Jive', 1991, 'Hip Hop'),
  ('00000000-0000-4000-9000-000000000008', 'seed:blue', 'Joni Mitchell', 'Blue', 'A Case of You', 'Reprise Records', 1971, 'Folk'),
  ('00000000-0000-4000-9000-000000000009', 'seed:exodus', 'Bob Marley & The Wailers', 'Exodus', 'Jamming', 'Island Records', 1977, 'Reggae'),
  ('00000000-0000-4000-9000-000000000010', 'seed:ok-computer', 'Radiohead', 'OK Computer', 'Paranoid Android', 'Parlophone', 1997, 'Rock'),
  ('00000000-0000-4000-9000-000000000011', 'seed:lady-soul', 'Aretha Franklin', 'Lady Soul', 'Chain of Fools', 'Atlantic', 1968, 'Soul'),
  ('00000000-0000-4000-9000-000000000012', 'seed:paranoid', 'Black Sabbath', 'Paranoid', 'War Pigs', 'Vertigo', 1970, 'Rock'),
  ('00000000-0000-4000-9000-000000000013', 'seed:to-pimp-a-butterfly', 'Kendrick Lamar', 'To Pimp a Butterfly', 'Alright', 'Top Dawg Entertainment', 2015, 'Hip Hop'),
  ('00000000-0000-4000-9000-000000000014', 'seed:either-or', 'Elliott Smith', 'Either/Or', 'Say Yes', 'Kill Rock Stars', 1997, 'Rock'),
  ('00000000-0000-4000-9000-000000000015', 'seed:fela-zombie', 'Fela Kuti & Afrika 70', 'Zombie', 'Zombie', 'Coconut', 1976, 'Funk / Soul');

-- (record, store, price USD, grade, attributes, store-verified, status, days ago)
insert into public.sightings
  (record_id, store_id, price_usd, condition_grade, special_attributes, store_verified, status, sighting_timestamp)
select
  ('00000000-0000-4000-9000-0000000000' || lpad(r::text, 2, '0'))::uuid,
  ('00000000-0000-4000-8000-0000000000' || lpad(s::text, 2, '0'))::uuid,
  price, grade::public.condition_grade, attrs, verified, status::public.sighting_status,
  now() - make_interval(days => days_ago, hours => r + s)
from (values
  (1, 1, 28.00, 'near_mint', '180g remaster', true, 'active', 1),
  (2, 1, 22.50, 'vg_plus', 'First pressing', false, 'active', 3),
  (3, 1, 34.99, 'near_mint', 'Acoustic Sounds reissue', true, 'active', 2),
  (4, 4, 26.00, 'vg_plus', null, true, 'active', 0),
  (7, 4, 45.00, 'vg', 'Original 1991 Jive pressing', true, 'active', 5),
  (13, 4, 38.00, 'mint', 'Sealed 2LP', false, 'active', 1),
  (6, 3, 29.99, 'near_mint', '2021 30th anniversary reissue', true, 'active', 4),
  (14, 3, 24.00, 'vg_plus', 'Kill Rock Stars original', false, 'active', 9),
  (10, 3, 42.00, 'near_mint', 'OKNOTOK 3LP', false, 'sold_out', 12),
  (1, 5, 18.00, 'vg', 'Six-eye label, seam split', false, 'active', 15),
  (10, 5, 36.00, 'mint', 'Sealed', true, 'active', 2),
  (2, 5, 25.00, 'near_mint', null, true, 'active', 6),
  (9, 6, 21.00, 'vg_plus', 'Jamaican pressing', true, 'active', 3),
  (15, 6, 32.00, 'near_mint', 'Knitting Factory reissue', true, 'active', 7),
  (3, 7, 120.00, 'vg_plus', 'Impulse! orange label, gatefold', true, 'active', 2),
  (11, 7, 48.00, 'vg_plus', 'Atlantic mono', false, 'active', 20),
  (8, 8, 15.00, 'vg', 'Ring wear', false, 'active', 11),
  (8, 9, 27.00, 'near_mint', '2022 Rhino reissue', true, 'active', 1),
  (2, 9, 12.00, 'fair', 'Dollar-bin find, plays through', false, 'flagged', 40),
  (12, 10, 33.00, 'vg_plus', 'Warner Bros. 1971 US', true, 'active', 4),
  (6, 10, 19.99, 'vg', null, false, 'active', 25),
  (5, 12, 39.99, 'near_mint', '2LP, 2021 reissue', true, 'active', 2),
  (13, 12, 40.00, 'mint', 'Sealed', true, 'active', 8),
  (4, 11, 9.00, 'fair', 'Cover worn', false, 'active', 6),
  (11, 2, 14.00, 'vg', null, false, 'active', 10),
  (6, 1, 15.00, 'vg', 'Stale report past 180 days', false, 'archived', 200)
) as v(r, s, price, grade, attrs, verified, status, days_ago);

insert into public.merchant_broadcasts (store_id, arrival_summary, featured_ids, posted_at)
values
  ('00000000-0000-4000-8000-000000000001', 'Fresh jazz and soul crates just landed — 200+ used LPs priced and in the bins.',
   '{00000000-0000-4000-9000-000000000001,00000000-0000-4000-9000-000000000003}', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-000000000004', 'Golden-era hip-hop collection bought this week: Tribe, De La, Pete Rock. Out Saturday at noon.',
   '{00000000-0000-4000-9000-000000000007}', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000007', 'Estate buy: early Impulse! and Blue Note pressings now in the rare-records case.',
   '{00000000-0000-4000-9000-000000000003}', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000012', 'Record Store Day leftovers restocked, plus new Daft Punk and Kendrick reissues.',
   '{00000000-0000-4000-9000-000000000005,00000000-0000-4000-9000-000000000013}', now() - interval '4 days'),
  ('00000000-0000-4000-8000-000000000006', 'Afrobeat and roots reggae crate refreshed — 60 new titles.',
   '{00000000-0000-4000-9000-000000000015,00000000-0000-4000-9000-000000000009}', now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000003', 'Local artists wall restocked: Elliott Smith, Sleater-Kinney and The Decemberists.',
   '{00000000-0000-4000-9000-000000000014}', now() - interval '9 days');
