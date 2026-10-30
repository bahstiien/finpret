import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { json, rpc } from "@/server/db";
import { createTestDb, type TestDb } from "./pglite-db";

describe("base de test PGlite", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);
  afterAll(() => db.close());

  it("applique les migrations et renvoie les formats de supabase-js", async () => {
    const user = await db.admin((tx) =>
      tx
        .insertInto("auth.users")
        .values({ email: "a@test.fr" })
        .returning(["id", "created_at"])
        .executeTakeFirstOrThrow(),
    );
    // Format PostgREST, microsecondes conservées (Postgres retire les zéros finaux).
    expect(user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?\+00:00$/);
    // `updated_at` sert de version : relu, il doit être égal à la valeur en base.
    const same = await db.admin((tx) =>
      tx
        .selectFrom("auth.users")
        .select("id")
        .where("id", "=", user.id)
        .where("created_at", "=", user.created_at)
        .executeTakeFirst(),
    );
    expect(same?.id).toBe(user.id);
    const profile = await db.admin((tx) =>
      tx.selectFrom("profiles").select("display_name").where("user_id", "=", user.id).executeTakeFirst(),
    );
    expect(profile?.display_name).toBe("a");
  });

  it("écrit du jsonb et appelle une fonction SQL", async () => {
    const value = await db.admin(async (tx) => {
      await tx
        .insertInto("events")
        .values({ name: "signup", props: json(["x", 1]) })
        .execute();
      return tx.selectFrom("events").select("props").executeTakeFirstOrThrow();
    });
    expect(value.props).toEqual(["x", 1]);
    expect(await db.admin((tx) => rpc<boolean>(tx, "is_admin"))).toBe(false);
  });
});
