export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_match_detail_queue: {
        Row: {
          attempts: number
          created_at: string
          dota_account_id: number
          fetched_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          lease_expires_at: string | null
          lease_token: string | null
          match_id: number
          next_retry_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dota_account_id: number
          fetched_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          match_id: number
          next_retry_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dota_account_id?: number
          fetched_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          match_id?: number
          next_retry_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_match_detail_queue_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "dota_matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      account_match_sync_state: {
        Row: {
          backfill_complete: boolean
          backfill_offset: number
          backfill_upper_bound_match_id: number | null
          consecutive_failures: number
          created_at: string
          dota_account_id: number
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
           last_success_at: string | null
           history_provider: string
           lease_expires_at: string | null
          lease_token: string | null
          newest_match_id: number | null
          next_retry_at: string | null
          oldest_match_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          backfill_complete?: boolean
          backfill_offset?: number
          backfill_upper_bound_match_id?: number | null
          consecutive_failures?: number
          created_at?: string
          dota_account_id: number
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
           last_success_at?: string | null
           history_provider?: string
           lease_expires_at?: string | null
          lease_token?: string | null
          newest_match_id?: number | null
          next_retry_at?: string | null
          oldest_match_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          backfill_complete?: boolean
          backfill_offset?: number
          backfill_upper_bound_match_id?: number | null
          consecutive_failures?: number
          created_at?: string
          dota_account_id?: number
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
           last_success_at?: string | null
           history_provider?: string
           lease_expires_at?: string | null
          lease_token?: string | null
          newest_match_id?: number | null
          next_retry_at?: string | null
          oldest_match_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dota_matches: {
        Row: {
          average_rank: number | null
          cluster: number | null
          created_at: string
          detail_fetched_at: string | null
          detail_status: string
          dire_score: number | null
          dire_team_id: number | null
          duration: number | null
          game_mode: number | null
          league_id: number | null
          lobby_type: number | null
          match_id: number
          radiant_score: number | null
          radiant_team_id: number | null
          radiant_win: boolean | null
          series_id: number | null
          series_type: number | null
          source: string
          source_fetched_at: string
          start_time: number | null
          updated_at: string
          version: number | null
        }
        Insert: {
          average_rank?: number | null
          cluster?: number | null
          created_at?: string
          detail_fetched_at?: string | null
          detail_status?: string
          dire_score?: number | null
          dire_team_id?: number | null
          duration?: number | null
          game_mode?: number | null
          league_id?: number | null
          lobby_type?: number | null
          match_id: number
          radiant_score?: number | null
          radiant_team_id?: number | null
          radiant_win?: boolean | null
          series_id?: number | null
          series_type?: number | null
          source?: string
          source_fetched_at?: string
          start_time?: number | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          average_rank?: number | null
          cluster?: number | null
          created_at?: string
          detail_fetched_at?: string | null
          detail_status?: string
          dire_score?: number | null
          dire_team_id?: number | null
          duration?: number | null
          game_mode?: number | null
          league_id?: number | null
          lobby_type?: number | null
          match_id?: number
          radiant_score?: number | null
          radiant_team_id?: number | null
          radiant_win?: boolean | null
          series_id?: number | null
          series_type?: number | null
          source?: string
          source_fetched_at?: string
          start_time?: number | null
          updated_at?: string
          version?: number | null
        }
        Relationships: []
      }
      match_provider_payloads: {
        Row: {
          created_at: string
          fetched_at: string
          match_id: number
          payload: Json
          payload_kind: string
          payload_section: string
          provider: string
          schema_version: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          match_id: number
          payload: Json
          payload_kind?: string
          payload_section?: string
          provider: string
          schema_version?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fetched_at?: string
          match_id?: number
          payload?: Json
          payload_kind?: string
          payload_section?: string
          provider?: string
          schema_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_provider_payloads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "dota_matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      player_match_stats: {
        Row: {
          account_id: number
          assists: number | null
          created_at: string
          deaths: number | null
          denies: number | null
          gold_per_min: number | null
          hero_damage: number | null
          hero_healing: number | null
          hero_id: number | null
          hero_variant: number | null
          is_roaming: boolean | null
          kills: number | null
          lane: number | null
          lane_role: number | null
          last_hits: number | null
          leaver_status: number | null
          level: number | null
          match_id: number
          net_worth: number | null
          party_size: number | null
          player_slot: number | null
          source_fetched_at: string
          tower_damage: number | null
          updated_at: string
          xp_per_min: number | null
        }
        Insert: {
          account_id: number
          assists?: number | null
          created_at?: string
          deaths?: number | null
          denies?: number | null
          gold_per_min?: number | null
          hero_damage?: number | null
          hero_healing?: number | null
          hero_id?: number | null
          hero_variant?: number | null
          is_roaming?: boolean | null
          kills?: number | null
          lane?: number | null
          lane_role?: number | null
          last_hits?: number | null
          leaver_status?: number | null
          level?: number | null
          match_id: number
          net_worth?: number | null
          party_size?: number | null
          player_slot?: number | null
          source_fetched_at?: string
          tower_damage?: number | null
          updated_at?: string
          xp_per_min?: number | null
        }
        Update: {
          account_id?: number
          assists?: number | null
          created_at?: string
          deaths?: number | null
          denies?: number | null
          gold_per_min?: number | null
          hero_damage?: number | null
          hero_healing?: number | null
          hero_id?: number | null
          hero_variant?: number | null
          is_roaming?: boolean | null
          kills?: number | null
          lane?: number | null
          lane_role?: number | null
          last_hits?: number | null
          leaver_status?: number | null
          level?: number | null
          match_id?: number
          net_worth?: number | null
          party_size?: number | null
          player_slot?: number | null
          source_fetched_at?: string
          tower_damage?: number | null
          updated_at?: string
          xp_per_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "dota_matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clerk_user_id: string
          created_at: string
          display_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clerk_user_id?: string
          created_at?: string
          display_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clerk_user_id?: string
          created_at?: string
          display_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tracked_account_matches: {
        Row: {
          discovered_at: string
          match_id: number
          tracked_account_id: string
        }
        Insert: {
          discovered_at?: string
          match_id: number
          tracked_account_id: string
        }
        Update: {
          discovered_at?: string
          match_id?: number
          tracked_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_account_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "dota_matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "tracked_account_matches_tracked_account_id_fkey"
            columns: ["tracked_account_id"]
            isOneToOne: false
            referencedRelation: "tracked_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_accounts: {
        Row: {
          avatar_url: string | null
          created_at: string
          dota_account_id: number | null
          id: string
          label: string | null
          persona_name: string | null
          profile_refreshed_at: string | null
          rank_tier: number | null
          steam_id64: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dota_account_id?: number | null
          id?: string
          label?: string | null
          persona_name?: string | null
          profile_refreshed_at?: string | null
          rank_tier?: number | null
          steam_id64: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dota_account_id?: number | null
          id?: string
          label?: string | null
          persona_name?: string | null
          profile_refreshed_at?: string | null
          rank_tier?: number | null
          steam_id64?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_healthcheck: { Args: never; Returns: Json }
      apply_match_sync_page: {
        Args: {
          p_actor_user_id: string
          p_backfill_complete: boolean
          p_dota_account_id: number
          p_lease_token: string
          p_matches: Json
          p_next_offset: number
          p_tracked_account_id: string
        }
        Returns: Json
      }
      apply_match_sync_page_with_boundary: {
        Args: {
          p_actor_user_id: string
          p_backfill_complete: boolean
          p_backfill_upper_bound_match_id: number
          p_dota_account_id: number
          p_lease_token: string
          p_matches: Json
          p_next_offset: number
          p_tracked_account_id: string
        }
        Returns: Json
      }
      apply_match_sync_page_with_boundary_and_source: {
        Args: {
          p_actor_user_id: string
          p_backfill_complete: boolean
          p_backfill_upper_bound_match_id: number
          p_dota_account_id: number
          p_lease_token: string
          p_matches: Json
          p_next_offset: number
          p_source: string
          p_tracked_account_id: string
        }
        Returns: Json
      }
      apply_match_sync_page_with_boundary_source_and_payloads: {
        Args: {
          p_actor_user_id: string
          p_backfill_complete: boolean
          p_backfill_upper_bound_match_id: number
          p_dota_account_id: number
          p_lease_token: string
          p_matches: Json
          p_next_offset: number
          p_payloads: Json
          p_source: string
          p_tracked_account_id: string
        }
        Returns: Json
      }
      apply_match_sync_page_with_source: {
        Args: {
          p_actor_user_id: string
          p_backfill_complete: boolean
          p_dota_account_id: number
          p_lease_token: string
          p_matches: Json
          p_next_offset: number
          p_source: string
          p_tracked_account_id: string
        }
        Returns: Json
      }
      claim_match_sync: {
        Args: {
          p_actor_user_id: string
          p_lease_seconds?: number
          p_tracked_account_id: string
        }
        Returns: Json
      }
      claim_specific_match_detail: {
        Args: {
          p_actor_user_id: string
          p_lease_seconds?: number
          p_match_id: number
          p_tracked_account_id: string
        }
        Returns: Json
      }
      claim_match_sync_for_provider: {
        Args: {
          p_actor_user_id: string
          p_history_provider?: string
          p_lease_seconds?: number
          p_tracked_account_id: string
        }
        Returns: Json
      }
      get_match_archive_overview: {
        Args: {
          p_tracked_account_id: string
          p_period?: string
          p_mode?: string
          p_result?: string
          p_party?: string
          p_position?: string
          p_hero_id?: number | null
        }
        Returns: Json
      }
      get_match_archive_page: {
        Args: {
          p_tracked_account_id: string
          p_period?: string
          p_mode?: string
          p_result?: string
          p_party?: string
          p_position?: string
          p_hero_id?: number | null
          p_cursor_start_time?: number | null
          p_cursor_match_id?: number | null
          p_limit?: number
        }
        Returns: Json
      }
      record_match_sync_failure: {
        Args: {
          p_actor_user_id: string
          p_dota_account_id: number
          p_error_code: string
          p_error_message: string
          p_lease_token: string
          p_tracked_account_id: string
        }
        Returns: Json
      }
      apply_match_detail_batch: {
        Args: {
          p_actor_user_id: string
          p_dota_account_id: number
          p_lease_token: string
          p_results: Json
          p_tracked_account_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
