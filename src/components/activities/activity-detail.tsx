"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { ParticipantList } from "./participant-list";
import { ActivityForm } from "./activity-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { haptic } from "@/lib/haptics";
import { interestLabel } from "@/lib/profile/interests";
import { categoryColor, categoryForType } from "@/lib/activities/category";
import { joinActivityAction, leaveActivityAction, cancelActivityAction, reportActivityAction, blockUserAction } from "@/lib/activities/actions";
import type { Activity, ActivityButtonState, ParticipantView } from "@/lib/activities/types";

const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="skeleton h-44 w-full rounded-2xl" />,
});

const REASON: Record<string, string> = { full: "Мест нет", past: "Уже прошло", cancelled: "Отменена", missing: "Не найдено", blocked: "Недоступно" };

export function ActivityDetail({
  activity, participants, state, isHost, timezone,
}: {
  activity: Activity; participants: ParticipantView[]; state: ActivityButtonState; isHost: boolean; timezone: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const when = formatInTimeZone(activity.starts_at, timezone, "EEEE d MMMM, HH:mm", { locale: ru });

  function act(fn: () => Promise<unknown>) { start(async () => { await fn(); router.refresh(); }); }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8">
      <div>
        <p className="text-sm font-semibold text-muted">{interestLabel(activity.type)}</p>
        <h1 className="text-2xl font-bold text-foreground">{activity.title}</h1>
        <p className="mt-1 text-sm text-muted tabular-nums">{when}{activity.place ? ` · ${activity.place}` : ""}</p>
      </div>
      {activity.description && <p className="text-sm text-foreground">{activity.description}</p>}

      {activity.lat != null && activity.lng != null && (
        <LocationMap lat={activity.lat} lng={activity.lng} color={categoryColor(categoryForType(activity.type))} />
      )}

      <section className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Участники · {participants.length}{activity.capacity != null ? `/${activity.capacity}` : ""}</p>
        <ParticipantList participants={participants} />
      </section>

      {state === "join" && <button onClick={() => act(async () => { const r = await joinActivityAction(activity.id); if (!r.ok) { haptic.error(); setMsg(REASON[r.reason ?? ""] ?? "Не получилось"); } else { haptic.success(); } })} disabled={pending} className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition active:scale-[0.99] disabled:opacity-50">Иду</button>}
      {state === "joined" && <button onClick={() => act(async () => { haptic.impact(); await leaveActivityAction(activity.id); })} disabled={pending} className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition active:scale-[0.99]">Выйти</button>}
      {state === "full" && <p className="rounded-xl border border-border bg-card py-3 text-center text-sm text-muted">Мест нет</p>}
      {state === "past" && <p className="rounded-xl border border-border bg-card py-3 text-center text-sm text-muted">Уже прошло</p>}
      {state === "cancelled" && <p className="rounded-xl border border-border bg-card py-3 text-center text-sm text-danger">Отменена</p>}
      {isHost && state !== "cancelled" && <button onClick={() => { haptic.impact(); setEditOpen(true); }} disabled={pending} className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition active:scale-[0.99]">Редактировать</button>}
      {isHost && state !== "cancelled" && <button onClick={() => act(() => cancelActivityAction(activity.id))} disabled={pending} className="rounded-xl border border-danger/40 py-3 text-sm font-semibold text-danger">Отменить активность</button>}

      {!isHost && (
        <div className="flex gap-2">
          <button onClick={() => act(async () => { await reportActivityAction(activity.id, ""); setMsg("Жалоба отправлена"); })} className="flex-1 rounded-xl border border-border bg-card py-2 text-xs text-muted">Пожаловаться</button>
          <button onClick={() => act(async () => { await blockUserAction(activity.host_id); router.push("/activities"); })} className="flex-1 rounded-xl border border-border bg-card py-2 text-xs text-muted">Заблокировать хоста</button>
        </div>
      )}
      {msg && <p className="text-center text-xs text-muted">{msg}</p>}

      {editOpen && (
        <BottomSheet onClose={() => setEditOpen(false)}>
          <ActivityForm timezone={timezone} editing={activity} onClose={() => setEditOpen(false)} />
        </BottomSheet>
      )}
    </div>
  );
}
