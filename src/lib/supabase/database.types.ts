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
          association_id: string | null;
          association_joined_at: string | null;
        };
        Insert: never;
        Update: {
          name?: string;
          timezone?: string;
          alternating_from?: string | null;
          onboarded_at?: string | null;
          association_id?: string | null;
          association_joined_at?: string | null;
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
      canteen_menus: {
        Row: {
          id: string;
          member_id: string;
          date: string;
          text: string;
          source: "manual" | "pdf" | "url";
          validated: boolean;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          date: string;
          text: string;
          source?: "manual" | "pdf" | "url";
          validated?: boolean;
        };
        Update: { text?: string; validated?: boolean; source?: "manual" | "pdf" | "url" };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          keys: Json;
          user_agent: string | null;
          created_at: string;
        };
        Insert: { endpoint: string; keys: Json; user_agent?: string | null; user_id?: string };
        Update: { keys?: Json; user_agent?: string | null };
        Relationships: [];
      };
      notification_log: {
        Row: {
          id: number;
          user_id: string;
          kind: string;
          day: string;
          sent_at: string;
          payload: Json | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      events: {
        Row: {
          id: number;
          user_id: string | null;
          household_id: string | null;
          name: string;
          props: Json;
          created_at: string;
        };
        Insert: { user_id?: string | null; household_id?: string | null; name: string; props?: Json };
        Update: never;
        Relationships: [];
      };
      admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      schools: {
        Row: {
          id: string;
          name: string;
          city: string;
          uai: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          city: string;
          uai?: string | null;
        };
        Update: {
          name?: string;
          city?: string;
          uai?: string | null;
        };
        Relationships: [];
      };
      associations: {
        Row: {
          id: string;
          name: string;
          rna_or_siren: string;
          email: string;
          manager_name: string;
          code: string;
          code_changed: boolean;
          status: Database["public"]["Enums"]["association_status"];
          reject_reason: string | null;
          iban_encrypted: string | null;
          iban_last4: string | null;
          created_by: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: {
          name?: string;
          rna_or_siren?: string;
          email?: string;
          manager_name?: string;
          code?: string;
          status?: Database["public"]["Enums"]["association_status"];
          reject_reason?: string | null;
          iban_encrypted?: string | null;
          iban_last4?: string | null;
          approved_at?: string | null;
          code_changed?: boolean;
        };
        Relationships: [];
      };
      association_schools: {
        Row: {
          association_id: string;
          school_id: string;
        };
        Insert: {
          association_id: string;
          school_id: string;
        };
        Update: never;
        Relationships: [];
      };
      association_members: {
        Row: {
          association_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["association_role"];
        };
        Insert: {
          association_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["association_role"];
        };
        Update: {
          role?: Database["public"]["Enums"]["association_role"];
        };
        Relationships: [];
      };
      association_invitations: {
        Row: {
          id: string;
          association_id: string;
          email: string;
          token: string;
          expires_at: string;
          accepted_at: string | null;
          created_by: string | null;
        };
        Insert: {
          association_id: string;
          email: string;
          created_by?: string | null;
        };
        Update: {
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      member_schools: {
        Row: {
          member_id: string;
          school_id: string;
          canteen_days: number[];
        };
        Insert: {
          member_id: string;
          school_id: string;
          canteen_days?: number[];
        };
        Update: {
          school_id?: string;
          canteen_days?: number[];
        };
        Relationships: [];
      };
      school_menus: {
        Row: {
          id: string;
          school_id: string;
          association_id: string | null;
          date: string;
          starter: string | null;
          main: string | null;
          side: string | null;
          dairy: string | null;
          dessert: string | null;
          note: string | null;
          status: "draft" | "published";
          edited_after_publish: boolean;
          published_by: string | null;
          published_at: string | null;
          updated_at: string;
        };
        Insert: {
          school_id: string;
          association_id?: string | null;
          date: string;
          starter?: string | null;
          main?: string | null;
          side?: string | null;
          dairy?: string | null;
          dessert?: string | null;
          note?: string | null;
          status?: "draft" | "published";
        };
        Update: {
          starter?: string | null;
          main?: string | null;
          side?: string | null;
          dairy?: string | null;
          dessert?: string | null;
          note?: string | null;
          status?: "draft" | "published";
        };
        Relationships: [];
      };
      canteen_notifications: {
        Row: {
          school_id: string;
          iso_week: string;
          sent_at: string;
        };
        Insert: {
          school_id: string;
          iso_week: string;
        };
        Update: never;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          household_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: "trial" | "monthly" | "yearly" | "free";
          status: string;
          trial_ends_at: string | null;
          current_period_end: string | null;
          updated_at: string;
        };
        Insert: {
          household_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: "trial" | "monthly" | "yearly" | "free";
          status?: string;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
        };
        Update: {
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: "trial" | "monthly" | "yearly" | "free";
          status?: string;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          type: string;
          received_at: string;
          payload: Json;
        };
        Insert: {
          id: string;
          type: string;
          payload: Json;
        };
        Update: never;
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          association_id: string;
          quarter: string;
          amount_cents: number;
          status: "ready" | "paid" | "carried_over";
          paid_at: string | null;
          statement_path: string | null;
        };
        Insert: {
          association_id: string;
          quarter: string;
          amount_cents: number;
          status: "ready" | "paid" | "carried_over";
          paid_at?: string | null;
          statement_path?: string | null;
        };
        Update: {
          amount_cents?: number;
          status?: "ready" | "paid" | "carried_over";
          paid_at?: string | null;
          statement_path?: string | null;
        };
        Relationships: [];
      };
      payout_lines: {
        Row: {
          id: string;
          association_id: string;
          household_id: string | null;
          stripe_invoice_id: string | null;
          kind: "yearly" | "monthly" | "refund";
          amount_cents: number;
          created_at: string;
          payout_id: string | null;
        };
        Insert: {
          association_id: string;
          household_id?: string | null;
          stripe_invoice_id?: string | null;
          kind: "yearly" | "monthly" | "refund";
          amount_cents: number;
          payout_id?: string | null;
        };
        Update: {
          payout_id?: string | null;
        };
        Relationships: [];
      };
      admin_audit: {
        Row: {
          id: number;
          admin_id: string | null;
          action: string;
          target: string | null;
          props: Json | null;
          created_at: string;
        };
        Insert: {
          admin_id?: string | null;
          action: string;
          target?: string | null;
          props?: Json | null;
        };
        Update: never;
        Relationships: [];
      };
      association_leads: {
        Row: {
          id: string;
          name: string;
          email: string;
          association_name: string;
          school: string | null;
          city: string | null;
          families_estimate: number | null;
          consent: boolean;
          created_at: string;
          contacted_at: string | null;
        };
        Insert: {
          name: string;
          email: string;
          association_name: string;
          school?: string | null;
          city?: string | null;
          families_estimate?: number | null;
          consent: boolean;
        };
        Update: {
          contacted_at?: string | null;
        };
        Relationships: [];
      };
      association_kits: {
        Row: {
          association_id: string;
          tuto_pdf_path: string | null;
          generated_at: string | null;
          source_hash: string | null;
        };
        Insert: {
          association_id: string;
          tuto_pdf_path?: string | null;
          generated_at?: string | null;
          source_hash?: string | null;
        };
        Update: {
          tuto_pdf_path?: string | null;
          generated_at?: string | null;
          source_hash?: string | null;
        };
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
          canteen: Json;
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
          canteen?: Json;
        };
        Update: {
          version?: number;
          diet?: Json;
          menu?: Json;
          session?: Json;
          shopping?: Json;
          equipment?: Json;
          canteen?: Json;
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
      household_ingredients: {
        Row: {
          key: string;
          household_id: string;
          label: string;
          unit: "g" | "ml" | "pc" | "boite" | "cs" | "cc";
          aisle: string;
          synonyms: string[];
          created_at: string;
        };
        Insert: {
          key: string;
          household_id: string;
          label: string;
          unit: "g" | "ml" | "pc" | "boite" | "cs" | "cc";
          aisle: string;
          synonyms?: string[];
        };
        Update: {
          label?: string;
          unit?: "g" | "ml" | "pc" | "boite" | "cs" | "cc";
          aisle?: string;
          synonyms?: string[];
        };
        Relationships: [];
      };
      recipe_imports: {
        Row: {
          id: string;
          household_id: string;
          url: string;
          status: "pending" | "parsed" | "failed" | "validated";
          method: "jsonld" | "microdata" | "llm" | "manual" | null;
          raw_ingredients: string[] | null;
          error: string | null;
          recipe_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          household_id: string;
          url: string;
          status?: "pending" | "parsed" | "failed" | "validated";
          method?: "jsonld" | "microdata" | "llm" | "manual" | null;
          raw_ingredients?: string[] | null;
          error?: string | null;
        };
        Update: {
          status?: "pending" | "parsed" | "failed" | "validated";
          method?: "jsonld" | "microdata" | "llm" | "manual" | null;
          raw_ingredients?: string[] | null;
          error?: string | null;
          recipe_id?: string | null;
        };
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
          source_url?: string | null;
          source_name?: string | null;
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
      is_admin: { Args: Record<string, never>; Returns: boolean };
      create_association: {
        Args: {
          p_name: string;
          p_rna: string;
          p_email: string;
          p_manager: string;
          p_code: string;
          p_schools: Json;
        };
        Returns: string;
      };
      get_association_invitation: {
        Args: { p_token: string };
        Returns: { association_name: string; status: "valid" | "expired" | "used" }[];
      };
      accept_association_invitation: { Args: { p_token: string }; Returns: string };
      association_stats: { Args: { aid: string }; Returns: Json };
      claim_notification: {
        Args: { p_user: string; p_kind: string; p_day: string; p_payload?: Json };
        Returns: boolean;
      };
    };
    Enums: {
      household_role: "admin" | "member" | "viewer";
      association_status: "pending" | "approved" | "rejected" | "suspended";
      association_role: "manager" | "menu_editor";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type HouseholdRole = Database["public"]["Enums"]["household_role"];
