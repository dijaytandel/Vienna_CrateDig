-- T-35: a collector claims an existing store with a business-license URL; an
-- admin approves or rejects the claim in the database (no admin UI).

-- Only a verified manager may edit the listing; a pending claim must not.
drop policy stores_update_own on public.stores;
create policy stores_update_own on public.stores
  for update to authenticated
  using (manager_user_id = (select auth.uid()) and verification_status = 'verified')
  with check (manager_user_id = (select auth.uid()) and verification_status = 'verified');

create or replace function public.claim_store(p_user uuid, p_store uuid, p_license_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.stores;
begin
  if p_license_url is null or p_license_url !~ '^https://[^[:space:]]+$' then
    raise exception 'license URL must start with https://' using errcode = 'CD400';
  end if;
  if exists (select 1 from public.stores
             where manager_user_id = p_user and verification_status = 'verified') then
    raise exception 'you already manage a verified store' using errcode = 'CD409';
  end if;
  select * into v_store from public.stores where store_id = p_store for update;
  if not found then
    raise exception 'store not found' using errcode = 'CD404';
  end if;
  if v_store.verification_status = 'verified' then
    raise exception 'this store is already verified' using errcode = 'CD409';
  end if;
  if v_store.verification_status = 'pending' and v_store.manager_user_id is not null
     and v_store.manager_user_id <> p_user then
    raise exception 'this store already has a pending claim' using errcode = 'CD409';
  end if;
  -- One claim per user: withdraw any other unverified claim first.
  update public.stores
  set manager_user_id = null, license_doc_url = null, updated_at = now()
  where manager_user_id = p_user and store_id <> p_store;
  update public.stores
  set manager_user_id = p_user, license_doc_url = p_license_url,
      verification_status = 'pending', updated_at = now()
  where store_id = p_store;
end;
$$;
revoke execute on function public.claim_store(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_store(uuid, uuid, text) to service_role;

-- Admin procedure (SQL editor, as postgres): see docs/DEPLOYMENT.md §6.
create or replace function public.admin_review_store(
  p_store uuid,
  p_decision public.verification_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager uuid;
begin
  if p_decision not in ('verified', 'rejected') then
    raise exception 'decision must be verified or rejected';
  end if;
  update public.stores
  set verification_status = p_decision, updated_at = now()
  where store_id = p_store
  returning manager_user_id into v_manager;
  if not found then
    raise exception 'store not found';
  end if;
  if v_manager is null then
    return;
  end if;
  update public.profiles
  set user_role = case when p_decision = 'verified' then 'store_manager'::public.user_role
                       else 'collector'::public.user_role end
  where user_id = v_manager and user_role <> 'admin';
end;
$$;
revoke execute on function public.admin_review_store(uuid, public.verification_status)
  from public, anon, authenticated, service_role;
