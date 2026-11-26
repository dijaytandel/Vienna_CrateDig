-- T-03: base schema for the six PRD §3.2 entities.
-- Enum values are lowercase snake_case (WORKSPACE_RULES §5); RLS is enabled on every
-- table with no policies yet, so only the service role can read/write until T-10.

create type public.user_role as enum ('collector', 'store_manager', 'admin');
create type public.distance_unit as enum ('mi', 'km');
create type public.verification_status as enum ('pending', 'verified', 'rejected');
create type public.condition_grade as enum ('mint', 'near_mint', 'vg_plus', 'vg', 'fair');
create type public.sighting_status as enum ('active', 'sold_out', 'flagged', 'archived');
create type public.list_type as enum ('collection', 'want_list');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles (User) -------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  email text not null unique,
  user_role public.user_role not null default 'collector',
  default_zip text check (default_zip ~ '^[0-9]{5}$'),
  default_radius_miles integer not null default 10 check (default_radius_miles in (5, 10, 25)),
  distance_unit public.distance_unit not null default 'mi',
  genre_preferences text[] not null default '{}',
  favorite_store_ids uuid[] not null default '{}',
  push_broadcasts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- stores ----------------------------------------------------------------------
create table public.stores (
  store_id uuid primary key default gen_random_uuid(),
  manager_user_id uuid unique references public.profiles (user_id) on delete set null,
  business_name text not null check (char_length(business_name) between 1 and 120),
  street_address text not null,
  city text not null,
  state char(2) not null check (state ~ '^[A-Z]{2}$'),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  geo_lat numeric(9, 6) not null check (geo_lat between -90 and 90),
  geo_lng numeric(9, 6) not null check (geo_lng between -180 and 180),
  phone text,
  website_url text check (website_url ~ '^https?://'),
  operating_hours jsonb not null default '{}',
  payment_methods text[] not null default '{}',
  tags text[] not null default '{}',
  license_doc_url text check (license_doc_url ~ '^https://'),
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- master_records (MasterRecord) ----------------------------------------------
create table public.master_records (
  record_id uuid primary key default gen_random_uuid(),
  api_source_id text not null unique,
  artist_name text not null,
  album_title text not null,
  song_title text,
  record_label text,
  release_year integer check (release_year between 1900 and 2100),
  genre text,
  cover_art_url text check (cover_art_url ~ '^https?://'),
  created_at timestamptz not null default now()
);

-- sightings -------------------------------------------------------------------
create table public.sightings (
  sighting_id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.master_records (record_id),
  store_id uuid not null references public.stores (store_id) on delete cascade,
  user_id uuid references public.profiles (user_id) on delete set null,
  price_usd numeric(8, 2) not null check (price_usd >= 0),
  condition_grade public.condition_grade not null,
  special_attributes text check (char_length(special_attributes) <= 200),
  store_verified boolean not null default false,
  status public.sighting_status not null default 'active',
  sighting_timestamp timestamptz not null default now(),
  archive_date timestamptz not null,
  updated_at timestamptz not null default now()
);

create index sightings_store_status_idx on public.sightings (store_id, status);
create index sightings_record_status_idx on public.sightings (record_id, status);
create index sightings_feed_idx on public.sightings (sighting_timestamp desc) where status = 'active';

create or replace function public.set_sighting_archive_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archive_date is null then
    new.archive_date = new.sighting_timestamp + interval '180 days';
  end if;
  return new;
end;
$$;

create trigger sightings_archive_date
  before insert on public.sightings
  for each row execute function public.set_sighting_archive_date();

-- crate_items (CrateItem) ----------------------------------------------------
create table public.crate_items (
  crate_item_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  record_id uuid not null references public.master_records (record_id),
  list_type public.list_type not null,
  purchased_store_id uuid references public.stores (store_id) on delete set null,
  purchase_price_usd numeric(8, 2) check (purchase_price_usd >= 0),
  acquired_at timestamptz,
  user_notes text check (char_length(user_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_id, list_type)
);

create index crate_items_user_idx on public.crate_items (user_id, list_type);

-- merchant_broadcasts (MerchantBroadcast) ------------------------------------
create table public.merchant_broadcasts (
  broadcast_id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (store_id) on delete cascade,
  arrival_summary text not null check (char_length(arrival_summary) between 1 and 500),
  photo_url text check (photo_url ~ '^https://'),
  featured_ids uuid[] not null default '{}' check (cardinality(featured_ids) <= 10),
  posted_at timestamptz not null default now()
);

create index merchant_broadcasts_store_idx on public.merchant_broadcasts (store_id, posted_at desc);

-- updated_at triggers --------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();
create trigger sightings_updated_at before update on public.sightings
  for each row execute function public.set_updated_at();
create trigger crate_items_updated_at before update on public.crate_items
  for each row execute function public.set_updated_at();

-- New auth user -> profiles row (role collector, radius 10) ------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.handle_user_email_change();

-- Row Level Security (policies arrive with T-10) -----------------------------
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.master_records enable row level security;
alter table public.sightings enable row level security;
alter table public.crate_items enable row level security;
alter table public.merchant_broadcasts enable row level security;
