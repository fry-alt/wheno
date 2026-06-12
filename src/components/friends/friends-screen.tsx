"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "@/lib/friends/actions";
import { getInitials } from "@/lib/utils";
import type { FriendSummary, IncomingRequest } from "@/lib/friends/types";
import Link from "next/link";
import { MeetingsSection } from "@/components/friends/meetings-section";
import { PeopleMatches } from "@/components/friends/people-matches";
import type { AwaitingPick, IncomingMeeting } from "@/lib/meetings/types";
import type { PeopleMatch } from "@/lib/people/match";

const REASON_TEXT: Record<string, string> = {
  empty: "Введи код",
  not_found: "Код не найден",
  self: "Это твой код",
  exists: "Вы уже друзья или запрос уже отправлен",
};

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) return <img src={src} alt="" className="h-9 w-9 rounded-full object-cover" />;
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card-strong text-xs font-semibold text-foreground">
      {getInitials(name)}
    </span>
  );
}

export function FriendsScreen({
  friends,
  requests,
  myCode,
  incomingMeetings,
  awaitingPicks,
  people,
  timezone,
}: {
  friends: FriendSummary[];
  requests: IncomingRequest[];
  myCode: string;
  incomingMeetings: IncomingMeeting[];
  awaitingPicks: AwaitingPick[];
  people: { matches: PeopleMatch[]; hasInterests: boolean };
  timezone: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function copyCode() {
    navigator.clipboard
      ?.writeText(myCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  function add() {
    const value = code.trim();
    if (!value || pending) return;
    startTransition(async () => {
      const res = await sendFriendRequest(value);
      if (res.ok) {
        setMsg({ ok: true, text: "Запрос отправлен" });
        setCode("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: REASON_TEXT[res.reason] ?? "Не получилось" });
      }
    });
  }

  return (
    <div className="px-4 pt-5 animate-[fadeRise_300ms_ease-out]">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Друзья</h1>

      <section className="mb-5 rounded-2xl bg-card px-4 py-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Твой код</p>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xl font-bold tracking-[0.2em] text-foreground">{myCode}</span>
          <button
            onClick={copyCode}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted">Отправь код другу, чтобы он тебя добавил</p>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Добавить по коду</p>
        <div className="flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Код друга"
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-foreground outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted"
          />
          <button
            onClick={add}
            disabled={pending || !code.trim()}
            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
        {msg && (
          <p className={`mt-2 text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>
        )}
      </section>

      <MeetingsSection incoming={incomingMeetings} awaiting={awaitingPicks} timezone={timezone} />

      <PeopleMatches matches={people.matches} hasInterests={people.hasInterests} />

      {requests.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Запросы</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.friendship_id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
                <Avatar name={r.name} src={r.photo_url} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{r.name}</span>
                <button
                  onClick={() => startTransition(async () => { await acceptFriendRequest(r.friendship_id); router.refresh(); })}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                >
                  Принять
                </button>
                <button
                  onClick={() => startTransition(async () => { await declineFriendRequest(r.friendship_id); router.refresh(); })}
                  className="rounded-lg bg-card-strong px-3 py-1.5 text-xs text-muted"
                >
                  Отклонить
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Мои друзья</p>
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">Пока никого</p>
            <p className="mt-1 text-xs text-muted">Поделись своим кодом или добавь друга по его коду</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <Link
                key={f.friendship_id}
                href={`/friends/${f.user_id}`}
                className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5"
              >
                <Avatar name={f.name} src={f.photo_url} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
                <button
                  onClick={(e) => { e.preventDefault(); startTransition(async () => { await removeFriend(f.friendship_id); router.refresh(); }); }}
                  className="text-xs text-muted"
                  aria-label="Удалить"
                >
                  ✕
                </button>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
