create table if not exists public.premium_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_key text not null check (pack_key in ('germany_top_3', 'england_top_4', 'premium_full')),
  status text not null default 'open' check (status in ('open', 'handled', 'dismissed')),
  message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.premium_access_requests enable row level security;

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

  if target_pack_key not in ('germany_top_3', 'england_top_4', 'premium_full') then
    raise exception 'invalid_pack_key';
  end if;

  insert into public.premium_access_requests (user_id, pack_key, message)
  values (
    auth.uid(),
    target_pack_key,
    nullif(trim(coalesce(request_message, '')), '')
  );

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
