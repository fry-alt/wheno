"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { proposeMeeting } from "@/lib/meetings/actions";
import type { PartOfDay } from "@/lib/meetings/types";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Local calendar date (not UTC) so the default window matches the user's day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MeetingForm({ friendId }: { friendId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(60);
  const [from, setFrom] = useState(todayPlus(0));
  const [to, setTo] = useState(todayPlus(6));
  const [part, setPart] = useState<PartOfDay>("any");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending) return;
    startTransition(async () => {
      try {
        await proposeMeeting(friendId, {
          title,
          duration_min: duration,
          window_from: from,
          window_to: to,
          part_of_day: part,
        });
        setMsg({ ok: true, text: "Приглашение отправлено" });
        setTitle("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Не получилось" });
      }
    });
  }

  if (!open) {
    return (
      <div>
        <button
          onClick={() => { setOpen(true); setMsg(null); }}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          Предложить встречу
        </button>
        {msg && (
          <p className={`mt-2 text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-card px-4 py-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название (напр. Кофе)"
        className="w-full rounded-xl bg-card-muted px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted"
      />
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-muted">
          Длительность
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-card-muted px-3 py-2.5 text-sm text-foreground outline-none"
          >
            <option value={30}>30 мин</option>
            <option value={60}>1 час</option>
            <option value={90}>1.5 часа</option>
            <option value={120}>2 часа</option>
          </select>
        </label>
        <label className="flex-1 text-xs text-muted">
          Время дня
          <select
            value={part}
            onChange={(e) => setPart(e.target.value as PartOfDay)}
            className="mt-1 w-full rounded-xl bg-card-muted px-3 py-2.5 text-sm text-foreground outline-none"
          >
            <option value="any">Любое</option>
            <option value="morning">Утро</option>
            <option value="afternoon">День</option>
            <option value="evening">Вечер</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-muted">
          С
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl bg-card-muted px-3 py-2.5 text-sm text-foreground outline-none" />
        </label>
        <label className="flex-1 text-xs text-muted">
          По
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl bg-card-muted px-3 py-2.5 text-sm text-foreground outline-none" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={pending} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          Отправить
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl bg-card-strong px-4 py-2.5 text-sm text-muted">
          Отмена
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
