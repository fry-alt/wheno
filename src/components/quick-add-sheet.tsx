"use client";

import { useState } from "react";
import { format } from "date-fns";
import { createCalendarEventAction } from "@/lib/actions";

const ACTIVITY_TYPES = [
  { value: "gym", label: "🏋️ Зал" },
  { value: "run", label: "🏃 Пробежка" },
  { value: "dinner", label: "🍽️ Ужин" },
  { value: "coffee", label: "☕ Кофе" },
  { value: "meeting", label: "💼 Встреча" },
  { value: "work", label: "💻 Работа" },
  { value: "other", label: "📌 Другое" },
];

export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    await createCalendarEventAction({
      title: fd.get("title") as string,
      activity_type: fd.get("activity_type") as string,
      date: fd.get("date") as string,
      start_time: fd.get("start_time") as string,
      end_time: fd.get("end_time") as string,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#1a1a1a] p-6 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-5 text-base font-semibold text-white">Добавить событие</h3>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            required
            name="title"
            placeholder="Название"
            className="w-full rounded-xl bg-[#111] px-4 py-3 text-sm text-white placeholder-[#555] outline-none"
          />
          <select
            name="activity_type"
            defaultValue="other"
            className="w-full rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            required
            name="date"
            type="date"
            defaultValue={today}
            className="w-full rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
          />
          <div className="flex gap-3">
            <input
              required
              name="start_time"
              type="time"
              defaultValue="09:00"
              className="flex-1 rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
            />
            <input
              required
              name="end_time"
              type="time"
              defaultValue="10:00"
              className="flex-1 rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {pending ? "Добавляю..." : "Добавить"}
          </button>
        </form>
      </div>
    </div>
  );
}
