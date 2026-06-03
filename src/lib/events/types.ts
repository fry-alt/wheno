export type Category =
  | "study" | "work" | "meeting"
  | "gym" | "run" | "meal" | "coffee" | "social" | "rest" | "errand" | "other";

export interface Recurrence {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  weekdays: number[] | null; // 1..7 (Mon..Sun), weekly only
  until: string | null;      // yyyy-MM-dd
  count: number | null;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  category: Category;
  is_fixed: boolean;
  notes: string | null;
  location: string | null;
  recurrence: Recurrence | null;
  excluded_dates: string[];
  created_at: string;
  updated_at: string;
}

export interface EventInstance extends CalendarEvent {
  series_id: string | null;       // parent series id; null for one-off rows
  occurrence_date: string | null; // yyyy-MM-dd of this instance (recurring only)
}

export interface ParsedEvent {
  title: string;
  category: Category;
  starts_at: string; // ISO UTC
  ends_at: string;   // ISO UTC
  is_fixed: boolean;
  notes: string | null;
  recurrence: Recurrence | null;
}
