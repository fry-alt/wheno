"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { sendFriendRequestById } from "@/lib/friends/actions";
import { haptic } from "@/lib/haptics";

export function AddFriendButton({ targetId, initialPending }: { targetId: string; initialPending: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(initialPending);

  if (sent) {
    return (
      <p className="rounded-xl border border-border bg-card py-3 text-center text-sm text-muted">
        Заявка отправлена
      </p>
    );
  }

  function add() {
    haptic.impact();
    start(async () => {
      const r = await sendFriendRequestById(targetId);
      if (r.ok || r.reason === "exists") { haptic.success(); setSent(true); }
      else haptic.error();
      router.refresh();
    });
  }

  return (
    <button
      onClick={add}
      disabled={pending}
      className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition active:scale-[0.99] disabled:opacity-50"
    >
      Добавить в друзья
    </button>
  );
}
