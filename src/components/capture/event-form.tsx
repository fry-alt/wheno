"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
  editOccurrenceAction,
  updateSeriesAction,
  deleteOccurrenceAction,
  deleteSeriesAction,
  type EventFormInput,
} from "@/lib/events/actions";
import { CATEGORIES, CATEGORY_DEFAULT_FIXED, CATEGORY_EMOJI, CATEGORY_LABEL_RU } from "@/lib/events/categories";
import type { CalendarEvent, Category, ParsedEvent, Recurrence } from "@/lib/events/types";

type Freq = "none" | "daily" | "weekly" | "monthly" | "yearly";
const WEEKDAYS: { n: number; label: string }[] = [
  { n: 1, label: "Пн" }, { n: 2, label: "Вт" }, { n: 3, label: "Ср" }, { n: 4, label: "Чт" },
  { n: 5, label: "Пт" }, { n: 6, label: "Сб" }, { n: 7, label: "Вс" },
];

export interface RecurringEdit {
  seriesId: string;
  occurrenceDate: string;
  scope: "one" | "all";
}

export function EventForm({
  timezone,
  initialDate,
  editing,
  prefill,
  recurringEdit,
  onDone,
}: {
  timezone: string;
  initialDate: string;
  editing?: CalendarEvent | null;
  prefill?: ParsedEvent | null;
  recurringEdit?: RecurringEdit | null;
  onDone: () => void;
}) {
  const source = editing ?? prefill ?? null;
  const srcStart = source ? formatInTimeZone(source.starts_at, timezone, "HH:mm") : "09:00";
  const srcEnd = source ? formatInTimeZone(source.ends_at, timezone, "HH:mm") : "10:00";
  const srcDate = source ? formatInTimeZone(source.starts_at, timezone, "yyyy-MM-dd") : initialDate;

  const seriesRec = recurringEdit?.scope === "all" ? source?.recurrence ?? null : null;

  const [title, setTitle] = useState(source?.title ?? "");
  const [category, setCategory] = useState<Category>((source?.category as Category) ?? "gym");
  const [date, setDate] = useState(srcDate);
  const [startTime, setStartTime] = useState(srcStart);
  const [endTime, setEndTime] = useState(srcEnd);
  const [isFixed, setIsFixed] = useState(source?.is_fixed ?? CATEGORY_DEFAULT_FIXED.gym);
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [freq, setFreq] = useState<Freq>(seriesRec?.freq ?? "none");
  const [weekdays, setWeekdays] = useState<number[]>(seriesRec?.weekdays ?? []);
  const [until, setUntil] = useState<string>(seriesRec?.until ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showRecurrence = !recurringEdit || recurringEdit.scope === "all";

  function pickCategory(c: Category) {
    setCategory(c);
    if (!editing) setIsFixed(CATEGORY_DEFAULT_FIXED[c]);
  }

  function toggleWeekday(n: number) {
    setWeekdays((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));
  }

  function buildRecurrence(): Recurrence | null {
    if (!showRecurrence || freq === "none") return null;
    return {
      freq,
      weekdays: freq === "weekly" ? (weekdays.length > 0 ? weekdays : null) : null,
      until: until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null,
      count: null,
    };
  }

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Введи название");
    if (endTime <= startTime) return setError("Конец должен быть позже начала");
    const input: EventFormInput = {
      title, category, date, start_time: startTime, end_time: endTime,
      is_fixed: isFixed, notes, recurrence: buildRecurrence(),
    };
    setPending(true);
    try {
      if (recurringEdit?.scope === "all") await updateSeriesAction(recurringEdit.seriesId, input);
      else if (recurringEdit?.scope === "one") await editOccurrenceAction(recurringEdit.seriesId, recurringEdit.occurrenceDate, input);
      else if (editing) await updateEventAction(editing.id, input);
      else await createEventAction(input);
      onDone();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      if (recurringEdit?.scope === "all") await deleteSeriesAction(recurringEdit.seriesId);
      else if (recurringEdit?.scope === "one") await deleteOccurrenceAction(recurringEdit.seriesId, recurringEdit.occurrenceDate);
      else if (editing) await deleteEventAction(editing.id);
      onDone();
    } catch {
      setError("Не удалось удалить");
    } finally {
      setPending(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted outline-none";
  const canDelete = Boolean(editing) || Boolean(recurringEdit);
  const freqOptions: { v: Freq; label: string }[] = [
    { v: "none", label: "Нет" }, { v: "daily", label: "Каждый день" }, { v: "weekly", label: "По дням недели" },
    { v: "monthly", label: "Каждый месяц" }, { v: "yearly", label: "Каждый год" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" className={inputCls} />

      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => pickCategory(c)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === c ? "bg-accent text-accent-foreground" : "bg-card text-muted"}`}>
            {CATEGORY_EMOJI[c]} {CATEGORY_LABEL_RU[c]}
          </button>
        ))}
      </div>

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      <div className="flex gap-3">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} flex-1`} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputCls} flex-1`} />
      </div>

      <button onClick={() => setIsFixed((v) => !v)} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
        <span>{isFixed ? "Фиксированное" : "Гибкое"}</span>
        <span className="text-xs text-muted">{isFixed ? "нельзя двигать" : "ИИ может подвинуть"}</span>
      </button>

      {showRecurrence && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="flex-shrink-0 text-xs text-muted">Повторять</span>
            {freqOptions.map((o) => (
              <button key={o.v} onClick={() => setFreq(o.v)}
                className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${freq === o.v ? "bg-accent text-accent-foreground" : "bg-card-muted text-muted"}`}>
                {o.label}
              </button>
            ))}
          </div>
          {freq === "weekly" && (
            <div className="flex gap-1">
              {WEEKDAYS.map((w) => (
                <button key={w.n} onClick={() => toggleWeekday(w.n)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${weekdays.includes(w.n) ? "bg-accent text-accent-foreground" : "bg-card-muted text-muted"}`}>
                  {w.label}
                </button>
              ))}
            </div>
          )}
          {freq !== "none" && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>До</span>
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-lg border border-border bg-card-muted px-2 py-1 text-foreground outline-none" />
              {until && <button onClick={() => setUntil("")} className="text-muted underline">сбросить</button>}
            </div>
          )}
        </div>
      )}

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Примечание" rows={2} className={inputCls} />

      {error && <p className="text-center text-xs text-danger">{error}</p>}

      <button onClick={submit} disabled={pending} className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition active:scale-[0.99] disabled:opacity-50">
        {pending ? "Сохраняю…" : editing || recurringEdit ? "Сохранить" : "Добавить"}
      </button>
      {canDelete && (
        <button onClick={remove} disabled={pending} className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-danger disabled:opacity-50">
          Удалить
        </button>
      )}
    </div>
  );
}
