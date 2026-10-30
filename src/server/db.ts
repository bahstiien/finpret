import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Kysely, PostgresDialect, type RawBuilder, sql, type Transaction } from "kysely";
import pg from "pg";
import type { DB, Json } from "./db.types";

export type Db = Transaction<DB>;

/**
 * Horodatage Postgres (« 2026-10-29 16:33:07.569286+00 ») au format de PostgREST (« 2026-10-29T16:33:07.569286+00:00 »).
 * Sans passer par `Date`, qui perdrait les microsecondes : `updated_at` sert de numéro de version, comparé à l'égalité.
 */
export function pgTimestamp(v: string): string {
  const iso = v.replace(" ", "T");
  return /[+-]\d{2}$/.test(iso) ? `${iso}:00` : iso;
}

/**
 * Formats renvoyés par le pool, alignés sur ceux de supabase-js (PostgREST) pour ne rien changer au code appelant :
 * `date` en texte AAAA-MM-JJ, horodatages en texte ISO 8601 (UTC, microsecondes conservées), `numeric` et `bigint`
 * en nombres. Les types générés (pnpm db:types:pg) suivent les mêmes choix.
 */
const PG = pg.types.builtins;
function typeParser(oid: number, format?: string) {
  switch (oid) {
    case PG.DATE:
      return (v: string) => v;
    case PG.TIMESTAMPTZ:
    case PG.TIMESTAMP:
      return pgTimestamp;
    case PG.NUMERIC:
    case PG.INT8:
      return (v: string) => Number(v);
    default:
      return pg.types.getTypeParser(oid, format as "text");
  }
}

let kysely: Kysely<DB> | undefined;

/** Pool unique par processus (et conservé entre les rechargements à chaud en dev). */
function database(): Kysely<DB> {
  const globals = globalThis as { __finpretDb?: Kysely<DB> };
  kysely ??= globals.__finpretDb;
  if (kysely) return kysely;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manque (voir .env.example).");
  const pool = new pg.Pool({ connectionString, max: 10, types: { getTypeParser: typeParser } });
  // Par défaut, toute connexion est anonyme : une requête hors withUser/withAdmin ne voit que ce que la RLS ouvre à `anon`.
  // UTC imposé aussi par connexion : les horodatages renvoyés finissent toujours par +00:00.
  pool.on("connect", (client) => void client.query("set role anon; set timezone = 'UTC'"));

  kysely = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  if (process.env.NODE_ENV !== "production") globals.__finpretDb = kysely;
  return kysely;
}

/**
 * Transaction en cours dans ce fil d'exécution. Ouvrir une transaction à l'intérieur d'une autre prend une seconde
 * connexion pendant que la première reste tenue : sous charge, le pool s'épuise et les requêtes attendent sans fin.
 */
const openTransaction = new AsyncLocalStorage<true>();
const reportedNesting = new Set<string>();

function reportNesting() {
  const site = new Error().stack?.split("\n").slice(3, 6).join("\n") ?? "";
  if (reportedNesting.has(site)) return;
  reportedNesting.add(site);
  console.error(
    `[db] transaction ouverte dans une autre transaction (risque d'épuisement du pool) :\n${site}`,
  );
}

/** Ouvre une transaction sous un rôle Postgres, avec `auth.uid()` = userId le cas échéant. */
async function withRole<T>(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (openTransaction.getStore()) reportNesting();
  const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
  return database()
    .transaction()
    .execute((tx) =>
      openTransaction.run(true, async () => {
        await sql`select set_config('request.jwt.claims', ${claims}, true), set_config('role', ${role}, true)`.execute(
          tx,
        );
        return fn(tx);
      }),
    );
}

/** Requêtes au nom d'un utilisateur connecté : la RLS s'applique comme avec le client Supabase. */
export function withUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  return withRole("authenticated", userId, fn);
}

/** Requêtes sans utilisateur (pages publiques, invitations) : RLS du rôle `anon`. */
export function withAnon<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withRole("anon", null, fn);
}

/** Requêtes serveur privilégiées (ex-clé de service) : contourne la RLS. Jamais à partir d'une entrée non vérifiée. */
export function withAdmin<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withRole("service_role", null, fn);
}

/**
 * Valeur jsonb à écrire. Toujours passer par ici : `pg` convertit un tableau JS en tableau Postgres (text[]…),
 * pas en JSON, et l'écriture d'un tableau dans une colonne jsonb échouerait.
 */
export function json(value: Json | object): RawBuilder<Json> {
  return sql<Json>`${JSON.stringify(value)}::jsonb`;
}

const FN_NAME = /^[a-z_][a-z0-9_]*$/;

function callSql(fn: string, args: Record<string, unknown>) {
  if (!FN_NAME.test(fn)) throw new Error(`Nom de fonction invalide : ${fn}`);
  const params = Object.entries(args).map(([name, value]) => {
    if (!FN_NAME.test(name)) throw new Error(`Nom de paramètre invalide : ${name}`);
    // Objets et tableaux destinés à un paramètre jsonb : sérialisés explicitement (voir json()).
    const v =
      value !== null && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value;
    return sql`${sql.raw(name)} => ${v}`;
  });
  return sql`public.${sql.raw(fn)}(${sql.join(params)})`;
}

/**
 * Appel d'une fonction SQL qui renvoie une valeur (uuid, boolean, jsonb, void…), comme `supabase.rpc()`.
 * Arguments nommés (`{ p_name: … }`). Un tableau destiné à un paramètre `text[]` doit passer par `rpcRows` + `sql`.
 */
export async function rpc<T = unknown>(db: Db, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { rows } = await sql<{ result: T }>`select ${callSql(fn, args)} as result`.execute(db);
  return rows[0]!.result;
}

/** Appel d'une fonction SQL qui renvoie des lignes (`returns table`, `returns setof`, type composite). */
export async function rpcRows<T>(db: Db, fn: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const { rows } = await sql<T>`select * from ${callSql(fn, args)}`.execute(db);
  return rows;
}
