"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { sendFriendRequestById } from "@/lib/friends/actions";
import { interestLabel } from "@/lib/profile/interests";
import { getInitials } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { PeopleMatch } from "@/lib/people/match";

export function PeopleMatches({ matches, hasInterests }: { matches: PeopleMatch[]; hasInterests: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<string, string>>({});

  if (!hasInterests) {
    return (
      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Познакомься</p>
        <Link href="/profile" className="block rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-center transition active:scale-[0.99]">
          <p className="text-sm font-semibold text-foreground">Добавь интересы в профиле</p>
          <p className="mt-0.5 text-xs text-muted">И мы покажем людей с похожими увлечениями →</p>
        </Link>
      </section>
    );
  }
  function add(userId: string) {
    haptic.impact();
    start(async () => {
      const r = await sendFriendRequestById(userId);
      if (r.ok) {
        haptic.success();
        setDone((d) => ({ ...d, [userId]: "Заявка отправлена" }));
      } else {
        haptic.error();
        setDone((d) => ({ ...d, [userId]: r.reason === "exists" ? "Уже есть" : "Не вышло" }));
      }
      router.refresh();
    });
  }

  return (
    <section className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Познакомься</p>
      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center">
          <p className="text-sm font-semibold text-foreground">Пока никого похожего</p>
          <p className="mt-0.5 text-xs text-muted">Появятся люди с общими интересами — заглядывай позже</p>
        </div>
      ) : (
      <div className="flex flex-col gap-2">
        {matches.map((m) => {
          const c = m.candidate;
          return (
            <div key={c.user_id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
              {c.photo_url ? (
                <img src={c.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card-strong text-xs font-semibold text-foreground">{getInitials(c.name)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {c.name}{m.sameCity && c.city ? ` · ${c.city}` : ""}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {m.sharedInterests.slice(0, 3).map((i) => (
                    <span key={i} className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">{interestLabel(i)}</span>
                  ))}
                </div>
              </div>
              {done[c.user_id] ? (
                <span className="shrink-0 text-xs text-muted">{done[c.user_id]}</span>
              ) : (
                <button onClick={() => add(c.user_id)} disabled={pending} className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition active:scale-95 disabled:opacity-50">Добавить</button>
              )}
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
