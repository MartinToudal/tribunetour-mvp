create table if not exists public.admin_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null unique,
  platform text not null default 'ios' check (platform in ('ios')),
  app_build text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_admin_device_tokens_user_id
  on public.admin_device_tokens (user_id);

create index if not exists idx_admin_device_tokens_active
  on public.admin_device_tokens (is_active);

alter table public.admin_device_tokens enable row level security;

drop policy if exists admin_device_tokens_select_own on public.admin_device_tokens;
create policy admin_device_tokens_select_own
on public.admin_device_tokens
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists admin_device_tokens_insert_own on public.admin_device_tokens;
create policy admin_device_tokens_insert_own
on public.admin_device_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists admin_device_tokens_update_own on public.admin_device_tokens;
create policy admin_device_tokens_update_own
on public.admin_device_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('premium_access_request')),
  title text not null,
  body text not null,
  payload_json jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  is_actioned boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_admin_notifications_user_created
  on public.admin_notifications (user_id, created_at desc);

create index if not exists idx_admin_notifications_user_open
  on public.admin_notifications (user_id, is_actioned, created_at desc);

alter table public.admin_notifications enable row level security;

drop policy if exists admin_notifications_select_own on public.admin_notifications;
create policy admin_notifications_select_own
on public.admin_notifications
for select
to authenticated
using (
  auth.uid() = user_id
  and public.is_current_user_admin()
);

drop policy if exists admin_notifications_update_own on public.admin_notifications;
create policy admin_notifications_update_own
on public.admin_notifications
for update
to authenticated
using (
  auth.uid() = user_id
  and public.is_current_user_admin()
)
with check (
  auth.uid() = user_id
  and public.is_current_user_admin()
);

create or replace function public.set_updated_at_admin_device_tokens()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = timezone('utc', now());
  new.last_seen_at = timezone('utc', now());
  return new;
end;
$function$;

drop trigger if exists trg_admin_device_tokens_updated_at on public.admin_device_tokens;
create trigger trg_admin_device_tokens_updated_at
before update on public.admin_device_tokens
for each row
execute function public.set_updated_at_admin_device_tokens();

create or replace function public.set_updated_at_admin_notifications()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$function$;

drop trigger if exists trg_admin_notifications_updated_at on public.admin_notifications;
create trigger trg_admin_notifications_updated_at
before update on public.admin_notifications
for each row
execute function public.set_updated_at_admin_notifications();

create or replace function public.upsert_admin_device_token(
  target_device_token text,
  target_platform text default 'ios',
  target_app_build text default null
)
returns table (
  token_id uuid,
  user_id uuid,
  platform text,
  app_build text,
  is_active boolean,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
  v_platform text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  if nullif(trim(coalesce(target_device_token, '')), '') is null then
    raise exception 'invalid_device_token';
  end if;

  v_platform := lower(trim(coalesce(target_platform, 'ios')));
  if v_platform not in ('ios') then
    raise exception 'invalid_platform';
  end if;

  insert into public.admin_device_tokens (
    user_id,
    device_token,
    platform,
    app_build,
    is_active,
    last_seen_at
  )
  values (
    v_user_id,
    trim(target_device_token),
    v_platform,
    nullif(trim(coalesce(target_app_build, '')), ''),
    true,
    timezone('utc', now())
  )
  on conflict (device_token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    app_build = excluded.app_build,
    is_active = true,
    updated_at = timezone('utc', now()),
    last_seen_at = timezone('utc', now());

  return query
  select
    token.id,
    token.user_id,
    token.platform,
    token.app_build,
    token.is_active,
    token.last_seen_at
  from public.admin_device_tokens token
  where token.device_token = trim(target_device_token)
  limit 1;
end;
$function$;

grant execute on function public.upsert_admin_device_token(text, text, text) to authenticated;

create or replace function public.deactivate_admin_device_token(
  target_device_token text
)
returns table (
  token_id uuid,
  user_id uuid,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  update public.admin_device_tokens token
  set
    is_active = false,
    updated_at = timezone('utc', now())
  where token.user_id = v_user_id
    and token.device_token = trim(coalesce(target_device_token, ''));

  return query
  select
    token.id,
    token.user_id,
    token.is_active,
    token.updated_at
  from public.admin_device_tokens token
  where token.user_id = v_user_id
    and token.device_token = trim(coalesce(target_device_token, ''))
  limit 1;
end;
$function$;

grant execute on function public.deactivate_admin_device_token(text) to authenticated;

create or replace function public.list_admin_notifications(
  include_actioned boolean default false
)
returns table (
  notification_id uuid,
  user_id uuid,
  type text,
  title text,
  body text,
  payload_json jsonb,
  is_read boolean,
  is_actioned boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    notification.id,
    notification.user_id,
    notification.type,
    notification.title,
    notification.body,
    notification.payload_json,
    notification.is_read,
    notification.is_actioned,
    notification.created_at,
    notification.updated_at
  from public.admin_notifications notification
  where notification.user_id = v_user_id
    and (include_actioned or not notification.is_actioned)
  order by
    case when notification.is_actioned then 1 else 0 end,
    notification.created_at desc;
end;
$function$;

grant execute on function public.list_admin_notifications(boolean) to authenticated;

create or replace function public.get_admin_notification_badge_count()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
  v_badge_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_current_user_admin() then
    return 0;
  end if;

  select count(*)::integer
  into v_badge_count
  from public.admin_notifications notification
  where notification.user_id = v_user_id
    and not notification.is_actioned;

  return coalesce(v_badge_count, 0);
end;
$function$;

grant execute on function public.get_admin_notification_badge_count() to authenticated;

create or replace function public.mark_admin_notification_read(
  target_notification_id uuid,
  target_is_read boolean default true
)
returns table (
  notification_id uuid,
  is_read boolean,
  is_actioned boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  update public.admin_notifications notification
  set
    is_read = target_is_read,
    updated_at = timezone('utc', now())
  where notification.id = target_notification_id
    and notification.user_id = v_user_id;

  return query
  select
    notification.id,
    notification.is_read,
    notification.is_actioned,
    notification.updated_at
  from public.admin_notifications notification
  where notification.id = target_notification_id
    and notification.user_id = v_user_id
  limit 1;
end;
$function$;

grant execute on function public.mark_admin_notification_read(uuid, boolean) to authenticated;

create or replace function public.mark_admin_notification_actioned(
  target_notification_id uuid,
  target_is_actioned boolean default true,
  target_is_read boolean default true
)
returns table (
  notification_id uuid,
  is_read boolean,
  is_actioned boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  update public.admin_notifications notification
  set
    is_actioned = target_is_actioned,
    is_read = target_is_read,
    updated_at = timezone('utc', now())
  where notification.id = target_notification_id
    and notification.user_id = v_user_id;

  return query
  select
    notification.id,
    notification.is_read,
    notification.is_actioned,
    notification.updated_at
  from public.admin_notifications notification
  where notification.id = target_notification_id
    and notification.user_id = v_user_id
  limit 1;
end;
$function$;

grant execute on function public.mark_admin_notification_actioned(uuid, boolean, boolean) to authenticated;
