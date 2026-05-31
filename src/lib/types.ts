export type GroupRole = "owner" | "member";
export type PreferredTime = "any" | "morning" | "afternoon" | "evening";
export type MeetingRequestStatus = "open" | "selected";
export type VoteValue = "yes" | "maybe" | "no";

export interface AppUser {
  id: string;
  telegram_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface SessionPayload {
  userId: string;
  telegramId: string;
  timezone: string;
  issuedAt: number;
}

export interface TelegramProfile {
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  timezone: string;
}

export interface GroupListItem {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  role: GroupRole;
  member_count: number;
  open_meeting_count: number;
}

export interface GroupMemberSummary {
  membership_id: string;
  user_id: string;
  role: GroupRole;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  timezone: string;
}

export interface MeetingRequestSummary {
  id: string;
  title: string;
  date_from: string;
  date_to: string;
  duration_minutes: number;
  preferred_time: PreferredTime;
  min_participants: number;
  status: MeetingRequestStatus;
  selected_option_id: string | null;
  created_at: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  members: GroupMemberSummary[];
  meeting_requests: MeetingRequestSummary[];
}

export interface SchedulerMember {
  userId: string;
}

export interface SchedulerBusyBlock {
  id: string;
  userId: string;
  title: string;
  startAt: string;
  endAt: string;
}

export interface BusyBlockSummary {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  source: string;
}

export interface GroupBusyBlockSummary extends BusyBlockSummary {
  user_id: string;
}

export interface ScheduledOption {
  startAt: string;
  endAt: string;
  score: number;
  freeUserIds: string[];
  busyUserIds: string[];
}

export interface VoteSummary {
  yes: number;
  maybe: number;
  no: number;
}

export interface MeetingMemberIdentity {
  user_id: string;
  name: string;
  photo_url: string | null;
}

export interface MeetingOptionDetail {
  id: string;
  start_at: string;
  end_at: string;
  score: number;
  free_user_ids: string[];
  busy_user_ids: string[];
  free_members: MeetingMemberIdentity[];
  busy_members: MeetingMemberIdentity[];
  votes: VoteSummary;
  current_user_vote: VoteValue | null;
}

export interface MeetingDetail {
  id: string;
  group_id: string;
  group_name: string;
  group_owner_id: string;
  title: string;
  date_from: string;
  date_to: string;
  duration_minutes: number;
  preferred_time: PreferredTime;
  min_participants: number;
  status: MeetingRequestStatus;
  selected_option_id: string | null;
  member_count: number;
  options: MeetingOptionDetail[];
}

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  activity_type: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  energy_after: "high" | "medium" | "low" | null;
  dress_code: "athletic" | "casual" | "smart" | "formal" | null;
  is_flexible: boolean;
  notes: string | null;
  source: string;
  created_at: string;
};

export type Reminder = {
  id: string;
  user_id: string;
  event_id: string;
  chat_id: number;
  remind_at: string;
  sent: boolean;
  created_at: string;
};

export type PendingVoice = {
  user_id: string;
  transcription: string;
  expires_at: string;
};
