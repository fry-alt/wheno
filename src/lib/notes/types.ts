export interface Note {
  id: string;
  user_id: string;
  content: string;
  date: string | null; // yyyy-MM-dd, or null for standalone task
  done: boolean;
  created_at: string;
}
