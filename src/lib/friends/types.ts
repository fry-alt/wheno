export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
}

export interface FriendSummary {
  user_id: string;
  name: string;
  username: string | null;
  photo_url: string | null;
  friendship_id: string;
}

export interface IncomingRequest {
  friendship_id: string;
  from_user_id: string;
  name: string;
  username: string | null;
  photo_url: string | null;
}
