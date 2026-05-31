-- wheno v3 — reminders

create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  event_id   uuid not null references public.calendar_events(id) on delete cascade,
  chat_id    bigint not null,
  remind_at  timestamptz not null,
  sent       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reminders_pending on public.reminders(remind_at)
  where sent = false;

alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
