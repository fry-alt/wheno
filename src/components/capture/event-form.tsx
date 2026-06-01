"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { createEventAction, updateEventAction, deleteEventAction, type EventFormInput } from "@/lib/events/actions";
import { CATEGORIES, CATEGORY_DEFAULT_FIXED, CATEGORY_EMOJI, CATEGORY_LABEL_RU } from "@/lib/events/categories";
import type { CalendarEvent, Category } from "@/lib/events/types";

export function EventForm({
  timezone,
  initialDate,
  editing,
  onDone,
}: {
  timezone: string;
  initialDate: string;
  editing?: CalendarEvent | null;
  onDone: () => void;
}) {
  const editStart = editing ? formatInTimeZone(editing.starts_at, timezone, "HH:mm") : "09:00";
  const editEnd = editing ? formatInTimeZone(editing.ends_at, timezone, "HH:mm") : "10:00";
  const editDate = editing ? formatInTimeZone(editing.starts_at, timezone, "yyyy-MM-dd") : initialDate;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState<Category>((editing?.category as Category) ?? "gym");
  const [date, setDate] = useState(editDate);
  const [startTime, setStartTime] = useState(editStart);
  const [endTime, setEndTime] = useState(editEnd);
  const [isFixed, setIsFixed] = useState(editing?.is_fixed ?? CATEGORY_DEFAULT_FIXED.gym);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickCategory(c: Category) {
    setCategory(c);
    if (!editing) setIsFixed(CATEGORY_DEFAULT_FIXED[c]);
  }

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Введи название");
    if (endTime <= startTime) return setError("Конец должен быть позже начала");
    const input: EventFormInput = { title, category, date, start_time: startTime, end_time: endTime, is_fixed: isFixed, notes };
    setPending(true);
    try {
      if (editing) await updateEventAction(editing.id, input);
      else await createEventAction(input);
      onDone();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setPending(true);
    try {
      await deleteEventAction(editing.id);
      onDone();
    } catch {
      setError("Не удалось удалить");
    } finally {
      setPending(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none";

  return (
    <div className="flex flex-col gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" className={inputCls} />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => pickCategory(c)}
            className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: category === c ? "#fff" : "#1a1a1a", color: category === c ? "#000" : "#888" }}
          >
            {CATEGORY_EMOJI[c]} {CATEGORY_LABEL_RU[c]}
          </button>
        ))}
      </div>

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      <div className="flex gap-3">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} flex-1`} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputCls} flex-1`} />
      </div>

      <button
        onClick={() => setIsFixed((v) => !v)}
        className="flex items-center justify-between rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white"
      >
        <span>{isFixed ? "Фиксированное" : "Гибкое"}</span>
        <span className="text-xs text-[#777]">{isFixed ? "нельзя двигать" : "ИИ может подвинуть"}</span>
      </button>

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Примечание" rows={2} className={inputCls} />

      {error && <p className="text-center text-xs text-red-400">{error}</p>}

      <button onClick={submit} disabled={pending} className="rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
        {pending ? "Сохраняю…" : editing ? "Сохранить" : "Добавить"}
      </button>
      {editing && (
        <button onClick={remove} disabled={pending} className="rounded-xl bg-[#1a1a1a] py-3 text-sm font-semibold text-red-400 disabled:opacity-50">
          Удалить
        </button>
      )}
    </div>
  );
}
