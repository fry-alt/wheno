create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id text unique not null,
  first_name text,
  last_name text,
  username text,
  photo_url text,
  timezone text not null default 'Europe/Amsterdam',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists public.busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  title text not null,
  date_from date not null,
  date_to date not null,
  duration_minutes integer not null check (duration_minutes > 0),
  preferred_time text not null default 'any' check (preferred_time in ('any', 'morning', 'afternoon', 'evening')),
  min_participants integer not null check (min_participants > 0),
  status text not null default 'open' check (status in ('open', 'selected')),
  selected_option_id uuid null,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table if not exists public.meeting_options (
  id uuid primary key default gen_random_uuid(),
  meeting_request_id uuid not null references public.meeting_requests(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  score integer not null,
  free_user_ids uuid[] not null,
  busy_user_ids uuid[] not null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_requests_selected_option_id_fkey'
  ) then
    alter table public.meeting_requests
      add constraint meeting_requests_selected_option_id_fkey
      foreign key (selected_option_id)
      references public.meeting_options(id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.meeting_options(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  unique(option_id, user_id)
);

create index if not exists idx_groups_owner_id on public.groups(owner_id);
create index if not exists idx_group_members_group_id on public.group_members(group_id);
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_busy_blocks_user_id on public.busy_blocks(user_id);
create index if not exists idx_busy_blocks_start_at on public.busy_blocks(start_at);
create index if not exists idx_busy_blocks_end_at on public.busy_blocks(end_at);
create index if not exists idx_meeting_requests_group_id on public.meeting_requests(group_id);
create index if not exists idx_meeting_options_request_id on public.meeting_options(meeting_request_id);
create index if not exists idx_votes_option_id on public.votes(option_id);
create index if not exists idx_votes_user_id on public.votes(user_id);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.busy_blocks enable row level security;
alter table public.meeting_requests enable row level security;
alter table public.meeting_options enable row level security;
alter table public.votes enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

comment on schema public is 'wheno stores data in public with RLS enabled and server-side access only for the MVP.';
