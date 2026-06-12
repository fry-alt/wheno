"use client";

import { useState } from "react";
import { clsx } from "clsx";
import dynamic from "next/dynamic";

import { ActivityCard } from "./activity-card";
import { ActivityForm } from "./activity-form";
import { RecommendedRow } from "./recommended-row";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Segmented } from "@/components/ui/segmented";
import { haptic } from "@/lib/haptics";
import { ACTIVITY_CATEGORIES, categoryColor, matchesCategories, type CategoryKey } from "@/lib/activities/category";
import { withinRadius, type LatLng } from "@/lib/activities/geo";
import type { Activity, ActivityCardData } from "@/lib/activities/types";
import type { ActivityMatch } from "@/lib/activities/match";

const ActivityMap = dynamic(() => import("./activity-map").then((m) => m.ActivityMap), {
  ssr: false,
  loading: () => <div className="skeleton h-[60vh] w-full rounded-2xl" />,
});

export function ActivitiesScreen({
  feed, mine, recommended, interests, timezone,
}: {
  feed: ActivityCardData[]; mine: ActivityCardData[];
  recommended: ActivityMatch[]; interests: string[]; timezone: string;
}) {
  const [tab, setTab] = useState<"feed" | "mine">("feed");
  const [view, setView] = useState<"list" | "map">("list");
  const [cats, setCats] = useState<CategoryKey[]>([]);
  const [creating, setCreating] = useState(false);
  const [near, setNear] = useState<LatLng | null>(null); // active "near me" centre

  const RADIUS_KM = 5;
  function nearOk(a: Activity): boolean {
    if (!near) return true;
    return a.lat != null && a.lng != null && withinRadius(near, { lat: a.lat, lng: a.lng }, RADIUS_KM);
  }

  const list = (tab === "feed" ? feed : mine).filter((d) => matchesCategories(d.activity.type, cats) && nearOk(d.activity));
  const recs = recommended.filter((m) => matchesCategories(m.data.activity.type, cats) && nearOk(m.data.activity));

  function toggleCat(key: CategoryKey) {
    haptic.selection();
    setCats((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleNear() {
    if (near) { setNear(null); return; }
    haptic.selection();
    navigator.geolocation?.getCurrentPosition(
      (pos) => setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* permission denied — stay off */ },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <h1 className="mb-3 text-2xl font-bold text-foreground">События</h1>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["feed", "mine"] as const).map((t) => (
            <button key={t} onClick={() => { haptic.selection(); setTab(t); }}
              className={clsx("rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95", tab === t ? "bg-card-strong text-foreground" : "text-muted")}>
              {t === "feed" ? "Лента" : "Мои"}
            </button>
          ))}
        </div>
        {tab === "feed" && (
          <Segmented
            options={[{ value: "list", label: "Список" }, { value: "map", label: "Карта" }]}
            value={view}
            onChange={setView}
          />
        )}
      </div>

      {tab === "feed" && (
        <div className="hide-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <button
            onClick={toggleNear}
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95",
              near ? "border-accent bg-accent-soft text-accent" : "border-border text-muted",
            )}
          >
            📍 Рядом
          </button>
          {ACTIVITY_CATEGORIES.map((c) => {
            const active = cats.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCat(c.key)}
                style={active ? { borderColor: categoryColor(c.key), color: categoryColor(c.key) } : undefined}
                className={clsx(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95",
                  active ? "bg-card-strong" : "border-border text-muted",
                )}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
      )}

      {tab === "feed" && view === "map" ? (
        <>
          <ActivityMap items={list} timezone={timezone} />
          {list.every((d) => d.activity.lat == null || d.activity.lng == null) && (
            <p className="mt-3 text-center text-xs text-muted">Пока никто не указал место на карте</p>
          )}
        </>
      ) : (
        <>
          {tab === "feed" && <RecommendedRow recommended={recs} interests={interests} timezone={timezone} />}

          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">{tab === "feed" ? "Пока нет событий" : "Ты ещё никуда не идёшь"}</p>
              <p className="mt-1 text-xs text-muted">{cats.length > 0 ? "Сбрось фильтры или создай своё — ➕" : "Создай первое — нажми ➕"}</p>
            </div>
          ) : (
            <div key={`${tab}-${cats.join(",")}`} className="flex flex-col gap-2">
              {list.map((d, i) => (
                <div
                  key={d.activity.id}
                  className="animate-[fadeRise_220ms_ease-out] [animation-fill-mode:backwards]"
                  style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                >
                  <ActivityCard data={d} timezone={timezone} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button onClick={() => { haptic.impact(); setCreating(true); }} className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground shadow-lg transition active:scale-95" aria-label="Создать">＋</button>

      {creating && (
        <BottomSheet onClose={() => setCreating(false)}>
          <ActivityForm timezone={timezone} onClose={() => setCreating(false)} />
        </BottomSheet>
      )}
    </div>
  );
}
