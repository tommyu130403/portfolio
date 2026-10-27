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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      career_items: {
        Row: {
          company: string
          company_id: string | null
          created_at: string | null
          description: string
          end_date: string | null
          id: string
          is_current: boolean
          period: string
          role: string
          role_id: string | null
          sort_order: number
          start_date: string | null
        }
        Insert: {
          company?: string
          company_id?: string | null
          created_at?: string | null
          description?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          period?: string
          role?: string
          role_id?: string | null
          sort_order?: number
          start_date?: string | null
        }
        Update: {
          company?: string
          company_id?: string | null
          created_at?: string | null
          description?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          period?: string
          role?: string
          role_id?: string | null
          sort_order?: number
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_items_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      contents_vocab: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      flowcharts: {
        Row: {
          created_at: string | null
          data: Json
          description: string | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json
          description?: string | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          description?: string | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      phase_names: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profile: {
        Row: {
          bio: string
          hero_image_url: string
          id: number
          introduction: Json
          name_en: string
          name_jp: string
          title: string
          updated_at: string | null
        }
        Insert: {
          bio?: string
          hero_image_url?: string
          id?: number
          introduction?: Json
          name_en?: string
          name_jp?: string
          title?: string
          updated_at?: string | null
        }
        Update: {
          bio?: string
          hero_image_url?: string
          id?: number
          introduction?: Json
          name_en?: string
          name_jp?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      skill_cards: {
        Row: {
          created_at: string | null
          icon_name: string
          icon_set: string
          id: string
          sort_order: number
          title: string
          title_jp: string
        }
        Insert: {
          created_at?: string | null
          icon_name?: string
          icon_set?: string
          id?: string
          sort_order?: number
          title: string
          title_jp: string
        }
        Update: {
          created_at?: string | null
          icon_name?: string
          icon_set?: string
          id?: string
          sort_order?: number
          title?: string
          title_jp?: string
        }
        Relationships: []
      }
      skill_experience: {
        Row: {
          card_id: string
          description: string | null
          icon_name: string | null
          icon_set: string | null
          id: string
          label: string
          label_note: string | null
          label_short: string | null
          level: string
          segments: number
          sort_order: number
        }
        Insert: {
          card_id: string
          description?: string | null
          icon_name?: string | null
          icon_set?: string | null
          id?: string
          label: string
          label_note?: string | null
          label_short?: string | null
          level: string
          segments: number
          sort_order?: number
        }
        Update: {
          card_id?: string
          description?: string | null
          icon_name?: string | null
          icon_set?: string | null
          id?: string
          label?: string
          label_note?: string | null
          label_short?: string | null
          level?: string
          segments?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_experience_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "skill_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_experience_tools: {
        Row: {
          experience_id: string
          sort_order: number
          tool_id: string
        }
        Insert: {
          experience_id: string
          sort_order?: number
          tool_id: string
        }
        Update: {
          experience_id?: string
          sort_order?: number
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_experience_tools_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "skill_experience"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_experience_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools_vocab"
            referencedColumns: ["id"]
          },
        ]
      }
      tools_vocab: {
        Row: {
          category: string | null
          created_at: string
          icon_url: string | null
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      work_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      work_contents: {
        Row: {
          content_id: string
          sort_order: number | null
          work_id: string
        }
        Insert: {
          content_id: string
          sort_order?: number | null
          work_id: string
        }
        Update: {
          content_id?: string
          sort_order?: number | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_contents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents_vocab"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_contents_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_roles: {
        Row: {
          role_id: string
          sort_order: number
          work_id: string
        }
        Insert: {
          role_id: string
          sort_order?: number
          work_id: string
        }
        Update: {
          role_id?: string
          sort_order?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_roles_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_stakeholder_counts: {
        Row: {
          headcount: number
          role_id: string
          sort_order: number
          work_id: string
        }
        Insert: {
          headcount: number
          role_id: string
          sort_order?: number
          work_id: string
        }
        Update: {
          headcount?: number
          role_id?: string
          sort_order?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_stakeholder_counts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_stakeholder_counts_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tools: {
        Row: {
          sort_order: number | null
          tool_id: string
          work_id: string
        }
        Insert: {
          sort_order?: number | null
          tool_id: string
          work_id: string
        }
        Update: {
          sort_order?: number | null
          tool_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools_vocab"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tools_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          career_item_id: string | null
          category: string | null
          created_at: string | null
          end_date: string | null
          hero_bg_color: string | null
          hero_brand: string | null
          hero_screenshots: Json | null
          id: string
          is_current: boolean
          is_published: boolean
          period: string | null
          role: string | null
          sections: Json | null
          sort_order: number | null
          stakeholder_breakdown: string | null
          stakeholders: Json | null
          start_date: string | null
          thumbnail_url: string | null
          timeline: Json | null
          title: string
        }
        Insert: {
          career_item_id?: string | null
          category?: string | null
          created_at?: string | null
          end_date?: string | null
          hero_bg_color?: string | null
          hero_brand?: string | null
          hero_screenshots?: Json | null
          id?: string
          is_current?: boolean
          is_published?: boolean
          period?: string | null
          role?: string | null
          sections?: Json | null
          sort_order?: number | null
          stakeholder_breakdown?: string | null
          stakeholders?: Json | null
          start_date?: string | null
          thumbnail_url?: string | null
          timeline?: Json | null
          title: string
        }
        Update: {
          career_item_id?: string | null
          category?: string | null
          created_at?: string | null
          end_date?: string | null
          hero_bg_color?: string | null
          hero_brand?: string | null
          hero_screenshots?: Json | null
          id?: string
          is_current?: boolean
          is_published?: boolean
          period?: string | null
          role?: string | null
          sections?: Json | null
          sort_order?: number | null
          stakeholder_breakdown?: string | null
          stakeholders?: Json | null
          start_date?: string | null
          thumbnail_url?: string | null
          timeline?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "works_career_item_id_fkey"
            columns: ["career_item_id"]
            isOneToOne: false
            referencedRelation: "career_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_role: { Args: { p_id: string }; Returns: undefined }
      portfolio_access_role: { Args: never; Returns: string }
      rename_company: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      rename_phase_name: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      rename_role: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      rename_work_category: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      save_work_with_relations: {
        Args: {
          p_content_labels: string[]
          p_role_ids: string[]
          p_stakeholder_counts: Json
          p_tool_names: string[]
          p_work: Json
        }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
