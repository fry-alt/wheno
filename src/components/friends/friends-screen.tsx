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
import type { AwaitingPick, IncomingMeeting } from "@/lib/meetings/types";

const REASON_TEXT: Record<string, string> = {
  empty: "Введи код",
  not_found: "Код не найден",
  self: "Это твой код",
  exists: "Вы уже друзья или запрос уже отправлен",
};

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) return <img src={src} alt="" className="h-9 w-9 rounded-full object-cover" />;
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-semibold text-white">
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
  timezone,
}: {
  friends: FriendSummary[];
  requests: IncomingRequest[];
  myCode: string;
  incomingMeetings: IncomingMeeting[];
  awaitingPicks: AwaitingPick[];
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
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-2xl font-bold text-white">Друзья</h1>

      <section className="mb-5 rounded-2xl bg-[#1a1a1a] px-4 py-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#555]">Твой код</p>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xl font-bold tracking-[0.2em] text-white">{myCode}</span>
          <button
            onClick={copyCode}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black"
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-[#555]">Отправь код другу, чтобы он тебя добавил</p>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Добавить по коду</p>
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
            className="min-w-0 flex-1 rounded-xl bg-[#1a1a1a] px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-[#555]"
          />
          <button
            onClick={add}
            disabled={pending || !code.trim()}
            className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
        {msg && (
          <p className={`mt-2 text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
        )}
      </section>

      <MeetingsSection incoming={incomingMeetings} awaiting={awaitingPicks} timezone={timezone} />

      {requests.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Запросы</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.friendship_id} className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
                <Avatar name={r.name} src={r.photo_url} />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{r.name}</span>
                <button
                  onClick={() => startTransition(async () => { await acceptFriendRequest(r.friendship_id); router.refresh(); })}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  Принять
                </button>
                <button
                  onClick={() => startTransition(async () => { await declineFriendRequest(r.friendship_id); router.refresh(); })}
                  className="rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-xs text-[#999]"
                >
                  Отклонить
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Мои друзья</p>
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-white">Пока никого</p>
            <p className="mt-1 text-xs text-[#555]">Поделись своим кодом или добавь друга по его коду</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <Link
                key={f.friendship_id}
                href={`/friends/${f.user_id}`}
                className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5"
              >
                <Avatar name={f.name} src={f.photo_url} />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                <button
                  onClick={(e) => { e.preventDefault(); startTransition(async () => { await removeFriend(f.friendship_id); router.refresh(); }); }}
                  className="text-xs text-[#555]"
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
