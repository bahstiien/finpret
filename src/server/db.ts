import "server-only";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";
import type { DB } from "./db.types";

export type Db = Transaction<DB>;

let kysely: Kysely<DB> | undefined;

/** Pool unique par processus (et conservé entre les rechargements à chaud en dev). */
function database(): Kysely<DB> {
  const globals = globalThis as { __finpretDb?: Kysely<DB> };
  kysely ??= globals.__finpretDb;
  if (kysely) return kysely;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manque (voir .env.example).");
  const pool = new pg.Pool({ connectionString, max: 10 });
  // Par défaut, toute connexion est anonyme : une requête hors withUser/withAdmin ne voit que ce que la RLS ouvre à `anon`.
  pool.on("connect", (client) => void client.query("set role anon"));

  kysely = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  if (process.env.NODE_ENV !== "production") globals.__finpretDb = kysely;
  return kysely;
}

/** Ouvre une transaction sous un rôle Postgres, avec `auth.uid()` = userId le cas échéant. */
async function withRole<T>(
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
  return database()
    .transaction()
    .execute(async (tx) => {
      await sql`select set_config('request.jwt.claims', ${claims}, true), set_config('role', ${role}, true)`.execute(tx);
      return fn(tx);
    });
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
