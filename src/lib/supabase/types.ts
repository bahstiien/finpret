import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Client Supabase typé (requête de l'utilisateur ou clé de service). */
export type Db = SupabaseClient<Database>;
