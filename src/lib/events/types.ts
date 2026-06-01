export type Category =
  | "study" | "work" | "meeting"
  | "gym" | "run" | "meal" | "coffee" | "social" | "rest" | "errand" | "other";

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
  created_at: string;
  updated_at: string;
}

export interface ParsedEvent {
  title: string;
  category: Category;
  starts_at: string; // ISO UTC
  ends_at: string;   // ISO UTC
  is_fixed: boolean;
  notes: string | null;
}
