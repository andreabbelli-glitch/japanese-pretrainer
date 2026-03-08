export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          ui_language: string;
          furigana_default: boolean;
          daily_new_limit: number;
          daily_review_goal: number;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          ui_language?: string;
          furigana_default?: boolean;
          daily_new_limit?: number;
          daily_review_goal?: number;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          ui_language?: string;
          furigana_default?: boolean;
          daily_new_limit?: number;
          daily_review_goal?: number;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          status: "not_started" | "in_progress" | "completed";
          started_at: string | null;
          completed_at: string | null;
          last_viewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          status: "not_started" | "in_progress" | "completed";
          started_at?: string | null;
          completed_at?: string | null;
          last_viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_id?: string;
          status?: "not_started" | "in_progress" | "completed";
          started_at?: string | null;
          completed_at?: string | null;
          last_viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_item_progress: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          state: "new" | "learning" | "review" | "relearning" | "mature";
          due_at: string | null;
          last_reviewed_at: string | null;
          interval_days: number;
          ease_factor: number;
          reps: number;
          lapses: number;
          streak: number;
          mastery_score: number;
          last_rating: "Again" | "Hard" | "Good" | "Easy" | null;
          content_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          state?: "new" | "learning" | "review" | "relearning" | "mature";
          due_at?: string | null;
          last_reviewed_at?: string | null;
          interval_days?: number;
          ease_factor?: number;
          reps?: number;
          lapses?: number;
          streak?: number;
          mastery_score?: number;
          last_rating?: "Again" | "Hard" | "Good" | "Easy" | null;
          content_version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_id?: string;
          state?: "new" | "learning" | "review" | "relearning" | "mature";
          due_at?: string | null;
          last_reviewed_at?: string | null;
          interval_days?: number;
          ease_factor?: number;
          reps?: number;
          lapses?: number;
          streak?: number;
          mastery_score?: number;
          last_rating?: "Again" | "Hard" | "Good" | "Easy" | null;
          content_version?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      review_sessions: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          status: "active" | "completed" | "abandoned";
          item_count: number;
          reviewed_count: number;
          again_count: number;
          hard_count: number;
          good_count: number;
          easy_count: number;
          content_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at?: string;
          ended_at?: string | null;
          status?: "active" | "completed" | "abandoned";
          item_count?: number;
          reviewed_count?: number;
          again_count?: number;
          hard_count?: number;
          good_count?: number;
          easy_count?: number;
          content_version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          started_at?: string;
          ended_at?: string | null;
          status?: "active" | "completed" | "abandoned";
          item_count?: number;
          reviewed_count?: number;
          again_count?: number;
          hard_count?: number;
          good_count?: number;
          easy_count?: number;
          content_version?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      review_events: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          item_id: string;
          rating: "Again" | "Hard" | "Good" | "Easy";
          previous_state: "new" | "learning" | "review" | "relearning" | "mature" | null;
          next_state: "new" | "learning" | "review" | "relearning" | "mature" | null;
          interval_days_after: number | null;
          ease_factor_after: number | null;
          due_at_after: string | null;
          response_ms: number | null;
          content_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          item_id: string;
          rating: "Again" | "Hard" | "Good" | "Easy";
          previous_state?: "new" | "learning" | "review" | "relearning" | "mature" | null;
          next_state?: "new" | "learning" | "review" | "relearning" | "mature" | null;
          interval_days_after?: number | null;
          ease_factor_after?: number | null;
          due_at_after?: string | null;
          response_ms?: number | null;
          content_version?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          item_id?: string;
          rating?: "Again" | "Hard" | "Good" | "Easy";
          previous_state?: "new" | "learning" | "review" | "relearning" | "mature" | null;
          next_state?: "new" | "learning" | "review" | "relearning" | "mature" | null;
          interval_days_after?: number | null;
          ease_factor_after?: number | null;
          due_at_after?: string | null;
          response_ms?: number | null;
          content_version?: string;
          created_at?: string;
        };
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string | null;
          item_id: string | null;
          card_id: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id?: string | null;
          item_id?: string | null;
          card_id?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_id?: string | null;
          item_id?: string | null;
          card_id?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      daily_stats_cache: {
        Row: {
          id: string;
          user_id: string;
          stat_date: string;
          reviews_done: number;
          again_count: number;
          hard_count: number;
          good_count: number;
          easy_count: number;
          lessons_completed: number;
          items_studied: number;
          total_study_ms: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stat_date: string;
          reviews_done?: number;
          again_count?: number;
          hard_count?: number;
          good_count?: number;
          easy_count?: number;
          lessons_completed?: number;
          items_studied?: number;
          total_study_ms?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stat_date?: string;
          reviews_done?: number;
          again_count?: number;
          hard_count?: number;
          good_count?: number;
          easy_count?: number;
          lessons_completed?: number;
          items_studied?: number;
          total_study_ms?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      user_goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          target_type: "game" | "product" | "unit" | "custom";
          target_id: string | null;
          linked_item_ids: string[];
          status: "active" | "paused" | "completed" | "archived";
          priority: number;
          due_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          archived_at: string | null;
          archive_reason: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          target_type: "game" | "product" | "unit" | "custom";
          target_id?: string | null;
          linked_item_ids?: string[];
          status?: "active" | "paused" | "completed" | "archived";
          priority?: number;
          due_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          archived_at?: string | null;
          archive_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          target_type?: "game" | "product" | "unit" | "custom";
          target_id?: string | null;
          linked_item_ids?: string[];
          status?: "active" | "paused" | "completed" | "archived";
          priority?: number;
          due_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          archived_at?: string | null;
          archive_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_item_context_exposure: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          context_type: "game" | "product" | "unit" | "lesson" | "review" | "goal" | "other";
          context_id: string;
          source: string;
          exposure_count: number;
          first_exposed_at: string;
          last_exposed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          context_type: "game" | "product" | "unit" | "lesson" | "review" | "goal" | "other";
          context_id: string;
          source?: string;
          exposure_count?: number;
          first_exposed_at?: string;
          last_exposed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_id?: string;
          context_type?: "game" | "product" | "unit" | "lesson" | "review" | "goal" | "other";
          context_id?: string;
          source?: string;
          exposure_count?: number;
          first_exposed_at?: string;
          last_exposed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
