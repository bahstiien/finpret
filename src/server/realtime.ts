import "server-only";
import pg from "pg";
import { z } from "zod";

/**
 * Temps réel : une connexion Postgres dédiée écoute `household_events`
 * (migration 20261108000000_household_events.sql) et répartit chaque notification entre les abonnés de son foyer.
 * Une seule connexion par processus, quel que soit le nombre de navigateurs ouverts.
 */

export type HouseholdEvent = { t: string; h: string; w: string | null };
type Listener = (event: HouseholdEvent) => void;

const eventSchema = z.object({ t: z.string(), h: z.string(), w: z.string().nullable() });

type Hub = {
  listeners: Map<string, Set<Listener>>;
  client: pg.Client | null;
  connecting: Promise<void> | null;
};

function hub(): Hub {
  const globals = globalThis as { __finpretRealtime?: Hub };
  return (globals.__finpretRealtime ??= { listeners: new Map(), client: null, connecting: null });
}

function dispatch(payload: string | undefined) {
  let json: unknown = null;
  try {
    json = JSON.parse(payload ?? "null");
  } catch {
    return;
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return;
  for (const listener of hub().listeners.get(parsed.data.h) ?? []) listener(parsed.data);
}

/**
 * Reconnexion toutes les 2 s tant que des navigateurs écoutent : une base qui redémarre (déploiement) peut rester
 * indisponible plus longtemps qu'une seule tentative.
 */
function reconnect() {
  setTimeout(() => {
    if (!hub().listeners.size) return;
    connect().catch(reconnect);
  }, 2_000);
}

/** Ouvre (ou rouvre après une coupure) la connexion d'écoute. */
function connect(): Promise<void> {
  const state = hub();
  if (state.client) return Promise.resolve();
  state.connecting ??= (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL manque (voir .env.example).");
    const client = new pg.Client({ connectionString });
    const reset = () => {
      if (state.client !== client) return;
      state.client = null;
      client.end().catch(() => {});
      reconnect();
    };
    client.on("notification", (msg) => dispatch(msg.payload));
    client.on("error", reset);
    client.on("end", reset);
    await client.connect();
    await client.query("listen household_events");
    state.client = client;
  })().finally(() => {
    state.connecting = null;
  });
  return state.connecting;
}

/** Abonne `listener` aux changements du foyer ; renvoie la fonction de désabonnement. */
export async function subscribeHousehold(householdId: string, listener: Listener): Promise<() => void> {
  const { listeners } = hub();
  const set = listeners.get(householdId) ?? new Set();
  set.add(listener);
  listeners.set(householdId, set);
  const unsubscribe = () => {
    set.delete(listener);
    if (!set.size) listeners.delete(householdId);
  };
  try {
    await connect();
  } catch (error) {
    // Flux refusé : l'abonné ne doit pas rester inscrit (il entretiendrait les tentatives de reconnexion).
    unsubscribe();
    throw error;
  }
  return unsubscribe;
}
