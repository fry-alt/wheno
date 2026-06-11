export type Gender = "male" | "female" | "other";

export interface Profile {
  user_id: string;
  bio: string | null;
  city: string | null;
  birthdate: string | null; // yyyy-MM-dd
  gender: Gender | null;
  show_age: boolean;
  show_gender: boolean;
  interests: string[];
  updated_at?: string;
}

export interface ProfilePhoto {
  id: string;
  user_id: string;
  storage_path: string;
  position: number;
  created_at?: string;
}

export interface ProfilePhotoView { id: string; url: string; position: number }

export interface ProfileWithPhotos extends Profile {
  photos: ProfilePhotoView[];
}

export interface PublicProfile {
  user_id: string;
  bio: string | null;
  city: string | null;
  age: number | null;
  gender: Gender | null;
  interests: string[];
  photos: ProfilePhotoView[];
}
