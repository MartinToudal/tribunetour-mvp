-- Admin editor for countries, leagues and stadium/club reference data.
-- Apply after the existing admin_users/is_current_user_admin functions.

alter table public.stadiums add column if not exists country_code text;
alter table public.stadiums add column if not exists league_code text;
alter table public.stadiums add column if not exists league_pack text;
alter table public.stadiums add column if not exists short_code text;
alter table public.stadiums add column if not exists competition_id text;
alter table public.stadiums add column if not exists season_id text;
alter table public.stadiums add column if not exists membership_status text not null default 'active';
alter table public.stadiums add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.reference_countries (
  code text primary key check (code ~ '^[a-z]{2,3}$'),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reference_leagues (
  code text primary key,
  country_code text not null references public.reference_countries(code) on update cascade,
  name text not null,
  level integer check (level is null or level > 0),
  season_id text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reference_data_change_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('country', 'league', 'stadium')),
  entity_id text not null,
  action text not null check (action in ('create', 'update')),
  before_value jsonb not null default '{}'::jsonb,
  after_value jsonb not null default '{}'::jsonb,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_reference_leagues_country on public.reference_leagues(country_code, level);
create index if not exists idx_reference_change_log_entity on public.reference_data_change_log(entity_type, entity_id, changed_at desc);

alter table public.reference_countries enable row level security;
alter table public.reference_leagues enable row level security;
alter table public.reference_data_change_log enable row level security;

create or replace function public.list_reference_admin_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_current_user_admin() then raise exception 'not_authorized'; end if;
  return jsonb_build_object(
    'countries', coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.reference_countries c), '[]'::jsonb),
    'leagues', coalesce((select jsonb_agg(to_jsonb(l) order by l.country_code, l.level nulls last, l.name) from public.reference_leagues l), '[]'::jsonb),
    'stadiums', coalesce((select jsonb_agg(to_jsonb(s) order by s.country_code nulls last, s.league, s.team) from public.stadiums s), '[]'::jsonb)
  );
end;
$$;

create or replace function public.upsert_reference_country(p_code text, p_name text, p_active boolean default true)
returns public.reference_countries
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_before jsonb; v_row public.reference_countries;
begin
  if not public.is_current_user_admin() then raise exception 'not_authorized'; end if;
  select to_jsonb(c) into v_before from public.reference_countries c where c.code = lower(trim(p_code));
  insert into public.reference_countries(code, name, active, updated_at)
  values (lower(trim(p_code)), trim(p_name), coalesce(p_active, true), timezone('utc', now()))
  on conflict (code) do update set name = excluded.name, active = excluded.active, updated_at = excluded.updated_at
  returning * into v_row;
  insert into public.reference_data_change_log(entity_type, entity_id, action, before_value, after_value, changed_by)
  values ('country', v_row.code, case when v_before is null then 'create' else 'update' end, coalesce(v_before, '{}'::jsonb), to_jsonb(v_row), auth.uid());
  return v_row;
end;
$$;

create or replace function public.upsert_reference_league(p_code text, p_country_code text, p_name text, p_level integer default null, p_season_id text default null, p_active boolean default true)
returns public.reference_leagues
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_before jsonb; v_row public.reference_leagues;
begin
  if not public.is_current_user_admin() then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.reference_countries where code = lower(trim(p_country_code))) then raise exception 'country_not_found'; end if;
  select to_jsonb(l) into v_before from public.reference_leagues l where l.code = lower(trim(p_code));
  insert into public.reference_leagues(code, country_code, name, level, season_id, active, updated_at)
  values (lower(trim(p_code)), lower(trim(p_country_code)), trim(p_name), p_level, nullif(trim(coalesce(p_season_id, '')), ''), coalesce(p_active, true), timezone('utc', now()))
  on conflict (code) do update set country_code = excluded.country_code, name = excluded.name, level = excluded.level, season_id = excluded.season_id, active = excluded.active, updated_at = excluded.updated_at
  returning * into v_row;
  insert into public.reference_data_change_log(entity_type, entity_id, action, before_value, after_value, changed_by)
  values ('league', v_row.code, case when v_before is null then 'create' else 'update' end, coalesce(v_before, '{}'::jsonb), to_jsonb(v_row), auth.uid());
  return v_row;
end;
$$;

create or replace function public.upsert_reference_stadium(p_payload jsonb)
returns public.stadiums
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_before jsonb; v_row public.stadiums;
begin
  if not public.is_current_user_admin() then raise exception 'not_authorized'; end if;
  if coalesce(trim(p_payload->>'id'), '') = '' then raise exception 'stadium_id_required'; end if;
  if nullif(trim(p_payload->>'lat'), '')::double precision not between -90 and 90 then raise exception 'invalid_latitude'; end if;
  if nullif(trim(p_payload->>'lon'), '')::double precision not between -180 and 180 then raise exception 'invalid_longitude'; end if;
  select to_jsonb(s) into v_before from public.stadiums s where s.id = trim(p_payload->>'id');
  insert into public.stadiums(id, name, team, league, city, lat, lon, country_code, league_code, league_pack, short_code, competition_id, season_id, membership_status, updated_at)
  values (trim(p_payload->>'id'), trim(p_payload->>'name'), trim(p_payload->>'team'), trim(p_payload->>'league'), nullif(trim(p_payload->>'city'), ''), (p_payload->>'lat')::double precision, (p_payload->>'lon')::double precision, lower(trim(p_payload->>'country_code')), nullif(trim(p_payload->>'league_code'), ''), nullif(trim(p_payload->>'league_pack'), ''), nullif(trim(p_payload->>'short_code'), ''), nullif(trim(p_payload->>'competition_id'), ''), nullif(trim(p_payload->>'season_id'), ''), coalesce(nullif(trim(p_payload->>'membership_status'), ''), 'active'), timezone('utc', now()))
  on conflict (id) do update set name = excluded.name, team = excluded.team, league = excluded.league, city = excluded.city, lat = excluded.lat, lon = excluded.lon, country_code = excluded.country_code, league_code = excluded.league_code, league_pack = excluded.league_pack, short_code = excluded.short_code, competition_id = excluded.competition_id, season_id = excluded.season_id, membership_status = excluded.membership_status, updated_at = excluded.updated_at
  returning * into v_row;
  insert into public.reference_data_change_log(entity_type, entity_id, action, before_value, after_value, changed_by)
  values ('stadium', v_row.id, case when v_before is null then 'create' else 'update' end, coalesce(v_before, '{}'::jsonb), to_jsonb(v_row), auth.uid());
  return v_row;
end;
$$;

grant execute on function public.list_reference_admin_data() to authenticated;
grant execute on function public.upsert_reference_country(text, text, boolean) to authenticated;
grant execute on function public.upsert_reference_league(text, text, text, integer, text, boolean) to authenticated;
grant execute on function public.upsert_reference_stadium(jsonb) to authenticated;
