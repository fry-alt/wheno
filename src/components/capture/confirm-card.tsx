"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { createParsedEventAction } from "@/lib/events/actions";
import { categoryEmoji } from "@/lib/events/categories";
import type { ParsedEvent } from "@/lib/events/types";

function recurrenceLabel(r: NonNullable<ParsedEvent["recurrence"]>): string {
  if (r.freq === "daily") return "каждый день";
  if (r.freq === "monthly") return "каждый месяц";
  if (r.freq === "yearly") return "каждый год";
  const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  return r.weekdays && r.weekdays.length > 0 ? `по ${r.weekdays.map((n) => names[n - 1]).join(" ")}` : "каждую неделю";
}

export function ConfirmCard({
  parsed,
  timezone,
  onConfirmed,
  onEdit,
  onCancel,
}: {
  parsed: ParsedEvent;
  timezone: string;
  onConfirmed: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = formatInTimeZone(parsed.starts_at, timezone, "d MMMM, EEE", { locale: ru });
  const start = formatInTimeZone(parsed.starts_at, timezone, "HH:mm");
  const end = formatInTimeZone(parsed.ends_at, timezone, "HH:mm");

  async function confirm() {
    setError(null);
    setPending(true);
    try {
      await createParsedEventAction(parsed);
      onConfirmed();
    } catch {
      setError("Не удалось добавить");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-[#1a1a1a] p-4">
        <p className="text-base font-semibold text-white">{categoryEmoji(parsed.category)} {parsed.title}</p>
        <p className="mt-1 text-sm text-[#999]">{day}, {start}–{end} · {parsed.is_fixed ? "фиксированное" : "гибкое"}</p>
        {parsed.recurrence && (
          <p className="mt-1 text-xs text-[#3b82f6]">🔁 {recurrenceLabel(parsed.recurrence)}</p>
        )}
      </div>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={confirm} disabled={pending} className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
          {pending ? "…" : "✅ Добавить"}
        </button>
        <button onClick={onEdit} className="rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white">✏️</button>
        <button onClick={onCancel} className="rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-[#999]">✕</button>
      </div>
    </div>
  );
}
