import { formatInTimeZone } from "date-fns-tz";

import { interestLabel } from "@/lib/profile/interests";
import { isFull } from "./state";
import type { ActivityCardData } from "./types";

export interface ActivityMatch {
  data: ActivityCardData;
  score: number;
  reasons: string[]; // chips, e.g. ["🎯 Бег", "🟢 свободен", "⏱ через 2 дн"]
}

const HORIZON_DAYS = 7;
const SOON_MAX = 50;

function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function calendarDaysBetween(nowIso: string, startIso: string, tz: string): number {
  const a = formatInTimeZone(nowIso, tz, "yyyy-MM-dd");
  const b = formatInTimeZone(startIso, tz, "yyyy-MM-dd");
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

function relativeDay(days: number): string {
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
}

/**
 * Deterministic "for you" ranking of open activities the viewer is free for.
 * Pure — `nowIso` and `timezone` are passed in, no ambient clock.
 */
export function rankActivities(
  interests: string[],
  feed: ActivityCardData[],
  nowIso: string,
  opts: { limit?: number; timezone?: string } = {},
): ActivityMatch[] {
  const limit = opts.limit ?? 5;
  const tz = opts.timezone ?? "UTC";
  const interestSet = new Set(interests);
  const nowMs = new Date(nowIso).getTime();

  const matches: ActivityMatch[] = [];

  for (const d of feed) {
    const a = d.activity;
    // Eligibility — only suggest open, upcoming activities the viewer can join.
    if (d.isHost || d.isParticipant) continue;
    if (!d.isFree) continue;
    if (a.status !== "open") continue;
    if (new Date(a.starts_at).getTime() <= nowMs) continue;
    if (isFull(d.count, a.capacity)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Interest overlap — the strongest signal.
    if (interestSet.has(a.type)) {
      score += 100;
      reasons.push(`🎯 ${interestLabel(a.type)}`);
    }

    // Always free here (eligibility) — shown as reassurance, no extra points.
    reasons.push("🟢 свободен");

    // Sooner is better, linear decay across a one-week horizon.
    const days = calendarDaysBetween(nowIso, a.starts_at, tz);
    score += Math.max(0, SOON_MAX - Math.max(0, days) * (SOON_MAX / HORIZON_DAYS));
    reasons.push(`⏱ ${relativeDay(days)}`);

    // Open spots / open-ended capacity.
    if (a.capacity != null) {
      const left = a.capacity - d.count;
      score += 10;
      reasons.push(`👥 ${left} ${pluralRu(left, ["место", "места", "мест"])}`);
    } else {
      score += 5;
    }

    // A concrete place is a small plus.
    if (a.place) {
      score += 5;
      reasons.push(`📍 ${a.place}`);
    }

    matches.push({ data: d, score, reasons });
  }

  matches.sort(
    (x, y) =>
      y.score - x.score || x.data.activity.starts_at.localeCompare(y.data.activity.starts_at),
  );
  return matches.slice(0, limit);
}
