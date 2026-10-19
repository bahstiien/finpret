import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client Supabase avec la clé de service : contourne la RLS. Réservé au serveur, pour les opérations
 * que la RLS ne permet pas à un compte (suppression de son compte d'authentification, tâches planifiées).
 * Jamais dans le navigateur (CLAUDE.md, règle 3).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manque (voir .env.example).");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
