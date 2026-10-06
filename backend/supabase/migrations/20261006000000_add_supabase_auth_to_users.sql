-- Supabase Auth stores and verifies passwords. public.users stores app profile data only.
alter table public.users
  add column if not exists auth_user_id uuid unique
  references auth.users(id) on delete set null;

-- Link existing profile rows when Auth accounts already exist.
with profile_matches as (
  select distinct on (lower(trim(u.email)))
    u.user_id,
    au.id as auth_user_id
  from public.users u
  join auth.users au on lower(trim(au.email)) = lower(trim(u.email))
  where u.auth_user_id is null
  order by lower(trim(u.email)), u.created_at nulls last, u.user_id
)
update public.users u
set auth_user_id = pm.auth_user_id,
    updated_at = now()
from profile_matches pm
where u.user_id = pm.user_id;

-- Create profiles for Auth accounts with no existing public.users row.
insert into public.users (
  user_id, auth_user_id, email, full_name, role, active, created_at, updated_at
)
select
  'USR-' || replace(au.id::text, '-', ''),
  au.id,
  au.email,
  coalesce(nullif(au.raw_user_meta_data ->> 'full_name', ''), split_part(au.email, '@', 1)),
  'AUDITOR',
  true,
  now(),
  now()
from auth.users au
where au.email is not null
  and not exists (
    select 1 from public.users u
    where lower(trim(u.email)) = lower(trim(au.email))
       or u.auth_user_id = au.id
  );

-- Create/link a profile automatically for every future Supabase Auth sign-up.
create or replace function public.link_auth_user_to_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
     set auth_user_id = new.id,
         full_name = coalesce(nullif(full_name, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
         updated_at = now()
   where lower(trim(email)) = lower(trim(new.email))
     and auth_user_id is null;

  if not found then
    insert into public.users (
      user_id, auth_user_id, email, full_name, role, active, created_at, updated_at
    ) values (
      'USR-' || replace(new.id::text, '-', ''),
      new.id,
      new.email,
      coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
      'AUDITOR',
      true,
      now(),
      now()
    ) on conflict (auth_user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_link_profile on auth.users;
create trigger on_auth_user_created_link_profile
after insert on auth.users
for each row execute function public.link_auth_user_to_profile();

-- These functions let the signed-in user load/update their own profile even with RLS enabled.
create or replace function public.get_my_profile()
returns setof public.users
language sql
security definer
set search_path = ''
as $$
  select u.*
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

create or replace function public.record_my_login()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users
  set last_login_at = now(), updated_at = now()
  where auth_user_id = auth.uid();
$$;

revoke all on function public.record_my_login() from public;
grant execute on function public.record_my_login() to authenticated;

