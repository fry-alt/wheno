import { isCategory } from "./categories";
import type { ParsedEvent, Recurrence } from "./types";
import type { EventContextItem, TargetScope, VoiceAction } from "./voice-plan-types";

interface NormalizeCtx {
  events: EventContextItem[];
  today: string;
  timezone: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== "string") return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function normalizeRecurrence(a: Record<string, unknown>): Recurrence | null {
  const freq = a.recur_freq;
  if (freq !== "daily" && freq !== "weekly" && freq !== "monthly" && freq !== "yearly") return null;
  const weekdays =
    freq === "weekly" && Array.isArray(a.recur_weekdays)
      ? (a.recur_weekdays as unknown[]).filter((n): n is number => typeof n === "number")
      : [];
  const until = typeof a.recur_until === "string" && DATE_RE.test(a.recur_until) ? a.recur_until : null;
  const count = typeof a.recur_count === "number" && a.recur_count > 0 ? Math.round(a.recur_count) : null;
  return { freq, weekdays: weekdays.length > 0 ? weekdays : null, until, count };
}

function toParsedEvent(a: Record<string, unknown>): ParsedEvent | null {
  const title = typeof a.title === "string" ? a.title.trim() : "";
  if (!title) return null;
  const starts_at = toIso(a.starts_at);
  if (!starts_at) return null;
  const ends_at = toIso(a.ends_at, new Date(new Date(starts_at).getTime() + 3_600_000).toISOString())!;
  const category = typeof a.category === "string" && isCategory(a.category) ? a.category : "other";
  return {
    title,
    category,
    starts_at,
    ends_at,
    is_fixed: Boolean(a.is_fixed),
    notes: typeof a.notes === "string" ? a.notes : null,
    recurrence: normalizeRecurrence(a),
  };
}

export function normalizeVoicePlan(raw: unknown, ctx: NormalizeCtx): VoiceAction[] {
  if (!Array.isArray(raw)) return [];
  const out: VoiceAction[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as Record<string, unknown>;

    if (a.type === "create") {
      const event = toParsedEvent(a);
      if (event) out.push({ type: "create", event });
      continue;
    }
    if (a.type === "note") {
      const date = typeof a.note_date === "string" && DATE_RE.test(a.note_date) ? a.note_date : null;
      const text = typeof a.note_text === "string" ? a.note_text.trim() : "";
      if (date && text) out.push({ type: "note", date, text });
      continue;
    }
    if (a.type === "edit" || a.type === "delete") {
      const targetId = typeof a.target_id === "string" ? a.target_id : "";
      const target = ctx.events.find((e) => e.id === targetId);
      if (!target) continue;
      const recurring = target.recurring;
      let scope: TargetScope = a.target_scope === "all" ? "all" : "one";
      let targetDate: string | null = null;
      if (recurring && scope === "one") {
        targetDate = typeof a.target_date === "string" && DATE_RE.test(a.target_date) ? a.target_date : target.date;
      }
      if (!recurring) scope = "all";

      if (a.type === "edit") {
        const event = toParsedEvent(a);
        if (!event) continue;
        out.push({ type: "edit", targetId, recurring, scope, targetDate, targetTitle: target.title, event });
      } else {
        out.push({ type: "delete", targetId, recurring, scope, targetDate, targetTitle: target.title });
      }
    }
  }

  return out;
}
