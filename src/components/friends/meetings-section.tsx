"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { acceptMeeting, declineMeeting, getMeetingSlots, confirmMeeting } from "@/lib/meetings/actions";
import type { AwaitingPick, IncomingMeeting } from "@/lib/meetings/types";
import type { ProposedSlot } from "@/lib/advisor/types";

function fmt(slot: ProposedSlot): string {
  const d = new Date(slot.starts_at);
  const e = new Date(slot.ends_at);
  const date = d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  const t = (x: Date) => x.toTimeString().slice(0, 5);
  return `${date}, ${t(d)}–${t(e)}`;
}

export function MeetingsSection({
  incoming,
  awaiting,
}: {
  incoming: IncomingMeeting[];
  awaiting: AwaitingPick[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  const [slots, setSlots] = useState<ProposedSlot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  if (incoming.length === 0 && awaiting.length === 0) return null;

  function act(fn: () => Promise<void>) {
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Встречи</p>
      <div className="space-y-2">
        {incoming.map((m) => (
          <div key={m.proposal_id} className="rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <p className="text-sm text-white">{m.from_name}: «{m.title}»</p>
            <p className="mb-2 text-xs text-[#555]">{m.duration_min} мин · {m.window_from} – {m.window_to}</p>
            <div className="flex gap-2">
              <button disabled={pending} onClick={() => act(() => acceptMeeting(m.proposal_id))} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Принять</button>
              <button disabled={pending} onClick={() => act(() => declineMeeting(m.proposal_id))} className="rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-xs text-[#999] disabled:opacity-50">Отклонить</button>
            </div>
          </div>
        ))}

        {awaiting.map((m) => (
          <div key={m.proposal_id} className="rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <p className="text-sm text-white">«{m.title}» с {m.to_name}</p>
            <p className="mb-2 text-xs text-[#3a9f6a]">принято — выбери время</p>
            {slotsFor === m.proposal_id ? (
              <div className="space-y-1.5">
                {slots.map((s, i) => (
                  <button key={i} disabled={pending} onClick={() => pick(m.proposal_id, s)} className="block w-full rounded-lg bg-[#2a2a2a] px-3 py-2 text-left text-xs text-white disabled:opacity-50">
                    {fmt(s)}
                  </button>
                ))}
              </div>
            ) : (
              <button disabled={pending} onClick={() => loadSlots(m.proposal_id)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Выбрать время</button>
            )}
          </div>
        ))}
      </div>
      {msg && <p className="mt-2 text-xs text-[#999]">{msg}</p>}
    </section>
  );
}
