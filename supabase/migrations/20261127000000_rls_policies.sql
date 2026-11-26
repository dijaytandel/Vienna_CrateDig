-- T-10: RLS policies and column privileges.
-- The API uses the service role (bypasses RLS) for cross-user writes such as
-- marking sightings sold out; these rules govern anon/authenticated clients.

-- RLS does not apply to TRUNCATE, and column-level grants only take effect
-- once the table-wide INSERT/UPDATE grants are gone.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;
revoke insert, update, delete on public.profiles, public.stores, public.master_records,
  public.sightings, public.merchant_broadcasts from authenticated;

create or replace function public.is_verified_manager(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    join public.profiles p on p.user_id = s.manager_user_id
    where s.store_id = target_store
      and s.manager_user_id = (select auth.uid())
      and s.verification_status = 'verified'
      and p.user_role = 'store_manager'
  );
$$;

revoke execute on function public.is_verified_manager(uuid) from public, anon;
grant execute on function public.is_verified_manager(uuid) to authenticated;

-- profiles: own row only; role and email are not user-editable.
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant update (display_name, default_zip, default_radius_miles, distance_unit,
  genre_preferences, favorite_store_ids, push_broadcasts_enabled)
  on public.profiles to authenticated;

-- stores: public directory without license_doc_url (only admins review it).
-- A manager edits their listing's contact details, hours, payments and tags;
-- identity fields that verification vouched for (name, address, license) and
-- verification_status / manager_user_id are database-only after creation.
create policy stores_select_all on public.stores
  for select to anon, authenticated using (true);
revoke select on public.stores from anon, authenticated;
grant select (store_id, manager_user_id, business_name, street_address, city, state, zip,
  geo_lat, geo_lng, phone, website_url, operating_hours, payment_methods, tags,
  verification_status, created_at, updated_at)
  on public.stores to anon, authenticated;
create policy stores_insert_claim on public.stores
  for insert to authenticated
  with check (manager_user_id = (select auth.uid()));
create policy stores_update_own on public.stores
  for update to authenticated
  using (manager_user_id = (select auth.uid()))
  with check (manager_user_id = (select auth.uid()));
grant insert (manager_user_id, business_name, street_address, city, state, zip, geo_lat,
  geo_lng, phone, website_url, operating_hours, payment_methods, tags, license_doc_url)
  on public.stores to authenticated;
grant update (phone, website_url, operating_hours, payment_methods, tags)
  on public.stores to authenticated;

-- master_records: read-only to clients; the API upserts with the service role.
create policy master_records_select_all on public.master_records
  for select to anon, authenticated using (true);

-- sightings: anyone reads; collectors report as themselves; the verified
-- manager of the store confirms, flags or marks sold.
create policy sightings_select_all on public.sightings
  for select to anon, authenticated using (true);
create policy sightings_insert_own on public.sightings
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy sightings_update_store_manager on public.sightings
  for update to authenticated
  using (public.is_verified_manager(store_id))
  with check (public.is_verified_manager(store_id));
grant insert (record_id, store_id, user_id, price_usd, condition_grade, special_attributes)
  on public.sightings to authenticated;
grant update (status, store_verified) on public.sightings to authenticated;

-- Archiving is the scheduled job's call: clients can neither archive a
-- sighting nor bring an archived one back.
create or replace function public.guard_sighting_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
    and new.status is distinct from old.status
    and 'archived' in (old.status, new.status) then
    raise exception 'archived sightings are managed by the system'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sightings_guard_status
  before update of status on public.sightings
  for each row execute function public.guard_sighting_status();

-- crate_items: private to their owner.
create policy crate_items_owner on public.crate_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- merchant_broadcasts: anyone reads; only the store's verified manager writes.
create policy merchant_broadcasts_select_all on public.merchant_broadcasts
  for select to anon, authenticated using (true);
create policy merchant_broadcasts_write_manager on public.merchant_broadcasts
  for all to authenticated
  using (public.is_verified_manager(store_id))
  with check (public.is_verified_manager(store_id));
grant insert, update, delete on public.merchant_broadcasts to authenticated;
