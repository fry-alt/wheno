"use client";

import { useState } from "react";
import { clsx } from "clsx";

import { ActivityCard } from "./activity-card";
import { ActivityForm } from "./activity-form";
import { RecommendedRow } from "./recommended-row";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { ActivityCardData } from "@/lib/activities/types";
import type { ActivityMatch } from "@/lib/activities/match";

export function ActivitiesScreen({
  feed, mine, recommended, interests, timezone,
}: {
  feed: ActivityCardData[]; mine: ActivityCardData[];
  recommended: ActivityMatch[]; interests: string[]; timezone: string;
}) {
  const [tab, setTab] = useState<"feed" | "mine">("feed");
  const [creating, setCreating] = useState(false);
  const list = tab === "feed" ? feed : mine;

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="mb-4 flex gap-2">
        {(["feed", "mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("rounded-full px-4 py-1.5 text-sm font-semibold transition", tab === t ? "bg-card-strong text-foreground" : "text-muted")}>
            {t === "feed" ? "Лента" : "Мои"}
          </button>
        ))}
      </div>

      {tab === "feed" && (
        <RecommendedRow recommended={recommended} interests={interests} timezone={timezone} />
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">{tab === "feed" ? "Пока нет активностей" : "Ты ещё никуда не идёшь"}</p>
          <p className="mt-1 text-xs text-muted">Создай первую — нажми ➕</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((d) => <ActivityCard key={d.activity.id} data={d} timezone={timezone} />)}
        </div>
      )}

      <button onClick={() => setCreating(true)} className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground shadow-lg transition active:scale-95" aria-label="Создать">＋</button>

      {creating && (
        <BottomSheet onClose={() => setCreating(false)}>
          <ActivityForm onClose={() => setCreating(false)} />
        </BottomSheet>
      )}
    </div>
  );
}
