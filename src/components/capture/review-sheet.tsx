"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { useRouter } from "next/navigation";

import { categoryEmoji } from "@/lib/events/categories";
import { applyVoicePlanAction } from "@/lib/events/voice-actions";
import type { VoiceAction } from "@/lib/events/voice-plan-types";

function when(iso: string, tz: string) {
  return formatInTimeZone(iso, tz, "EEE d MMM, HH:mm", { locale: ru });
}
function scopeLabel(a: { recurring: boolean; scope: "one" | "all" }) {
  if (!a.recurring) return "";
  return a.scope === "all" ? " · вся серия" : " · только это";
}

export function ReviewSheet({
  actions,
  timezone,
  onClose,
}: {
  actions: VoiceAction[];
  timezone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(() => actions.map(() => true));
  const [applying, setApplying] = useState(false);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  async function apply() {
    const selected = actions.filter((_, i) => checked[i]);
    if (selected.length === 0) return;
    setApplying(true);
    try {
      await applyVoicePlanAction(selected);
      router.refresh();
      onClose();
    } catch {
      setApplying(false);
    }
  }

  const count = checked.filter(Boolean).length;

  const groups: { key: VoiceAction["type"]; label: string }[] = [
    { key: "create", label: "➕ Создать" },
    { key: "edit", label: "✏️ Изменить" },
    { key: "delete", label: "🗑 Удалить" },
    { key: "note", label: "📌 Заметка" },
  ];

  function rowText(a: VoiceAction): string {
    if (a.type === "create") return `${categoryEmoji(a.event.category)} ${a.event.title} · ${when(a.event.starts_at, timezone)}`;
    if (a.type === "edit") return `${categoryEmoji(a.event.category)} ${a.targetTitle} → ${when(a.event.starts_at, timezone)}${scopeLabel(a)}`;
    if (a.type === "delete") return `${a.targetTitle}${scopeLabel(a)}`;
    return `${a.date} · «${a.text}»`;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Вот что я понял · {actions.length}</p>

      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
        {groups.map((g) => {
          const items = actions.map((a, i) => ({ a, i })).filter(({ a }) => a.type === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{g.label}</p>
              <div className="flex flex-col gap-1.5">
                {items.map(({ a, i }) => (
                  <button
                    key={i}
                    onClick={() => toggle(i)}
                    className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
                    style={{ opacity: checked[i] ? 1 : 0.45 }}
                  >
                    <span className="text-base">{checked[i] ? "☑" : "☐"}</span>
                    <span className="min-w-0 flex-1 text-sm text-foreground">{rowText(a)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted">Отмена</button>
        <button onClick={apply} disabled={applying || count === 0} className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          {applying ? "Применяю…" : `Применить (${count})`}
        </button>
      </div>
    </div>
  );
}
