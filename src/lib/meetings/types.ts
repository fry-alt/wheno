import type { Category } from "@/lib/events/types";

export type MeetingStatus = "pending" | "accepted" | "confirmed" | "declined";
export type PartOfDay = "morning" | "afternoon" | "evening" | "any";

export interface MeetingProposal {
  id: string;
  from_user_id: string;
  to_user_id: string;
  title: string;
  category: Category;
  duration_min: number;
  window_from: string; // yyyy-MM-dd
  window_to: string;   // yyyy-MM-dd
  part_of_day: PartOfDay;
  status: MeetingStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface MeetingFormInput {
  title: string;
  duration_min: number;
  window_from: string; // yyyy-MM-dd
  window_to: string;   // yyyy-MM-dd
  part_of_day: PartOfDay;
}

export interface IncomingMeeting {
  proposal_id: string;
  from_name: string;
  from_photo_url: string | null;
  title: string;
  duration_min: number;
  window_from: string;
  window_to: string;
  part_of_day: PartOfDay;
}

export interface AwaitingPick {
  proposal_id: string;
  to_name: string;
  to_photo_url: string | null;
  title: string;
  duration_min: number;
}
