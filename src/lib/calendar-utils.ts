import type { CalendarEvent } from "./types";

export type ActivityGroup = "sport" | "social" | "work";
export type FilterTab = "all" | "sport" | "social" | "work";

export const ACTIVITY_GROUPS: Record<string, ActivityGroup> = {
  gym: "sport", run: "sport", swim: "sport", tennis: "sport",
  cycling: "sport", yoga: "sport", sport: "sport",
  dinner: "social", lunch: "social", coffee: "social", drinks: "social",
  bar: "social", party: "social", concert: "social", theatre: "social",
  cinema: "social", event: "social",
  work: "work", meeting: "work", conference: "work", call: "work",
};

const EMOJI_MAP: Record<string, string> = {
  gym: "🏋️", run: "🏃", swim: "🏊", tennis: "🎾", cycling: "🚴",
  yoga: "🧘", sport: "⚽", dinner: "🍽️", lunch: "🥗", coffee: "☕",
  drinks: "🍹", bar: "🍺", party: "🎉", concert: "🎵", theatre: "🎭",
  cinema: "🎬", event: "📅", work: "💻", meeting: "💼", conference: "🏛️",
  call: "📞", rest: "😴", sleep: "🛏️", travel: "✈️",
};

export function getActivityEmoji(type: string | null): string {
  return EMOJI_MAP[type ?? ""] ?? "📌";
}

export function computeWeekStats(events: CalendarEvent[]): Record<ActivityGroup, number> {
  const counts: Record<ActivityGroup, number> = { sport: 0, social: 0, work: 0 };
  for (const e of events) {
    const group = ACTIVITY_GROUPS[e.activity_type ?? ""];
    if (group) counts[group]++;
  }
  return counts;
}

export function filterEventsByTab(events: CalendarEvent[], tab: FilterTab): CalendarEvent[] {
  if (tab === "all") return events;
  return events.filter((e) => ACTIVITY_GROUPS[e.activity_type ?? ""] === tab);
}
