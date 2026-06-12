import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";

type UntypedSupabaseDatabase = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: {
      check_rate_limit: {
        Args: { p_user: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      join_activity: {
        Args: { p_activity: string; p_user: string; p_event: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let adminClient: SupabaseClient<UntypedSupabaseDatabase> | null = null;

export function getAdminSupabase() {
  if (!adminClient) {
    adminClient = createClient<UntypedSupabaseDatabase>(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
}
