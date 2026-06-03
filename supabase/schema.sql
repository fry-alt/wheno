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
