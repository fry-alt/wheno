"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { categoryEmoji } from "@/lib/events/categories";
import { createPlanAction, updateDayHoursAction } from "@/lib/advisor/actions";
import type { Category } from "@/lib/events/types";
import type { ProposedSlot } from "@/lib/advisor/types";

interface PlanResult {
  slots: ProposedSlot[];
  request: { title: string; category: Category; count: number };
}

export function AdvisorSheet({
  timezone,
  dayStart,
  dayEnd,
  onClose,
}: {
  timezone: string;
  dayStart: string;
  dayEnd: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [start, setStart] = useState(dayStart.slice(0, 5));
  const [end, setEnd] = useState(dayEnd.slice(0, 5));
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function find() {
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const res = await fetch("/api/find-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as PlanResult;
      setResult(data);
      setSelected(new Set(data.slots.map((_, i) => i)));
    } catch {
      setError("Не понял запрос. Попробуй иначе.");
    } finally {
      setPending(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function saveHours(nextStart: string, nextEnd: string) {
    setStart(nextStart);
    setEnd(nextEnd);
    if (nextStart < nextEnd) {
      try {
        await updateDayHoursAction(nextStart, nextEnd);
      } catch {
        // non-blocking; hours persist on next valid change
      }
    }
  }

  async function addPlan() {
    if (!result) return;
    const slots = result.slots.filter((_, i) => selected.has(i));
    if (slots.length === 0) return;
    setAdding(true);
    try {
      await createPlanAction(slots, result.request.title, result.request.category);
      onClose();
    } catch {
      setError("Не удалось добавить");
      setAdding(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none";
  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#111] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">✨ Найти время</span>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2a2a] text-xs text-[#999]">✕</button>
        </div>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="зал 3 раза на неделе утром"
          className={`${inputCls} mb-3`}
        />

        <div className="mb-3 flex items-center gap-2 text-xs text-[#999]">
          <span>Активен</span>
          <input type="time" value={start} onChange={(e) => saveHours(e.target.value, end)} className="rounded-lg bg-[#1a1a1a] px-2 py-1 text-white outline-none" />
          <span>–</span>
          <input type="time" value={end} onChange={(e) => saveHours(start, e.target.value)} className="rounded-lg bg-[#1a1a1a] px-2 py-1 text-white outline-none" />
        </div>

        <button onClick={find} disabled={pending || !text.trim()} className="mb-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
          {pending ? "Ищу…" : "Найти"}
        </button>

        {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}

        {result && result.slots.length === 0 && (
          <p className="text-center text-xs text-[#777]">Свободных окон не нашёл — попробуй другой день или часы.</p>
        )}

        {result && result.slots.length > 0 && (
          <div className="flex flex-col gap-2">
            {result.request.count > result.slots.length && (
              <p className="text-xs text-amber-400">⚠️ нашёл только {result.slots.length} из {result.request.count}</p>
            )}
            {result.slots.map((slot, i) => {
              const on = selected.has(i);
              const day = formatInTimeZone(slot.starts_at, timezone, "EEE d MMM", { locale: ru });
              const s = formatInTimeZone(slot.starts_at, timezone, "HH:mm");
              const e = formatInTimeZone(slot.ends_at, timezone, "HH:mm");
              return (
                <button
                  key={slot.starts_at}
                  onClick={() => toggle(i)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-left"
                  style={{ background: on ? "#1a1a1a" : "#141414", opacity: on ? 1 : 0.5 }}
                >
                  <span className="text-base">{on ? "☑" : "☐"}</span>
                  <span className="text-lg">{categoryEmoji(result.request.category)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{result.request.title}</span>
                    <span className="block text-xs text-[#777]">{day} · {s}–{e}</span>
                  </span>
                </button>
              );
            })}
            <button onClick={addPlan} disabled={adding || selectedCount === 0} className="mt-2 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
              {adding ? "Добавляю…" : `Добавить план (${selectedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
