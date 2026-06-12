"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { acceptMeeting, declineMeeting, getMeetingSlots, confirmMeeting } from "@/lib/meetings/actions";
import type { AwaitingPick, IncomingMeeting } from "@/lib/meetings/types";
import type { ProposedSlot } from "@/lib/advisor/types";

// Render slot times in the user's app timezone, not the browser's.
function fmt(slot: ProposedSlot, timezone: string): string {
  const date = formatInTimeZone(slot.starts_at, timezone, "EEE, d MMM", { locale: ru });
  const from = formatInTimeZone(slot.starts_at, timezone, "HH:mm");
  const to = formatInTimeZone(slot.ends_at, timezone, "HH:mm");
  return `${date}, ${from}–${to}`;
}

export function MeetingsSection({
  incoming,
  awaiting,
  timezone,
}: {
  incoming: IncomingMeeting[];
  awaiting: AwaitingPick[];
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  const [slots, setSlots] = useState<ProposedSlot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  if (incoming.length === 0 && awaiting.length === 0) return null;

  function act(fn: () => Promise<void>) {
    setMsg(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  function loadSlots(proposalId: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        const result = await getMeetingSlots(proposalId);
        setSlots(result);
        setSlotsFor(proposalId);
        if (result.length === 0) setMsg("Нет общих свободных окон — измените период");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  function pick(proposalId: string, slot: ProposedSlot) {
    setMsg(null);
    startTransition(async () => {
      try {
        await confirmMeeting(proposalId, slot);
        setSlotsFor(null);
        setSlots([]);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  return (
    <section className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Встречи</p>
      <div className="space-y-2">
        {incoming.map((m) => (
          <div key={m.proposal_id} className="rounded-xl bg-card px-3 py-2.5">
            <p className="text-sm text-foreground">{m.from_name}: «{m.title}»</p>
            <p className="mb-2 text-xs text-muted">{m.duration_min} мин · {m.window_from} – {m.window_to}</p>
            <div className="flex gap-2">
              <button disabled={pending} onClick={() => act(() => acceptMeeting(m.proposal_id))} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50">Принять</button>
              <button disabled={pending} onClick={() => act(() => declineMeeting(m.proposal_id))} className="rounded-lg bg-card-strong px-3 py-1.5 text-xs text-muted disabled:opacity-50">Отклонить</button>
            </div>
          </div>
        ))}

        {awaiting.map((m) => (
          <div key={m.proposal_id} className="rounded-xl bg-card px-3 py-2.5">
            <p className="text-sm text-foreground">«{m.title}» с {m.to_name}</p>
            <p className="mb-2 text-xs text-success">принято — выбери время</p>
            {slotsFor === m.proposal_id ? (
              <div className="space-y-1.5">
                {slots.map((s) => (
                  <button key={s.starts_at} disabled={pending} onClick={() => pick(m.proposal_id, s)} className="block w-full rounded-lg bg-card-strong px-3 py-2 text-left text-xs text-foreground disabled:opacity-50">
                    {fmt(s, timezone)}
                  </button>
                ))}
              </div>
            ) : (
              <button disabled={pending} onClick={() => loadSlots(m.proposal_id)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50">Выбрать время</button>
            )}
          </div>
        ))}
      </div>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </section>
  );
}
