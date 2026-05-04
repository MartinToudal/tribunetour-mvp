create table if not exists public.premium_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_key text not null check (pack_key in ('germany_top_3', 'england_top_4', 'italy_top_3', 'spain_top_4', 'france_top_3', 'portugal_top_3', 'premium_full')),
  status text not null default 'open' check (status in ('open', 'handled', 'dismissed')),
  message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.premium_access_requests enable row level security;

alter table public.premium_access_requests
drop constraint if exists premium_access_requests_pack_key_check;

alter table public.premium_access_requests
add constraint premium_access_requests_pack_key_check
check (pack_key in ('germany_top_3', 'england_top_4', 'italy_top_3', 'spain_top_4', 'france_top_3', 'portugal_top_3', 'premium_full'));

drop policy if exists premium_access_requests_select_own on public.premium_access_requests;
create policy premium_access_requests_select_own
on public.premium_access_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists premium_access_requests_insert_own on public.premium_access_requests;
create policy premium_access_requests_insert_own
on public.premium_access_requests
for insert
to authenticated
with check (auth.uid() = user_id);

create or replace function public.set_updated_at_premium_access_requests()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$function$;

drop trigger if exists trg_premium_access_requests_updated_at on public.premium_access_requests;
create trigger trg_premium_access_requests_updated_at
before update on public.premium_access_requests
for each row
execute function public.set_updated_at_premium_access_requests();

create or replace function public.submit_premium_access_request(
  target_pack_key text,
  request_message text default null
)
returns table (
  request_id uuid,
  user_id uuid,
  pack_key text,
  status text,
  message text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  if target_pack_key not in ('germany_top_3', 'england_top_4', 'italy_top_3', 'spain_top_4', 'france_top_3', 'portugal_top_3', 'premium_full') then
    raise exception 'invalid_pack_key';
  end if;

  insert into public.premium_access_requests (user_id, pack_key, message)
  values (
    auth.uid(),
    target_pack_key,
    nullif(trim(coalesce(request_message, '')), '')
  );

  insert into public.admin_notifications (
    user_id,
    type,
    title,
    body,
    payload_json
  )
  select
    admin_user.user_id,
    'premium_access_request',
    'Ny premium-anmodning',
    coalesce(auth_user.email, 'Ukendt bruger') || ' vil have adgang til ' ||
      case target_pack_key
        when 'germany_top_3' then 'Tyskland'
        when 'england_top_4' then 'England'
        when 'italy_top_3' then 'Italien'
        when 'spain_top_4' then 'Spanien'
        when 'france_top_3' then 'Frankrig'
        when 'portugal_top_3' then 'Portugal'
        when 'premium_full' then 'alle premium-pakker'
        else target_pack_key
      end || '.',
    jsonb_build_object(
      'request_id',
      (
        select request.id
        from public.premium_access_requests request
        where request.user_id = auth.uid()
          and request.pack_key = target_pack_key
        order by request.created_at desc
        limit 1
      ),
      'pack_key',
      target_pack_key,
      'requester_user_id',
      auth.uid(),
      'requester_email',
      auth_user.email
    )
  from public.admin_users admin_user
  left join auth.users auth_user on auth_user.id = auth.uid();

  return query
  select
    request.id,
    request.user_id,
    request.pack_key,
    request.status,
    request.message,
    request.created_at
  from public.premium_access_requests request
  where request.user_id = auth.uid()
    and request.pack_key = target_pack_key
  order by request.created_at desc
  limit 1;
end;
$function$;

grant execute on function public.submit_premium_access_request(text, text) to authenticated;

create or replace function public.list_premium_access_requests()
returns table (
  request_id uuid,
  email text,
  user_id uuid,
  pack_key text,
  status text,
  message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    request.id,
    auth_user.email::text,
    request.user_id,
    request.pack_key,
    request.status,
    request.message,
    request.created_at,
    request.updated_at
  from public.premium_access_requests request
  join auth.users auth_user on auth_user.id = request.user_id
  order by
    case request.status
      when 'open' then 0
      when 'handled' then 1
      else 2
    end,
    request.created_at desc;
end;
$function$;

grant execute on function public.list_premium_access_requests() to authenticated;

create or replace function public.approve_premium_access_request(
  target_request_id uuid
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
as $function$
declare
  v_request public.premium_access_requests%rowtype;
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  select *
  into v_request
  from public.premium_access_requests request
  where request.id = target_request_id;

  if v_request.id is null then
    raise exception 'request_not_found';
  end if;

  if v_request.pack_key not in ('germany_top_3', 'england_top_4', 'italy_top_3', 'spain_top_4', 'france_top_3', 'portugal_top_3', 'premium_full') then
    raise exception 'invalid_pack_key';
  end if;

  insert into public.user_league_pack_access (user_id, pack_key, enabled)
  values (v_request.user_id, v_request.pack_key, true)
  on conflict on constraint user_league_pack_access_pkey
  do update set
    enabled = true,
    updated_at = timezone('utc', now());

  update public.premium_access_requests request
  set status = 'handled'
  where request.id = v_request.id;

  update public.admin_notifications notification
  set
    is_actioned = true,
    is_read = true,
    updated_at = timezone('utc', now())
  where notification.type = 'premium_access_request'
    and notification.payload_json ->> 'request_id' = v_request.id::text;

  return query
  select
    auth_user.email::text,
    access.user_id,
    access.pack_key,
    access.enabled,
    access.updated_at
  from public.user_league_pack_access access
  join auth.users auth_user on auth_user.id = access.user_id
  where access.user_id = v_request.user_id
    and access.pack_key = v_request.pack_key;
end;
$function$;

grant execute on function public.approve_premium_access_request(uuid) to authenticated;
