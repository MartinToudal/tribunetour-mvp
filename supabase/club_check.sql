create table if not exists public.club_check_reviews (
  id uuid primary key default gen_random_uuid(),
  club_id text not null,
  checked_by uuid not null references auth.users(id) on delete restrict,
  checked_at timestamptz not null default timezone('utc', now()),
  checks jsonb not null default '{}'::jsonb,
  notes text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.club_check_change_proposals (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.club_check_reviews(id) on delete cascade,
  club_id text not null,
  field_name text not null check (field_name in ('lat', 'lon', 'league')),
  old_value text,
  new_value text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_club_check_reviews_club_checked_at
  on public.club_check_reviews (club_id, checked_at desc);
create index if not exists idx_club_check_proposals_review
  on public.club_check_change_proposals (review_id);

alter table public.club_check_reviews enable row level security;
alter table public.club_check_change_proposals enable row level security;

create or replace function public.submit_club_check(
  p_club_id text,
  p_checks jsonb,
  p_notes text,
  p_snapshot jsonb,
  p_lat text,
  p_lon text,
  p_league text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_review_id uuid;
  v_current record;
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  select id, lat::text as lat, lon::text as lon, league
    into v_current
    from public.stadiums
   where id = p_club_id
   limit 1;

  if v_current.id is null then
    raise exception 'club_not_found';
  end if;

  insert into public.club_check_reviews (club_id, checked_by, checks, notes, snapshot)
  values (p_club_id, auth.uid(), coalesce(p_checks, '{}'::jsonb), coalesce(p_notes, ''), coalesce(p_snapshot, '{}'::jsonb))
  returning id into v_review_id;

  if coalesce(p_lat, '') <> coalesce(v_current.lat, '') then
    insert into public.club_check_change_proposals (review_id, club_id, field_name, old_value, new_value)
    values (v_review_id, p_club_id, 'lat', v_current.lat, p_lat);
  end if;
  if coalesce(p_lon, '') <> coalesce(v_current.lon, '') then
    insert into public.club_check_change_proposals (review_id, club_id, field_name, old_value, new_value)
    values (v_review_id, p_club_id, 'lon', v_current.lon, p_lon);
  end if;
  if coalesce(p_league, '') <> coalesce(v_current.league, '') then
    insert into public.club_check_change_proposals (review_id, club_id, field_name, old_value, new_value)
    values (v_review_id, p_club_id, 'league', v_current.league, p_league);
  end if;

  return v_review_id;
end;
$$;

grant execute on function public.submit_club_check(text, jsonb, text, jsonb, text, text, text) to authenticated;

create or replace function public.approve_club_check(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_proposal record;
begin
  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  if not exists (select 1 from public.club_check_reviews where id = p_review_id and status = 'submitted') then
    raise exception 'review_not_pending';
  end if;

  for v_proposal in select * from public.club_check_change_proposals where review_id = p_review_id and status = 'pending' loop
    if v_proposal.field_name = 'lat' then
      update public.stadiums set lat = nullif(v_proposal.new_value, '')::double precision where id = v_proposal.club_id;
    elsif v_proposal.field_name = 'lon' then
      update public.stadiums set lon = nullif(v_proposal.new_value, '')::double precision where id = v_proposal.club_id;
    elsif v_proposal.field_name = 'league' then
      update public.stadiums set league = nullif(v_proposal.new_value, '') where id = v_proposal.club_id;
    end if;
    update public.club_check_change_proposals
       set status = 'approved', decided_by = auth.uid(), decided_at = timezone('utc', now())
     where id = v_proposal.id;
  end loop;

  update public.club_check_reviews
     set status = 'approved', approved_by = auth.uid(), approved_at = timezone('utc', now()), updated_at = timezone('utc', now())
   where id = p_review_id;
end;
$$;

grant execute on function public.approve_club_check(uuid) to authenticated;

create or replace function public.list_club_check_reviews(p_limit integer default 100)
returns table (
  id uuid,
  club_id text,
  checked_by uuid,
  checked_at timestamptz,
  checks jsonb,
  notes text,
  snapshot jsonb,
  status text
)
language sql
security definer
set search_path = public, auth
as $$
  select r.id, r.club_id, r.checked_by, r.checked_at, r.checks, r.notes, r.snapshot, r.status
    from public.club_check_reviews r
   where public.is_current_user_admin()
   order by r.checked_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

grant execute on function public.list_club_check_reviews(integer) to authenticated;
