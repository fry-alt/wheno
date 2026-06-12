export type Visibility = "public" | "friends";
export type ActivityStatus = "open" | "cancelled";
export type ActivityButtonState = "host" | "joined" | "full" | "past" | "cancelled" | "join";

export interface Activity {
  id: string;
  host_id: string;
  title: string;
  type: string;          // interest slug or custom
  description: string | null;
  place: string | null;
  lat: number | null;    // map pin latitude
  lng: number | null;    // map pin longitude
  starts_at: string;     // ISO
  ends_at: string;       // ISO
  capacity: number | null;
  visibility: Visibility;
  status: ActivityStatus;
  created_at?: string;
}

export interface ParticipantView { user_id: string; name: string; photo_url: string | null }

export interface ActivityCardData {
  activity: Activity;
  hostName: string;
  hostPhoto: string | null;
  count: number;          // participants incl. host
  isHost: boolean;
  isParticipant: boolean;
  isFree: boolean;        // fits viewer's free time
}
