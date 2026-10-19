import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Client Supabase côté serveur (composants serveur, actions, route handlers), lié à la session de l'utilisateur. */
export async function createClient() {
  // Lire les cookies d'abord : la route devient dynamique avant toute autre vérification.
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un composant serveur : les cookies sont rafraîchis par le middleware (M1).
        }
      },
    },
  });
}
