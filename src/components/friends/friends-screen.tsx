"use client";

import { useState } from "react";

import { ensureInviteCode, acceptFriendRequest, declineFriendRequest, removeFriend } from "@/lib/friends/actions";
import { buildFriendInviteLink, getInitials } from "@/lib/utils";
import type { FriendSummary, IncomingRequest } from "@/lib/friends/types";

function openTelegramShare(link: string) {
  const text = "Добавляйся в друзья в wheno";
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
  else window.open(shareUrl, "_blank");
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) return <img src={src} alt="" className="h-9 w-9 rounded-full object-cover" />;
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-semibold text-white">
      {getInitials(name)}
    </span>
  );
}

export function FriendsScreen({ friends, requests }: { friends: FriendSummary[]; requests: IncomingRequest[] }) {
  const [busy, setBusy] = useState(false);

  async function invite() {
    setBusy(true);
    try {
      const code = await ensureInviteCode();
      openTelegramShare(buildFriendInviteLink(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Друзья</h1>
        <button onClick={invite} disabled={busy} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          Пригласить
        </button>
      </div>

      {requests.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Запросы</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.friendship_id} className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
                <Avatar name={r.name} src={r.photo_url} />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{r.name}</span>
                <button onClick={() => acceptFriendRequest(r.friendship_id)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black">Принять</button>
                <button onClick={() => declineFriendRequest(r.friendship_id)} className="rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-xs text-[#999]">Отклонить</button>
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
            <p className="mt-1 text-xs text-[#555]">Нажми «Пригласить» и кинь ссылку другу</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.friendship_id} className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
                <Avatar name={f.name} src={f.photo_url} />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                <button onClick={() => removeFriend(f.friendship_id)} className="text-xs text-[#555]" aria-label="Удалить">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
