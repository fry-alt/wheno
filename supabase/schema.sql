-- wheno schema (Layer 1)
--
-- Access model: the app talks to Postgres ONLY via the Supabase service-role key
-- (see src/lib/supabase/admin.ts), which bypasses RLS. We still ENABLE RLS with no
-- policies on every table so that the anon/authenticated roles (e.g. a leaked anon
-- key hitting the REST API) are denied all direct access. Owner-scoping is enforced
-- in application queries via `.eq("user_id", ...)`. If a client-role path is ever
-- added, owner policies must be created here first.
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  telegram_id text unique not null,
  first_name  text,
  last_name   text,
  username    text,
  photo_url   text,
  timezone    text not null default 'Europe/Amsterdam',
  day_start   time not null default '08:00',
  day_end     time not null default '22:00',
  invite_code text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.users enable row level security;
drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  category   text not null default 'other',
  is_fixed   boolean not null default false,
  notes      text,
  location   text,
  recurrence     jsonb,
  excluded_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at)
);
create index if not exists events_user_starts_idx on public.events(user_id, starts_at);
alter table public.events enable row level security;
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null,
  date       date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notes_user_date_idx on public.notes(user_id, date);
alter table public.notes enable row level security;

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships(requester_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);
alter table public.friendships enable row level security;

create table if not exists public.meeting_proposals (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id   uuid not null references public.users(id) on delete cascade,
  title        text not null,
  category     text not null default 'meeting',
  duration_min int  not null,
  window_from  date not null,
  window_to    date not null,
  part_of_day  text not null default 'any',
  status       text not null default 'pending',
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index if not exists meeting_proposals_to_idx   on public.meeting_proposals(to_user_id);
create index if not exists meeting_proposals_from_idx on public.meeting_proposals(from_user_id);
alter table public.meeting_proposals enable row level security;

create table if not exists public.profiles (
  user_id     uuid primary key references public.users(id) on delete cascade,
  bio         text,
  city        text,
  birthdate   date,
  gender      text,
  show_age    boolean not null default true,
  show_gender boolean not null default true,
  interests   text[] not null default '{}',
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  storage_path text not null,
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists profile_photos_user_idx on public.profile_photos(user_id, position);
alter table public.profile_photos enable row level security;

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  type        text not null,
  description text,
  place       text,
  lat         double precision,
  lng         double precision,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  capacity    int,
  visibility  text not null default 'public',
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  constraint activities_time_order check (ends_at > starts_at)
);
-- Map coordinates (cycle 4) — idempotent for existing deployments.
alter table public.activities add column if not exists lat double precision;
alter table public.activities add column if not exists lng double precision;
create index if not exists activities_starts_idx on public.activities(starts_at);
alter table public.activities enable row level security;

create table if not exists public.activity_participants (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  event_id    uuid,
  joined_at   timestamptz not null default now(),
  unique (activity_id, user_id)
);
create index if not exists activity_participants_user_idx on public.activity_participants(user_id);
alter table public.activity_participants enable row level security;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;

create table if not exists public.activity_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);
alter table public.activity_reports enable row level security;

-- ── Hardening (cycle: pre-launch) ────────────────────────────────────────────

-- Per-user sliding-window rate limit for AI endpoints (protects OpenAI spend).
create table if not exists public.ai_rate_limit (
  user_id      uuid primary key references public.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count        int not null default 0
);
alter table public.ai_rate_limit enable row level security;

-- Returns true if the call is allowed (and records it), false if over the limit.
create or replace function public.check_rate_limit(p_user uuid, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare
  v_start timestamptz;
  v_count int;
begin
  insert into public.ai_rate_limit(user_id) values (p_user)
    on conflict (user_id) do nothing;
  select window_start, count into v_start, v_count
    from public.ai_rate_limit where user_id = p_user for update;
  if now() - v_start > make_interval(secs => p_window_seconds) then
    update public.ai_rate_limit set window_start = now(), count = 1 where user_id = p_user;
    return true;
  end if;
  if v_count >= p_limit then
    return false;
  end if;
  update public.ai_rate_limit set count = count + 1 where user_id = p_user;
  return true;
end;
$$;

-- Atomic join: locks the activity row so concurrent joins can't exceed capacity.
-- Returns 'ok' | 'missing' | 'cancelled' | 'full' | 'joined'.
create or replace function public.join_activity(p_activity uuid, p_user uuid, p_event uuid)
returns text
language plpgsql
as $$
declare
  v_cap int;
  v_status text;
  v_count int;
begin
  select capacity, status into v_cap, v_status
    from public.activities where id = p_activity for update;
  if not found then return 'missing'; end if;
  if v_status <> 'open' then return 'cancelled'; end if;
  select count(*) into v_count from public.activity_participants where activity_id = p_activity;
  if v_cap is not null and v_count >= v_cap then return 'full'; end if;
  begin
    insert into public.activity_participants(activity_id, user_id, event_id)
      values (p_activity, p_user, p_event);
  exception when unique_violation then
    return 'joined';
  end;
  return 'ok';
end;
$$;
