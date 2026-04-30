create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_users enable row level security;

drop policy if exists admin_users_select_own on public.admin_users;
create policy admin_users_select_own
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

insert into public.admin_users (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('martin@toudal.dk')
on conflict (user_id)
do update set role = excluded.role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

create or replace function public.list_premium_access()
returns table (
  email text,
  user_id uuid,
  pack_key text,
  enabled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    auth_user.email::text,
    access.user_id,
    access.pack_key,
    access.enabled,
    access.updated_at
  from public.user_league_pack_access access
  join auth.users auth_user on auth_user.id = access.user_id
  where access.pack_key in ('germany_top_3', 'england_top_4', 'italy_top_3', 'spain_top_4', 'france_top_3', 'premium_full')
  order by auth_user.email, access.pack_key;
end;
$$;

grant execute on function public.list_premium_access() to authenticated;

create or replace function public.grant_league_pack_access_by_email(
  target_email text,
  target_pack_key text
)
returns table (
  email text,
  user_id uuid,
  pack_key text,
  enabled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_user_id uuid;
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  if target_pack_key not in ('germany_top_3', 'england_top_4', 'italy_top_3', 'spain_top_4', 'france_top_3', 'premium_full') then
    raise exception 'invalid_pack_key';
  end if;

  v_target_user_id := (
    select auth_user.id
    from auth.users auth_user
    where lower(auth_user.email) = lower(trim(target_email))
    limit 1
  );

  if v_target_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into public.user_league_pack_access (user_id, pack_key, enabled)
  values (v_target_user_id, target_pack_key, true)
  on conflict on constraint user_league_pack_access_pkey
  do update set
    enabled = excluded.enabled,
    updated_at = timezone('utc', now());

  return query
  select
    auth_user.email::text,
    access.user_id,
    access.pack_key,
    access.enabled,
    access.updated_at
  from public.user_league_pack_access access
  join auth.users auth_user on auth_user.id = access.user_id
  where access.user_id = v_target_user_id
    and access.pack_key = target_pack_key;
end;
$$;

grant execute on function public.grant_league_pack_access_by_email(text, text) to authenticated;

create or replace function public.revoke_league_pack_access_by_email(
  target_email text,
  target_pack_key text
)
returns table (
  email text,
  user_id uuid,
  pack_key text,
  enabled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_user_id uuid;
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  if target_pack_key not in ('germany_top_3', 'england_top_4', 'italy_top_3', 'spain_top_4', 'france_top_3', 'premium_full') then
    raise exception 'invalid_pack_key';
  end if;

  v_target_user_id := (
    select auth_user.id
    from auth.users auth_user
    where lower(auth_user.email) = lower(trim(target_email))
    limit 1
  );

  if v_target_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into public.user_league_pack_access (user_id, pack_key, enabled)
  values (v_target_user_id, target_pack_key, false)
  on conflict on constraint user_league_pack_access_pkey
  do update set
    enabled = false,
    updated_at = timezone('utc', now());

  return query
  select
    auth_user.email::text,
    access.user_id,
    access.pack_key,
    access.enabled,
    access.updated_at
  from public.user_league_pack_access access
  join auth.users auth_user on auth_user.id = access.user_id
  where access.user_id = v_target_user_id
    and access.pack_key = target_pack_key;
end;
$$;

grant execute on function public.revoke_league_pack_access_by_email(text, text) to authenticated;
