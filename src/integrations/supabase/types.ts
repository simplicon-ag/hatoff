export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brand_season_products: {
        Row: {
          brand: string
          created_at: string
          fetched_at: string
          handle: string
          id: string
          season: string
          source_url: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          fetched_at?: string
          handle: string
          id?: string
          season: string
          source_url?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          fetched_at?: string
          handle?: string
          id?: string
          season?: string
          source_url?: string | null
        }
        Relationships: []
      }
      club_points_ledger: {
        Row: {
          created_at: string
          id: string
          meta: Json
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          points: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      curated_looks: {
        Row: {
          anchor_handle: string | null
          anlaesse: string[]
          created_at: string
          hero_image_url: string | null
          highlights: string[]
          id: string
          product_handles: string[]
          published_at: string | null
          slug: string
          status: string
          story: string | null
          subtitle: string | null
          title: string
          updated_at: string
          welt: string | null
        }
        Insert: {
          anchor_handle?: string | null
          anlaesse?: string[]
          created_at?: string
          hero_image_url?: string | null
          highlights?: string[]
          id?: string
          product_handles?: string[]
          published_at?: string | null
          slug: string
          status?: string
          story?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
          welt?: string | null
        }
        Update: {
          anchor_handle?: string | null
          anlaesse?: string[]
          created_at?: string
          hero_image_url?: string | null
          highlights?: string[]
          id?: string
          product_handles?: string[]
          published_at?: string | null
          slug?: string
          status?: string
          story?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          welt?: string | null
        }
        Relationships: []
      }
      look_likes: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
          look_slug: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
          look_slug: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
          look_slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_import_job: {
        Row: {
          created_count: number
          dry_run: boolean
          error_count: number
          id: string
          message: string | null
          processed: number
          started_at: string | null
          state: string
          total: number
          updated_at: string
        }
        Insert: {
          created_count?: number
          dry_run?: boolean
          error_count?: number
          id: string
          message?: string | null
          processed?: number
          started_at?: string | null
          state?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_count?: number
          dry_run?: boolean
          error_count?: number
          id?: string
          message?: string | null
          processed?: number
          started_at?: string | null
          state?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_import_log: {
        Row: {
          brand: string
          created_at: string
          dry_run: boolean
          error_message: string | null
          handle: string | null
          id: string
          scraped_data: Json | null
          shopify_product_id: string | null
          source_url: string
          status: string
          update_mode: boolean
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          handle?: string | null
          id?: string
          scraped_data?: Json | null
          shopify_product_id?: string | null
          source_url: string
          status?: string
          update_mode?: boolean
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          handle?: string | null
          id?: string
          scraped_data?: Json | null
          shopify_product_id?: string | null
          source_url?: string
          status?: string
          update_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_price_cache: {
        Row: {
          brand: string
          created_at: string
          display_price_chf: number
          fetched_at: string
          handle: string
          id: string
          on_sale: boolean
          original_price_chf: number | null
          original_price_eur: number | null
          raw_price_eur: number | null
          source_url: string | null
          status: string
        }
        Insert: {
          brand: string
          created_at?: string
          display_price_chf: number
          fetched_at?: string
          handle: string
          id?: string
          on_sale?: boolean
          original_price_chf?: number | null
          original_price_eur?: number | null
          raw_price_eur?: number | null
          source_url?: string | null
          status?: string
        }
        Update: {
          brand?: string
          created_at?: string
          display_price_chf?: number
          fetched_at?: string
          handle?: string
          id?: string
          on_sale?: boolean
          original_price_chf?: number | null
          original_price_eur?: number | null
          raw_price_eur?: number | null
          source_url?: string | null
          status?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          product_handle: string
          rating: number
          reviewer_name: string
          shopify_order_id: string | null
          size_fit: string | null
          size_purchased: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          verified_purchase: boolean
          would_recommend: boolean
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          product_handle: string
          rating: number
          reviewer_name: string
          shopify_order_id?: string | null
          size_fit?: string | null
          size_purchased?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          verified_purchase?: boolean
          would_recommend?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          product_handle?: string
          rating?: number
          reviewer_name?: string
          shopify_order_id?: string | null
          size_fit?: string | null
          size_purchased?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          verified_purchase?: boolean
          would_recommend?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birthday: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      size_guide_cache: {
        Row: {
          brand: string
          content: string
          created_at: string
          fetched_at: string
          id: string
          source_url: string
        }
        Insert: {
          brand: string
          content: string
          created_at?: string
          fetched_at?: string
          id?: string
          source_url: string
        }
        Update: {
          brand?: string
          content?: string
          created_at?: string
          fetched_at?: string
          id?: string
          source_url?: string
        }
        Relationships: []
      }
      style_inspiration_cache: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_handle: string
          slot: string
          source_image_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_handle: string
          slot: string
          source_image_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_handle?: string
          slot?: string
          source_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          price_amount: number | null
          price_currency: string | null
          product_handle: string
          product_image: string | null
          product_title: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          price_amount?: number | null
          price_currency?: string | null
          product_handle: string
          product_image?: string | null
          product_title: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          price_amount?: number | null
          price_currency?: string | null
          product_handle?: string
          product_image?: string | null
          product_title?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      product_review_stats: {
        Row: {
          avg_rating: number | null
          count: number | null
          count_1: number | null
          count_2: number | null
          count_3: number | null
          count_4: number | null
          count_5: number | null
          count_recommend: number | null
          product_handle: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_club_points: {
        Args: { _meta?: Json; _points: number; _reason: string }
        Returns: number
      }
      get_look_like_count: { Args: { _slug: string }; Returns: number }
      get_my_points: { Args: never; Returns: number }
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
