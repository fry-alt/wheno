-- wheno v2 — AI calendar tables
-- Run this after schema.sql

-- ─── Activity types reference ───────────────────────────────────────────────
-- gym, run, swim, tennis, cycling, yoga          → energy_after=low, dress=athletic
-- dinner, lunch, coffee, bar                     → energy varies, dress=casual/smart
-- work, meeting, conference                      → energy_after=medium, dress=smart/formal
-- party, concert, theatre                        → energy_after=low, dress=smart/formal
-- rest, sleep, movie                             → energy_after=high

create table if not exists public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null,
  activity_type text,                        -- 'gym' | 'dinner' | 'work' | 'coffee' | ...
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  location      text,
  energy_after  text check (energy_after  in ('high', 'medium', 'low')),
  dress_code    text check (dress_code    in ('athletic', 'casual', 'smart', 'formal')),
  is_flexible   boolean not null default false,
  notes         text,
  source        text not null default 'ai',  -- 'ai' | 'manual' | 'imported'
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.user_profiles (
  user_id       uuid primary key references public.users(id) on delete cascade,
  interests     text[]   not null default '{}',   -- ['tennis','coffee','hiking']
  wake_time     time,                              -- '07:00'
  sleep_time    time,                              -- '23:00'
  work_start    time,
  work_end      time,
  ai_context    text,    -- накопленный ИИ-контекст о пользователе (plain text)
  onboarded     boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- Conversation history (last N messages per user for context window)
create table if not exists public.bot_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_calendar_events_user_id    on public.calendar_events(user_id);
create index if not exists idx_calendar_events_starts_at  on public.calendar_events(starts_at);
create index if not exists idx_bot_messages_user_id       on public.bot_messages(user_id, created_at);

-- RLS
alter table public.calendar_events enable row level security;
alter table public.user_profiles    enable row level security;
alter table public.bot_messages     enable row level security;

revoke all on public.calendar_events from anon, authenticated;
revoke all on public.user_profiles    from anon, authenticated;
revoke all on public.bot_messages     from anon, authenticated;

-- Updated-at trigger for user_profiles
drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();
