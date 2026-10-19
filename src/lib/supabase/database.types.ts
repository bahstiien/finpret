// Types de la base. À régénérer avec `pnpm db:types` (Supabase local démarré) après chaque migration.
// TODO(M1) : écrit à la main en attendant Docker ; remplacer par la sortie de `pnpm db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      households: {
        Row: { id: string; name: string; created_by: string | null; created_at: string };
        Insert: never;
        Update: { name?: string };
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
      household_role_of: { Args: { hid: string }; Returns: Database["public"]["Enums"]["household_role"] };
    };
    Enums: { household_role: "admin" | "member" | "viewer" };
    CompositeTypes: { [_ in never]: never };
  };
};

export type HouseholdRole = Database["public"]["Enums"]["household_role"];
