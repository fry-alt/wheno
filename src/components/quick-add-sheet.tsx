// src/components/quick-add-sheet.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { createCalendarEventAction } from "@/lib/actions";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const ACTIVITY_CHIPS = [
  { value: "gym", label: "🏋️ Зал" },
  { value: "run", label: "🏃 Бег" },
  { value: "dinner", label: "🍽️ Ужин" },
  { value: "coffee", label: "☕ Кофе" },
  { value: "meeting", label: "💼 Встреча" },
  { value: "work", label: "💻 Работа" },
  { value: "other", label: "📌 Другое" },
];

function DrumPicker({
  values,
  defaultIndex,
  onChange,
}: {
  values: string[];
  defaultIndex: number;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = defaultIndex * 40;
    }
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function commit() {
      if (!el) return;
      const idx = Math.round(el.scrollTop / 40);
      onChange(values[Math.max(0, Math.min(idx, values.length - 1))]);
    }

    // Use scrollend when available (modern browsers / iOS 17+)
    if ("onscrollend" in (el as EventTarget)) {
      el.addEventListener("scrollend", commit);
      return () => el.removeEventListener("scrollend", commit);
    }

    // Fallback: 300ms debounce on scroll (safer than 80ms for iOS momentum)
    function handleScrollFallback() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(commit, 300);
    }
    el.addEventListener("scroll", handleScrollFallback);
    return () => el.removeEventListener("scroll", handleScrollFallback);
  }, [onChange, values]);

  return (
    <div className="relative w-14">
      {/* Center highlight ring */}
      <div
        className="pointer-events-none absolute left-0 right-0 rounded-lg border border-[#3a3a3a]"
        style={{ top: 40, height: 40, zIndex: 2 }}
      />
      {/* Top fade */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: 0,
          height: 44,
          background: "linear-gradient(to bottom, #111 40%, transparent)",
          zIndex: 2,
        }}
      />
      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          bottom: 0,
          height: 44,
          background: "linear-gradient(to top, #111 40%, transparent)",
          zIndex: 2,
        }}
      />
      {/* Scrollable column */}
      <div
        ref={ref}
        className="scrollbar-hide"
        style={{
          height: 120,
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ height: 40 }} />
        {values.map((v) => (
          <div
            key={v}
            style={{
              height: 40,
              scrollSnapAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="text-xl font-bold text-white">{v}</span>
          </div>
        ))}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

export function QuickAddSheet({
  date,
  onClose,
  timezone,
}: {
  date: string;
  onClose: () => void;
  timezone: string;
}) {
  const [activeChip, setActiveChip] = useState("gym");
  const [title, setTitle] = useState("");
  const [startH, setStartH] = useState("07");
  const [startM, setStartM] = useState("00");
  const [endH, setEndH] = useState("08");
  const [endM, setEndM] = useState("00");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayDate = formatInTimeZone(parseISO(date), timezone, "d MMMM, EEE", { locale: ru });
  const buttonLabel = `Добавить ${startH}:${startM} – ${endH}:${endM}`;

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("Введи название");
      return;
    }
    const startVal = parseInt(startH) * 60 + parseInt(startM);
    const endVal = parseInt(endH) * 60 + parseInt(endM);
    if (endVal <= startVal) {
      setError("Конец должен быть позже начала");
      return;
    }
    setPending(true);
    try {
      await createCalendarEventAction({
        title: title.trim(),
        activity_type: activeChip,
        date,
        start_time: `${startH}:${startM}`,
        end_time: `${endH}:${endM}`,
      });
      onClose();
    } catch {
      setError("Не удалось сохранить. Попробуй ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#111] p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#999]">{displayDate}</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2a2a] text-xs text-[#999]"
          >
            ✕
          </button>
        </div>

        {/* Activity chips */}
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {ACTIVITY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setActiveChip(chip.value)}
              className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: activeChip === chip.value ? "#fff" : "#1a1a1a",
                color: activeChip === chip.value ? "#000" : "#888",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className="mb-5 w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none"
        />

        {/* Time pickers */}
        <div className="mb-2 flex items-start gap-4">
          {/* Start */}
          <div className="flex-1">
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#555]">
              Начало
            </p>
            <div className="flex items-center justify-center gap-1">
              <DrumPicker
                values={HOURS}
                defaultIndex={7}
                onChange={setStartH}
              />
              <span className="mb-1 text-xl font-bold text-[#555]">:</span>
              <DrumPicker
                values={MINUTES}
                defaultIndex={0}
                onChange={setStartM}
              />
            </div>
          </div>

          {/* Separator */}
          <div className="mt-10 text-lg font-light text-[#333]">—</div>

          {/* End */}
          <div className="flex-1">
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#555]">
              Конец
            </p>
            <div className="flex items-center justify-center gap-1">
              <DrumPicker
                values={HOURS}
                defaultIndex={8}
                onChange={setEndH}
              />
              <span className="mb-1 text-xl font-bold text-[#555]">:</span>
              <DrumPicker
                values={MINUTES}
                defaultIndex={0}
                onChange={setEndM}
              />
            </div>
          </div>
        </div>

        {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={pending}
          className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {pending ? "Добавляю..." : buttonLabel}
        </button>
      </div>
    </div>
  );
}
