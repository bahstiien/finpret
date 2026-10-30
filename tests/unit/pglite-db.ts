import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, types } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import {
  type DatabaseConnection,
  type Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryResult,
  sql,
} from "kysely";
import { type Db, pgTimestamp } from "@/server/db";
import type { DB } from "@/server/db.types";

/**
 * Vraie base Postgres en mémoire (PGlite) pour tester les traitements serveur : toutes les migrations appliquées,
 * mêmes formats de retour que le pool de l'application (src/server/db.ts). Remplace l'ancien faux client Supabase.
 */

const MIGRATIONS = join(process.cwd(), "supabase/migrations");

// Formats alignés sur src/server/db.ts : dates en texte, horodatages ISO à la microseconde, numeric et bigint en nombres.
const parsers = {
  [types.DATE]: (v: string) => v,
  [types.TIMESTAMPTZ]: pgTimestamp,
  [types.TIMESTAMP]: pgTimestamp,
  [types.NUMERIC]: (v: string) => Number(v),
  [types.INT8]: (v: string) => Number(v),
};

class PgliteConnection implements DatabaseConnection {
  constructor(private readonly pg: PGlite) {}
  async executeQuery<R>(query: { sql: string; parameters: readonly unknown[] }): Promise<QueryResult<R>> {
    const result = await this.pg.query<R>(query.sql, query.parameters as unknown[], { parsers });
    return {
      rows: result.rows,
      numAffectedRows: result.affectedRows === undefined ? undefined : BigInt(result.affectedRows),
    };
  }
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("streamQuery n'est pas pris en charge par PGlite.");
  }
}

/** PGlite n'a qu'une connexion : on la sert à tour de rôle. */
class PgliteDriver implements Driver {
  private queue = Promise.resolve();
  private release?: () => void;
  constructor(private readonly pg: PGlite) {}
  async init() {}
  async acquireConnection() {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((r) => (release = r));
    await previous;
    this.release = release;
    return new PgliteConnection(this.pg);
  }
  async beginTransaction(c: DatabaseConnection) {
    await c.executeQuery({ sql: "begin", parameters: [] } as never);
  }
  async commitTransaction(c: DatabaseConnection) {
    await c.executeQuery({ sql: "commit", parameters: [] } as never);
  }
  async rollbackTransaction(c: DatabaseConnection) {
    await c.executeQuery({ sql: "rollback", parameters: [] } as never);
  }
  async releaseConnection() {
    this.release?.();
  }
  async destroy() {
    await this.pg.close();
  }
}

export type TestDb = {
  /** Requêtes en `service_role` (comme withAdmin), dans une transaction validée à la fin. */
  admin<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  /** Lignes d'une table, pour les vérifications. */
  rows(table: keyof DB): Promise<Record<string, unknown>[]>;
  /** Écoute un canal NOTIFY ; renvoie la fonction d'arrêt. */
  listen(channel: string, onPayload: (payload: string) => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
};

/** Base neuve, migrations appliquées. Compter environ une seconde : à créer dans un `beforeAll`. */
export async function createTestDb(): Promise<TestDb> {
  const pg = await PGlite.create({ extensions: { pgcrypto, pg_trgm, unaccent } });
  for (const file of readdirSync(MIGRATIONS).sort())
    await pg.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  const kysely = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new PgliteDriver(pg),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return {
    admin: (fn) =>
      kysely.transaction().execute(async (tx) => {
        await sql`set local role service_role`.execute(tx);
        return fn(tx);
      }),
    rows: async (table) =>
      (await sql<Record<string, unknown>>`select * from ${sql.table(table)}`.execute(kysely)).rows,
    listen: (channel, onPayload) => pg.listen(channel, onPayload),
    close: () => kysely.destroy(),
  };
}
