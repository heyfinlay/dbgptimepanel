-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_hex text not null,
  created_at timestamptz default now()
);

-- Drivers
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  number int not null check (number >= 0 and number <= 999),
  name text not null,
  team_id uuid references public.teams(id) on delete set null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Practice','Quali','Race')),
  title text not null,
  target_laps int not null default 20,
  state text not null check (state in ('PREP','FINAL_CALL','STARTING','GREEN','FINISHED')) default 'PREP',
  race_start_epoch_ms bigint,
  meta jsonb default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz default now()
);

-- Laps
create table if not exists public.laps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  lap_index int not null,
  lap_ms int not null,
  absolute_ms int not null,
  valid boolean default true,
  created_at timestamptz default now(),
  unique (session_id, driver_id, lap_index)
);

-- Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

-- Penalties
create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  seconds int not null check (seconds >= 0),
  reason text,
  created_at timestamptz default now()
);

alter table public.teams enable row level security;
alter table public.drivers enable row level security;
alter table public.sessions enable row level security;
alter table public.laps enable row level security;
alter table public.events enable row level security;
alter table public.penalties enable row level security;

drop policy if exists "read_all_auth_teams" on public.teams;
drop policy if exists "read_all_auth_drivers" on public.drivers;
drop policy if exists "read_all_auth_sessions" on public.sessions;
drop policy if exists "read_all_auth_laps" on public.laps;
drop policy if exists "read_all_auth_events" on public.events;
drop policy if exists "read_all_auth_penalties" on public.penalties;

create policy "read_all_auth_teams" on public.teams
  for select
  using (auth.role() = 'authenticated');

create policy "read_all_auth_drivers" on public.drivers
  for select
  using (auth.role() = 'authenticated');

create policy "read_all_auth_sessions" on public.sessions
  for select
  using (auth.role() = 'authenticated');

create policy "read_all_auth_laps" on public.laps
  for select
  using (auth.role() = 'authenticated');

create policy "read_all_auth_events" on public.events
  for select
  using (auth.role() = 'authenticated');

create policy "read_all_auth_penalties" on public.penalties
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "write_staff_sessions" on public.sessions;
drop policy if exists "write_staff_laps" on public.laps;
drop policy if exists "write_staff_events" on public.events;
drop policy if exists "write_staff_penalties" on public.penalties;

create policy "write_staff_sessions" on public.sessions
  for all
  using (coalesce(auth.jwt() ->> 'role', '') = 'staff')
  with check (coalesce(auth.jwt() ->> 'role', '') = 'staff');

create policy "write_staff_laps" on public.laps
  for all
  using (coalesce(auth.jwt() ->> 'role', '') = 'staff')
  with check (coalesce(auth.jwt() ->> 'role', '') = 'staff');

create policy "write_staff_events" on public.events
  for all
  using (coalesce(auth.jwt() ->> 'role', '') = 'staff')
  with check (coalesce(auth.jwt() ->> 'role', '') = 'staff');

create policy "write_staff_penalties" on public.penalties
  for all
  using (coalesce(auth.jwt() ->> 'role', '') = 'staff')
  with check (coalesce(auth.jwt() ->> 'role', '') = 'staff');

create or replace function public.create_session(p_type text, p_title text, p_target_laps int)
returns uuid
language plpgsql
as $$
declare sid uuid := gen_random_uuid();
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'staff' then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;

  insert into public.sessions (id, type, title, target_laps)
  values (sid, p_type, p_title, coalesce(p_target_laps, 20));
  return sid;
end;
$$;

create or replace function public.capture_lap(p_session uuid, p_driver uuid, p_absolute_ms int)
returns int
language plpgsql
as $$
declare
  next_idx int;
  last_abs int;
  lap_ms int;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'staff' then
    raise exception 'insufficient privileges' using errcode = '42501';
  end if;

  select coalesce(max(lap_index), 0) + 1
    into next_idx
  from public.laps
  where session_id = p_session
    and driver_id = p_driver;

  if next_idx = 1 then
    lap_ms := p_absolute_ms;
  else
    select absolute_ms
      into last_abs
    from public.laps
    where session_id = p_session
      and driver_id = p_driver
      and lap_index = next_idx - 1;
    lap_ms := p_absolute_ms - last_abs;
  end if;

  insert into public.laps(session_id, driver_id, lap_index, lap_ms, absolute_ms)
  values (p_session, p_driver, next_idx, lap_ms, p_absolute_ms);

  insert into public.events(session_id, type, payload)
  values (p_session, 'LAP_CAPTURE', jsonb_build_object('driver_id', p_driver, 'lap_index', next_idx));
  return next_idx;
end;
$$;
