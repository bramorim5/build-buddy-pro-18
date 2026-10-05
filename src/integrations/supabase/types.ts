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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bom_lines: {
        Row: {
          child_id: string
          id: string
          parent_id: string
          quantity: number
        }
        Insert: {
          child_id: string
          id?: string
          parent_id: string
          quantity?: number
        }
        Update: {
          child_id?: string
          id?: string
          parent_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_suppliers: {
        Row: {
          id: string
          is_primary: boolean
          item_id: string
          lead_time: string | null
          supplier_id: string
          unit_cost: number | null
        }
        Insert: {
          id?: string
          is_primary?: boolean
          item_id: string
          lead_time?: string | null
          supplier_id: string
          unit_cost?: number | null
        }
        Update: {
          id?: string
          is_primary?: boolean
          item_id?: string
          lead_time?: string | null
          supplier_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_suppliers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          min_quantity: number
          name: string
          photo_url: string | null
          product_line: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          min_quantity?: number
          name: string
          photo_url?: string | null
          product_line?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          min_quantity?: number
          name?: string
          photo_url?: string | null
          product_line?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          item_id: string
          kind: string
          note: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          item_id: string
          kind: string
          note?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          item_id?: string
          kind?: string
          note?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      purchase_records: {
        Row: {
          created_at: string
          id: string
          item_id: string
          note: string | null
          quantity: number
          supplier_id: string | null
          total_cost: number
          unit_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          quantity: number
          supplier_id?: string | null
          total_cost: number
          unit_cost: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          quantity?: number
          supplier_id?: string | null
          total_cost?: number
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_records_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_records_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          id: string
          item_id: string
          note: string | null
          quantity: number
          total_cost: number | null
          unit_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          quantity: number
          total_cost?: number | null
          unit_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          quantity?: number
          total_cost?: number | null
          unit_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: { p_delta: number; p_item_id: string; p_note?: string }
        Returns: undefined
      }
      assemble: {
        Args: { p_item_id: string; p_qty: number; p_user: string }
        Returns: undefined
      }
      create_inventory_item: {
        Args: {
          p_code: string
          p_initial_quantity?: number
          p_item_type: Database["public"]["Enums"]["item_type"]
          p_min_quantity?: number
          p_name: string
          p_product_line?: string
        }
        Returns: string
      }
      delete_purchase_record: { Args: { p_id: string }; Returns: undefined }
      delete_sale_record: { Args: { p_id: string }; Returns: undefined }
      duplicate_item: {
        Args: { p_item_id: string; p_new_code: string; p_new_name: string }
        Returns: string
      }
      receive_purchase: {
        Args: { p_item_id: string; p_note?: string; p_qty: number }
        Returns: undefined
      }
      record_purchase: {
        Args: {
          p_item_id: string
          p_note?: string
          p_qty: number
          p_supplier_id?: string
          p_total_cost?: number
          p_unit_cost?: number
        }
        Returns: string
      }
      record_sale: {
        Args: {
          p_item_id: string
          p_note?: string
          p_qty: number
          p_unit_price?: number
        }
        Returns: string
      }
      update_purchase_record: {
        Args: {
          p_id: string
          p_note: string
          p_quantity: number
          p_unit_cost: number
        }
        Returns: undefined
      }
      update_sale_record: {
        Args: { p_id: string; p_note: string; p_quantity: number }
        Returns: undefined
      }
    }
    Enums: {
      item_type: "material" | "submontagem" | "produto"
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
    Enums: {
      item_type: ["material", "submontagem", "produto"],
    },
  },
} as const
