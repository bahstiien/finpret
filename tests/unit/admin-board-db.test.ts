import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./pglite-db";

let testDb: TestDb;

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  withAdmin: (fn: Parameters<TestDb["admin"]>[0]) => testDb.admin(fn),
}));

import {
  contactMessagesFor,
  dashboardData,
  listContactMessages,
  listTasks,
  navBadges,
} from "@/server/admin-board";

beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.admin(async (db) => {
    await db
      .insertInto("contact_messages")
      .values([
        {
          audience: "famille",
          name: "Camille",
          email: "Camille@Test.local",
          subject: "Mon essai",
          message: "Bonjour, une question.",
        },
        {
          audience: "asso",
          name: "Léa",
          email: "lea@test.local",
          subject: "Partenariat",
          message: "Nous sommes une APE.",
          status: "done",
        },
        {
          audience: "famille",
          name: "Bot",
          email: "bot@test.local",
          subject: "Promo",
          message: "Achetez maintenant !",
          status: "spam",
        },
      ])
      .execute();
    await db
      .insertInto("admin_tasks")
      .values([
        { title: "Corriger l'export CSV", category: "dev", priority: "high" },
        { title: "Post Instagram", category: "social", status: "done", done_at: new Date().toISOString() },
        { title: "Vieille action", category: "marketing", status: "done", done_at: "2026-01-01T00:00:00Z" },
      ])
      .execute();
  });
}, 60_000);
afterAll(() => testDb.close());

describe("données du back-office", () => {
  it("compte les demandes nouvelles et les actions ouvertes pour le menu", async () => {
    expect(await navBadges()).toEqual({ inbox: 1, tasks: 1 });
  });

  it("liste les demandes sans les indésirables, avec les compteurs par état", async () => {
    const { rows, counts } = await listContactMessages({});
    expect(rows.map((r) => r.subject).sort()).toEqual(["Mon essai", "Partenariat"]);
    expect(counts).toEqual({ new: 1, done: 1, spam: 1 });
    expect((await listContactMessages({ status: "spam" })).rows).toHaveLength(1);
    expect((await listContactMessages({ q: "APE" })).rows.map((r) => r.name)).toEqual(["Léa"]);
  });

  it("retrouve les demandes d'un compte sans tenir compte de la casse", async () => {
    expect(await contactMessagesFor("camille@test.local")).toHaveLength(1);
  });

  it("masque les actions faites depuis plus de 30 jours", async () => {
    expect((await listTasks()).map((t) => t.title).sort()).toEqual([
      "Corriger l'export CSV",
      "Post Instagram",
    ]);
  });

  it("calcule les données du tableau de bord", async () => {
    const d = await dashboardData();
    expect(d.newContactCount).toBe(1);
    expect(d.contactsWeekly.reduce((s, w) => s + w.n, 0)).toBe(2);
    expect(d.openTasks.map((t) => t.title)).toEqual(["Corriger l'export CSV"]);
    expect(d.tasksByCategory).toContainEqual({ category: "social", status: "done", n: 1 });
  });
});
