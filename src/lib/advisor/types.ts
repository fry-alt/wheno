import type { Category } from "@/lib/events/types";

export interface SlotRequest {
  title: string;
  category: Category;
  count: number;          // >= 1
  duration_min: number;   // > 0
  window: { from: string; to: string }; // yyyy-MM-dd inclusive
  part_of_day: "morning" | "afternoon" | "evening" | "any";
}

export interface ProposedSlot {
  date: string;       // yyyy-MM-dd (local)
  starts_at: string;  // ISO UTC
  ends_at: string;    // ISO UTC
}
