// Types de la base. À régénérer avec `pnpm db:types` (Supabase local démarré) après chaque migration.
// TODO(M1) : écrit à la main en attendant Docker ; remplacer par la sortie de `pnpm db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          timezone: string;
          alternating_from: string | null;
          onboarded_at: string | null;
        };
        Insert: never;
        Update: {
          name?: string;
          timezone?: string;
          alternating_from?: string | null;
          onboarded_at?: string | null;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          household_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["household_role"];
          created_at: string;
        };
        Insert: never;
        Update: { role?: Database["public"]["Enums"]["household_role"] };
        Relationships: [
          {
            foreignKeyName: "memberships_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          household_id: string;
          email: string | null;
          role: Database["public"]["Enums"]["household_role"];
          token: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          household_id: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["household_role"];
        };
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: { user_id: string; display_name: string | null; active_household: string | null };
        Insert: never;
        Update: { display_name?: string | null; active_household?: string | null };
        Relationships: [];
      };
      user_settings: {
        Row: { user_id: string; notifications: Json };
        Insert: never;
        Update: { notifications?: Json };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string | null;
          name: string;
          kind: "adult" | "child";
          birthdate: string | null;
          portion_override: number | null;
          diet: string | null;
          archived: boolean;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id?: string | null;
          name: string;
          kind: "adult" | "child";
          birthdate?: string | null;
          portion_override?: number | null;
          diet?: string | null;
          archived?: boolean;
        };
        Update: {
          user_id?: string | null;
          name?: string;
          kind?: "adult" | "child";
          birthdate?: string | null;
          portion_override?: number | null;
          diet?: string | null;
          archived?: boolean;
        };
        Relationships: [];
      };
      household_settings: {
        Row: {
          household_id: string;
          version: number;
          diet: Json;
          menu: Json;
          session: Json;
          shopping: Json;
          equipment: Json;
          updated_at: string;
        };
        Insert: {
          household_id: string;
          version?: number;
          diet: Json;
          menu: Json;
          session: Json;
          shopping: Json;
          equipment: Json;
        };
        Update: {
          version?: number;
          diet?: Json;
          menu?: Json;
          session?: Json;
          shopping?: Json;
          equipment?: Json;
        };
        Relationships: [];
      };
      presence_rules: {
        Row: {
          member_id: string;
          weekday: number;
          meal: "lunch" | "dinner";
          present: boolean;
          week_parity: "all" | "A" | "B";
        };
        Insert: {
          member_id: string;
          weekday: number;
          meal: "lunch" | "dinner";
          present: boolean;
          week_parity?: "all" | "A" | "B";
        };
        Update: { present?: boolean };
        Relationships: [];
      };
      weeks: {
        Row: {
          id: string;
          household_id: string;
          start_date: string;
          status: "draft" | "active" | "done";
          plan: Json;
          pasta_need: number | null;
          pantry_done: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          household_id: string;
          start_date: string;
          status: "draft" | "active" | "done";
          plan: Json;
          pasta_need?: number | null;
          pantry_done?: boolean;
        };
        Update: {
          status?: "draft" | "active" | "done";
          plan?: Json;
          pasta_need?: number | null;
          pantry_done?: boolean;
        };
        Relationships: [];
      };
      ratings: {
        Row: { household_id: string; recipe_id: string; value: number };
        Insert: { household_id: string; recipe_id: string; value: number };
        Update: { value?: number };
        Relationships: [];
      };
      pantry: {
        Row: { household_id: string; ingredient_key: string; qty: number | null; updated_at: string };
        Insert: { household_id: string; ingredient_key: string; qty: number | null };
        Update: { qty?: number | null };
        Relationships: [];
      };
      freezer: {
        Row: { id: string; household_id: string; recipe_id: string; portions: number; frozen_at: string };
        Insert: { household_id: string; recipe_id: string; portions: number; frozen_at?: string };
        Update: { portions?: number; frozen_at?: string };
        Relationships: [];
      };
      shopping_items: {
        Row: {
          id: string;
          household_id: string;
          week_id: string | null;
          source: "menu" | "pantry_check" | "manual";
          ingredient_key: string | null;
          label: string | null;
          qty_text: string | null;
          aisle: string;
          checked: boolean;
          checked_by: string | null;
          added_by: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          week_id?: string | null;
          source: "menu" | "pantry_check" | "manual";
          ingredient_key?: string | null;
          label?: string | null;
          qty_text?: string | null;
          aisle: string;
          checked?: boolean;
        };
        Update: { checked?: boolean; label?: string | null; qty_text?: string | null; aisle?: string };
        Relationships: [];
      };
      sessions: {
        Row: {
          week_id: string;
          household_id: string;
          started_at: string | null;
          current_step: number;
          tasks_done: Json;
          timers: Json;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      aisles: {
        Row: { key: string; label: string; position: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ingredients: {
        Row: {
          key: string;
          label: string;
          unit: "g" | "ml" | "pc" | "boite" | "cs" | "cc";
          aisle: string;
          forms: Json;
          half: boolean;
          allergens: string[];
          seasonal: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      packs: {
        Row: { ingredient_key: string; sizes: number[]; label: string; tolerance: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ingredient_synonyms: {
        Row: { synonym: string; ingredient_key: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          kind: "main" | "soup" | "simple" | "cake" | "breakfast";
          data: Json;
          name: string | null;
          origin: string | null;
          protein: "volaille" | "boeuf" | "porc" | "poisson" | "veg" | null;
          months: number[] | null;
          /** null = inconnu : un filtre de régime doit écarter la recette. */
          diet_tags: string[] | null;
          /** null = inconnu : un filtre d'allergène doit écarter la recette. */
          allergens: string[] | null;
          is_active: boolean;
          household_id: string | null;
          source_url: string | null;
          source_name: string | null;
          imported_by: string | null;
          status: "draft" | "validated";
          created_at: string;
        };
        Insert: {
          id: string;
          kind: "main" | "soup" | "simple" | "cake" | "breakfast";
          data: Json;
          household_id: string;
          origin?: string | null;
          protein?: "volaille" | "boeuf" | "porc" | "poisson" | "veg" | null;
          months?: number[] | null;
          diet_tags?: string[] | null;
          allergens?: string[] | null;
          is_active?: boolean;
          source_url?: string | null;
          source_name?: string | null;
          imported_by?: string | null;
          status?: "draft" | "validated";
        };
        Update: {
          kind?: "main" | "soup" | "simple" | "cake" | "breakfast";
          data?: Json;
          origin?: string | null;
          protein?: "volaille" | "boeuf" | "porc" | "poisson" | "veg" | null;
          months?: number[] | null;
          diet_tags?: string[] | null;
          allergens?: string[] | null;
          is_active?: boolean;
          status?: "draft" | "validated";
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_household: { Args: { p_name: string }; Returns: string };
      accept_invitation: { Args: { p_token: string }; Returns: string };
      leave_household: { Args: { p_household: string }; Returns: undefined };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          household_name: string;
          role: Database["public"]["Enums"]["household_role"];
          status: "valid" | "expired" | "used";
        }[];
      };
      is_household_member: { Args: { hid: string }; Returns: boolean };
      session_ensure: {
        Args: { p_week: string; p_sig: string };
        Returns: Database["public"]["Tables"]["sessions"]["Row"];
      };
      session_start: { Args: { p_week: string }; Returns: undefined };
      session_set_step: { Args: { p_week: string; p_step: number }; Returns: undefined };
      session_set_task: { Args: { p_week: string; p_key: string; p_done: boolean }; Returns: undefined };
      session_start_timer: {
        Args: { p_week: string; p_id: string; p_label: string; p_minutes: number; p_step: number };
        Returns: undefined;
      };
      session_timer: { Args: { p_week: string; p_id: string; p_action: string }; Returns: undefined };
      household_role_of: { Args: { hid: string }; Returns: Database["public"]["Enums"]["household_role"] };
    };
    Enums: { household_role: "admin" | "member" | "viewer" };
    CompositeTypes: { [_ in never]: never };
  };
};

export type HouseholdRole = Database["public"]["Enums"]["household_role"];
