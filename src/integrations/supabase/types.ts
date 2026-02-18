Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      creator_conversation_summaries: {
        Row: {
          conversation_count: number
          created_at: string
          creator_id: string
          earliest_timestamp: string
          id: string
          latest_timestamp: string
          summary_text: string
          token_count: number
          updated_at: string
        }
        Insert: {
          conversation_count?: number
          created_at?: string
          creator_id: string
          earliest_timestamp: string
          id?: string
          latest_timestamp: string
          summary_text: string
          token_count?: number
          updated_at?: string
        }
        Update: {
          conversation_count?: number
          created_at?: string
          creator_id?: string
          earliest_timestamp?: string
          id?: string
          latest_timestamp?: string
          summary_text?: string
          token_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_conversation_summaries_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_embeddings: {
        Row: {
          created_at: string
          creator_id: string
          embedding: string
          id: string
          metadata: Json | null
          source_id: string
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          embedding: string
          id?: string
          metadata?: Json | null
          source_id: string
          source_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          embedding?: string
          id?: string
          metadata?: Json | null
          source_id?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_embeddings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_news_digests: {
        Row: {
          cadence: string
          created_at: string
          creator_id: string
          digest_bullets: Json
          id: string
          last_fetched_at: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          cadence: string
          created_at?: string
          creator_id: string
          digest_bullets?: Json
          id?: string
          last_fetched_at?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          created_at?: string
          creator_id?: string
          digest_bullets?: Json
          id?: string
          last_fetched_at?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_news_digests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_post_index: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          like_count: number
          post_content: string
          post_id: string
          post_timestamp: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          like_count?: number
          post_content: string
          post_id: string
          post_timestamp: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          like_count?: number
          post_content?: string
          post_id?: string
          post_timestamp?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_post_index_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_post_index_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          bio: string | null
          context_opt_in: boolean
          created_at: string
          creator_id: string
          id: string
          interests: string[] | null
          news_cadence: string | null
          news_enabled: boolean
          news_topics: string[] | null
          specialties: string[] | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          context_opt_in?: boolean
          created_at?: string
          creator_id: string
          id?: string
          interests?: string[] | null
          news_cadence?: string | null
          news_enabled?: boolean
          news_topics?: string[] | null
          specialties?: string[] | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          context_opt_in?: boolean
          created_at?: string
          creator_id?: string
          id?: string
          interests?: string[] | null
          news_cadence?: string | null
          news_enabled?: boolean
          news_topics?: string[] | null
          specialties?: string[] | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          agentic_context_opt_in: boolean
          clone_name: string
          created_at: string
          focus_id: string | null
          goal_id: string | null
          id: string
          is_active: boolean
          persona_text: string
          prompt_template: string
          selected_pack: string | null
          tone_id: string | null
          updated_at: string
          wallet_address: string
          x_handle: string | null
          x_verified: boolean
          x_verified_at: string | null
        }
        Insert: {
          agentic_context_opt_in?: boolean
          clone_name: string
          created_at?: string
          focus_id?: string | null
          goal_id?: string | null
          id?: string
          is_active?: boolean
          persona_text: string
          prompt_template: string
          selected_pack?: string | null
          tone_id?: string | null
          updated_at?: string
          wallet_address: string
          x_handle?: string | null
          x_verified?: boolean
          x_verified_at?: string | null
        }
        Update: {
          agentic_context_opt_in?: boolean
          clone_name?: string
          created_at?: string
          focus_id?: string | null
          goal_id?: string | null
          id?: string
          is_active?: boolean
          persona_text?: string
          prompt_template?: string
          selected_pack?: string | null
          tone_id?: string | null
          updated_at?: string
          wallet_address?: string
          x_handle?: string | null
          x_verified?: boolean
          x_verified_at?: string | null
        }
        Relationships: []
      }
      donation_audit_log: {
        Row: {
          created_at: string
          donation_id: string | null
          error_text: string | null
          event_type: string
          id: number
          metadata: Json
          tx_hash: string | null
        }
        Insert: {
          created_at?: string
          donation_id?: string | null
          error_text?: string | null
          event_type: string
          id?: number
          metadata?: Json
          tx_hash?: string | null
        }
        Update: {
          created_at?: string
          donation_id?: string | null
          error_text?: string | null
          event_type?: string
          id?: number
          metadata?: Json
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donation_audit_log_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount: number
          asset_symbol: string
          chain_id: number
          created_at: string
          donor_wallet: string
          failure_reason: string | null
          id: string
          mention_id: string | null
          recipient_creator_id: string | null
          recipient_wallet: string
          status: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          asset_symbol?: string
          chain_id?: number
          created_at?: string
          donor_wallet: string
          failure_reason?: string | null
          id?: string
          mention_id?: string | null
          recipient_creator_id?: string | null
          recipient_wallet: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          asset_symbol?: string
          chain_id?: number
          created_at?: string
          donor_wallet?: string
          failure_reason?: string | null
          id?: string
          mention_id?: string | null
          recipient_creator_id?: string | null
          recipient_wallet?: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_mention_id_fkey"
            columns: ["mention_id"]
            isOneToOne: false
            referencedRelation: "mentions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_recipient_creator_id_fkey"
            columns: ["recipient_creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      epoch_rewards: {
        Row: {
          composite_score: number
          creator_id: string
          epoch_id: number
          id: string
          like_count: number
          moderation_score: number
          quality_score: number
          rank: number
          reward_amount: number
        }
        Insert: {
          composite_score?: number
          creator_id: string
          epoch_id: number
          id?: string
          like_count: number
          moderation_score?: number
          quality_score?: number
          rank: number
          reward_amount: number
        }
        Update: {
          composite_score?: number
          creator_id?: string
          epoch_id?: number
          id?: string
          like_count?: number
          moderation_score?: number
          quality_score?: number
          rank?: number
          reward_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "epoch_rewards_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epoch_rewards_epoch_id_fkey"
            columns: ["epoch_id"]
            isOneToOne: false
            referencedRelation: "epochs"
            referencedColumns: ["id"]
          },
        ]
      }
      epochs: {
        Row: {
          created_at: string
          end_at: string
          id: number
          payout_tx_hash: string | null
          reward_pool: number
          start_at: string
          status: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: number
          payout_tx_hash?: string | null
          reward_pool?: number
          start_at: string
          status?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: number
          payout_tx_hash?: string | null
          reward_pool?: number
          start_at?: string
          status?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          attempts: number
          author_handle: string | null
          author_wallet: string | null
          created_at: string
          error_text: string | null
          id: string
          last_attempt_at: string | null
          mention_id: string
          parsed_intent: string
          payload: Json
          platform: string
          processed_at: string | null
          raw_text: string
          status: string
        }
        Insert: {
          attempts?: number
          author_handle?: string | null
          author_wallet?: string | null
          created_at?: string
          error_text?: string | null
          id?: string
          last_attempt_at?: string | null
          mention_id: string
          parsed_intent?: string
          payload?: Json
          platform?: string
          processed_at?: string | null
          raw_text: string
          status?: string
        }
        Update: {
          attempts?: number
          author_handle?: string | null
          author_wallet?: string | null
          created_at?: string
          error_text?: string | null
          id?: string
          last_attempt_at?: string | null
          mention_id?: string
          parsed_intent?: string
          payload?: Json
          platform?: string
          processed_at?: string | null
          raw_text?: string
          status?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          commit_tx_hash: string | null
          composite_score: number
          content_hash: string
          content_html: string | null
          content_tags: string[]
          content_text: string
          created_at: string
          creator_id: string
          engagement_score: number
          epoch_id: number
          id: string
          is_fallback: boolean
          meta_hash: string
          moderation_score: number
          prompt_hash: string
          prompt_text: string
          quality_flags: Json
          quality_score: number
          risk_level: string
          source_platform: string
          source_reference: string | null
        }
        Insert: {
          commit_tx_hash?: string | null
          composite_score?: number
          content_hash: string
          content_html?: string | null
          content_tags?: string[]
          content_text: string
          created_at?: string
          creator_id: string
          engagement_score?: number
          epoch_id: number
          id?: string
          is_fallback?: boolean
          meta_hash: string
          moderation_score?: number
          prompt_hash: string
          prompt_text: string
          quality_flags?: Json
          quality_score?: number
          risk_level?: string
          source_platform?: string
          source_reference?: string | null
        }
        Update: {
          commit_tx_hash?: string | null
          composite_score?: number
          content_hash?: string
          content_html?: string | null
          content_tags?: string[]
          content_text?: string
          created_at?: string
          creator_id?: string
          engagement_score?: number
          epoch_id?: number
          id?: string
          is_fallback?: boolean
          meta_hash?: string
          moderation_score?: number
          prompt_hash?: string
          prompt_text?: string
          quality_flags?: Json
          quality_score?: number
          risk_level?: string
          source_platform?: string
          source_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_epoch_id_fkey"
            columns: ["epoch_id"]
            isOneToOne: false
            referencedRelation: "epochs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_activity_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          wallet_address?: string
        }
        Relationships: []
      }
      webhook_nonces: {
        Row: {
          created_at: string
          expires_at: string
          nonce: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          nonce: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          nonce?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_creator_embeddings: {
        Args: {
          cutoff_date: string
          match_count: number
          match_creator_id: string
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          created_at: string
          creator_id: string
          id: string
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

