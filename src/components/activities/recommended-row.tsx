"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { SectionLabel } from "@/components/ui/section-label";
import type { ActivityMatch } from "@/lib/activities/match";

function Chip({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? "shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent"
          : "shrink-0 rounded-full bg-card-strong px-2 py-0.5 text-[10px] font-medium text-muted"
      }
    >
      {text}
    </span>
  );
}

export function RecommendedRow({
  recommended,
  interests,
  timezone,
}: {
  recommended: ActivityMatch[];
  interests: string[];
  timezone: string;
}) {
  // No interests yet → nudge to fill the profile (that's what powers matching).
  if (interests.length === 0) {
    return (
      <section className="mb-5">
        <SectionLabel>✨ Для тебя</SectionLabel>
        <Link
          href="/profile"
          className="mt-2 block rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-center transition active:scale-[0.99]"
        >
          <p className="text-sm font-semibold text-foreground">Добавь интересы в профиле</p>
          <p className="mt-0.5 text-xs text-muted">И мы соберём движ под твоё свободное время →</p>
        </Link>
      </section>
    );
  }

  // Interests set but nothing matched right now → stay quiet.
  if (recommended.length === 0) return null;

  return (
    <section className="mb-5">
      <SectionLabel>✨ Для тебя</SectionLabel>
      <p className="-mt-1 mb-2 text-xs text-muted">Свободные слоты под твои интересы</p>
      <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {recommended.map((m, i) => {
          const a = m.data.activity;
          const when = formatInTimeZone(a.starts_at, timezone, "EEE d MMM, HH:mm", { locale: ru });
          return (
            <Link
              key={a.id}
              href={`/activities/${a.id}`}
              style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
              className="animate-[fadeRise_220ms_ease-out] [animation-fill-mode:backwards] block w-[15rem] shrink-0 snap-start rounded-2xl border border-border bg-card p-4 transition active:scale-[0.98]"
            >
              <p className="line-clamp-1 text-sm font-bold text-foreground">{a.title}</p>
              <p className="mt-0.5 text-xs text-muted tabular-nums">{when}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.reasons.slice(0, 3).map((r, j) => (
                  <Chip key={j} text={r} accent={r.startsWith("🎯")} />
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
