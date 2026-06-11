"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { interestLabel } from "@/lib/profile/interests";
import { getInitials } from "@/lib/utils";
import type { ActivityCardData } from "@/lib/activities/types";

export function ActivityCard({ data, timezone }: { data: ActivityCardData; timezone: string }) {
  const a = data.activity;
  const when = formatInTimeZone(a.starts_at, timezone, "EEE d MMM, HH:mm", { locale: ru });
  const cap = a.capacity != null ? `${data.count}/${a.capacity}` : `${data.count}`;
  return (
    <Link href={`/activities/${a.id}`} className="block rounded-2xl border border-border bg-card px-4 py-3 transition active:scale-[0.99]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{interestLabel(a.type)}</span>
        {data.isFree && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">✓ свободен</span>}
      </div>
      <p className="mt-0.5 text-sm font-bold text-foreground">{a.title}</p>
      <p className="text-xs text-muted tabular-nums">{when}{a.place ? ` · ${a.place}` : ""}</p>
      <div className="mt-2 flex items-center gap-2">
        {data.hostPhoto ? (
          <img src={data.hostPhoto} alt="" className="h-5 w-5 rounded-full object-cover" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card-strong text-[8px] font-semibold text-foreground">{getInitials(data.hostName)}</span>
        )}
        <span className="text-xs text-muted">{data.hostName} · {cap} идут</span>
      </div>
    </Link>
  );
}
