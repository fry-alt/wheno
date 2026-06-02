export interface AppUser {
  id: string;
  telegram_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  timezone: string;
  day_start: string;
  day_end: string;
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
