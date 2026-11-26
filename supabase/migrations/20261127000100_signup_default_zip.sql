-- T-09: store the optional ZIP from sign-up metadata; anything but 5 digits is ignored.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  zip text := btrim(new.raw_user_meta_data ->> 'default_zip');
begin
  insert into public.profiles (user_id, email, display_name, default_zip)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 60),
    case when zip ~ '^[0-9]{5}$' then zip end
  );
  return new;
end;
$$;
