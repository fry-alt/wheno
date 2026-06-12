"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { INTEREST_TAGS } from "@/lib/profile/interests";
import { haptic } from "@/lib/haptics";
import { createActivityAction } from "@/lib/activities/actions";
import type { Visibility } from "@/lib/activities/types";
import type { LatLng } from "./location-picker";

const LocationPicker = dynamic(() => import("./location-picker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="skeleton h-56 w-full rounded-xl" />,
});

export function ActivityForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("running");
  const [place, setPlace] = useState("");
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [capacity, setCapacity] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [error, setError] = useState<string | null>(null);

  const inputCls = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none";

  function submit() {
    if (!title.trim() || !date) { setError("Заполни название и дату"); return; }
    start(async () => {
      const res = await createActivityAction({
        title, type, place, description, date, startTime, endTime,
        lat: loc?.lat ?? null, lng: loc?.lng ?? null,
        capacity: capacity ? Number(capacity) : null, visibility,
      });
      if (!res.ok || !res.id) { haptic.error(); setError("Не получилось"); return; }
      haptic.success();
      router.push(`/activities/${res.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Новая активность</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название (теннис на корте)" className={inputCls} />
      <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
        {INTEREST_TAGS.map((t) => <option key={t.slug} value={t.slug}>{t.emoji} {t.label}</option>)}
      </select>
      <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Место (адрес или название)" className={inputCls} />
      <LocationPicker value={loc} onChange={setLoc} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание (необязательно)" rows={2} className={inputCls} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      <div className="flex gap-2">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} flex-1`} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputCls} flex-1`} />
      </div>
      <div className="flex gap-2">
        <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Лимит (опц.)" className={`${inputCls} flex-1`} />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={`${inputCls} flex-1`}>
          <option value="public">Открытая</option>
          <option value="friends">Только друзья</option>
        </select>
      </div>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted">Отмена</button>
        <button onClick={submit} disabled={pending} className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          {pending ? "Создаю…" : "Создать"}
        </button>
      </div>
    </div>
  );
}
