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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      career_items: {
        Row: {
          company: string
          created_at: string | null
          description: string
          id: string
          period: string
          role: string
          sort_order: number
        }
        Insert: {
          company?: string
          created_at?: string | null
          description?: string
          id?: string
          period?: string
          role?: string
          sort_order?: number
        }
        Update: {
          company?: string
          created_at?: string | null
          description?: string
          id?: string
          period?: string
          role?: string
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
      project_skills: {
        Row: {
          project_id: string
          skill_id: string
          sort_order: number | null
        }
        Insert: {
          project_id: string
          skill_id: string
          sort_order?: number | null
        }
        Update: {
          project_id?: string
          skill_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_skills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills_vocab"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tools: {
        Row: {
          project_id: string
          sort_order: number | null
          tool_id: string
        }
        Insert: {
          project_id: string
          sort_order?: number | null
          tool_id: string
        }
        Update: {
          project_id?: string
          sort_order?: number | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tools_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools_vocab"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          period: string | null
          role: string | null
          sections: Json | null
          sort_order: number | null
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          period?: string | null
          role?: string | null
          sections?: Json | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          period?: string | null
          role?: string | null
          sections?: Json | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: []
      }
      skill_experience: {
        Row: {
          card_id: string
          description: string | null
          id: string
          label: string
          label_short: string | null
          level: string
          segments: number
          sort_order: number
        }
        Insert: {
          card_id: string
          description?: string | null
          id?: string
          label: string
          label_short?: string | null
          level: string
          segments: number
          sort_order?: number
        }
        Update: {
          card_id?: string
          description?: string | null
          id?: string
          label?: string
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
      skill_tools: {
        Row: {
          card_id: string
          id: string
          name: string
          sort_order: number
          years: string
        }
        Insert: {
          card_id: string
          id?: string
          name: string
          sort_order?: number
          years: string
        }
        Update: {
          card_id?: string
          id?: string
          name?: string
          sort_order?: number
          years?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_tools_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "skill_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      skills_vocab: {
        Row: {
          category: string | null
          created_at: string
          id: string
          label: string
          label_short: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          label: string
          label_short?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          label?: string
          label_short?: string | null
        }
        Relationships: []
      }
      todos: {
        Row: {
          contents: string | null
          end_date: string | null
          id: number
          start_date: string | null
          title: string
        }
        Insert: {
          contents?: string | null
          end_date?: string | null
          id?: number
          start_date?: string | null
          title: string
        }
        Update: {
          contents?: string | null
          end_date?: string | null
          id?: number
          start_date?: string | null
          title?: string
        }
        Relationships: []
      }
      tools_vocab: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          accessibility: number | null
          facilitation: number | null
          ia: number | null
          id: string
          implementation: number | null
          interaction: number | null
          is_target: boolean | null
          presentation: number | null
          prototype: number | null
          qualitative_research: number | null
          quantitative_research: number | null
          strategy: number | null
          updated_at: string | null
          user_id: string
          visual: number | null
          writing: number | null
        }
        Insert: {
          accessibility?: number | null
          facilitation?: number | null
          ia?: number | null
          id?: string
          implementation?: number | null
          interaction?: number | null
          is_target?: boolean | null
          presentation?: number | null
          prototype?: number | null
          qualitative_research?: number | null
          quantitative_research?: number | null
          strategy?: number | null
          updated_at?: string | null
          user_id: string
          visual?: number | null
          writing?: number | null
        }
        Update: {
          accessibility?: number | null
          facilitation?: number | null
          ia?: number | null
          id?: string
          implementation?: number | null
          interaction?: number | null
          is_target?: boolean | null
          presentation?: number | null
          prototype?: number | null
          qualitative_research?: number | null
          quantitative_research?: number | null
          strategy?: number | null
          updated_at?: string | null
          user_id?: string
          visual?: number | null
          writing?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
