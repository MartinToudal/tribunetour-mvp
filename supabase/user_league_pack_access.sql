create table if not exists public.user_league_pack_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_key text not null,
  enabled boolean not null default true,
  granted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, pack_key)
);

alter table public.user_league_pack_access enable row level security;

drop policy if exists user_league_pack_access_select_own on public.user_league_pack_access;
create policy user_league_pack_access_select_own
on public.user_league_pack_access
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_league_pack_access_insert_own on public.user_league_pack_access;
create policy user_league_pack_access_insert_own
on public.user_league_pack_access
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_league_pack_access_update_own on public.user_league_pack_access;
create policy user_league_pack_access_update_own
on public.user_league_pack_access
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_updated_at_user_league_pack_access()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_user_league_pack_access_updated_at on public.user_league_pack_access;

create trigger trg_user_league_pack_access_updated_at
before update on public.user_league_pack_access
for each row
execute function public.set_updated_at_user_league_pack_access();
