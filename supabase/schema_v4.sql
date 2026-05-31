-- wheno v4 — voice transcription state

create table if not exists public.pending_voice (
  user_id       uuid primary key references public.users(id) on delete cascade,
  transcription text not null,
  expires_at    timestamptz not null default (now() + interval '5 minutes')
);
