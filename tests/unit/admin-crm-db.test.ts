import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { json } from "@/server/db";
import type { RoadmapItem } from "@/lib/admin-board";
import { createTestDb, type TestDb } from "./pglite-db";

let testDb: TestDb;

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  withAdmin: (fn: Parameters<TestDb["admin"]>[0]) => testDb.admin(fn),
}));

import { contactSheet, segmentMembers, tagsFor } from "@/server/admin-board";
import { listAccounts } from "@/server/crm";
import { applyRoadmap, roadmapItemFromPage } from "@/server/notion";

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** Compte avec foyer actif, offre et (facultatif) un menu. */
async function account(
  email: string,
  opts: { plan?: "trial" | "monthly"; trialEnds?: string; menu?: boolean; createdAt?: string },
) {
  return testDb.admin(async (db) => {
    const user = await db
      .insertInto("auth.users")
      .values({ email, ...(opts.createdAt ? { created_at: opts.createdAt } : {}) })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (!opts.plan) return user.id;
    const h = await db
      .insertInto("households")
      .values({ name: `Foyer ${email}`, created_by: user.id })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("memberships")
      .values({ household_id: h.id, user_id: user.id, role: "admin" })
      .onConflict((oc) => oc.doNothing())
      .execute();
    await db
      .insertInto("profiles")
      .values({ user_id: user.id, active_household: h.id })
      .onConflict((oc) => oc.column("user_id").doUpdateSet({ active_household: h.id }))
      .execute();
    await db
      .updateTable("subscriptions")
      .set({ plan: opts.plan, status: "active", trial_ends_at: opts.trialEnds ?? null })
      .where("household_id", "=", h.id)
      .execute();
    if (opts.menu)
      await db
        .insertInto("weeks")
        .values({ household_id: h.id, start_date: "2026-11-02", status: "active", plan: json({}) })
        .execute();
    return user.id;
  });
}

let ids: Record<string, string> = {};

beforeAll(async () => {
  testDb = await createTestDb();
  ids = {
    trialNoMenu: await account("essai-sans-menu@test.fr", { plan: "trial", trialEnds: days(3) }),
    trialActive: await account("essai-engage@test.fr", { plan: "trial", trialEnds: days(10), menu: true }),
    paidIdle: await account("payant@test.fr", { plan: "monthly" }),
    orphan: await account("sans-foyer@test.fr", { createdAt: days(-5) }),
    fresh: await account("tout-neuf@test.fr", {}),
  };
}, 60_000);
afterAll(() => testDb.close());

describe("segments", () => {
  it("range chaque compte dans le bon segment", async () => {
    const emails = async (k: Parameters<typeof segmentMembers>[0]) =>
      (await segmentMembers(k)).map((m) => m.email);
    expect(await emails("trial_no_menu")).toEqual(["essai-sans-menu@test.fr"]);
    expect(await emails("trial_active")).toEqual(["essai-engage@test.fr"]);
    expect(await emails("paid_inactive")).toEqual(["payant@test.fr"]);
    // Un compte créé il y a moins de 2 jours n'est pas encore « sans foyer ».
    expect(await emails("no_household")).toEqual(["sans-foyer@test.fr"]);
  });
});

describe("étiquettes et fiche contact", () => {
  it("filtre les comptes par étiquette", async () => {
    await testDb.admin((db) =>
      db
        .insertInto("account_tags")
        .values([
          { user_id: ids.paidIdle!, tag: "VIP" },
          { user_id: ids.paidIdle!, tag: "ambassadeur" },
          { user_id: ids.trialActive!, tag: "ambassadeur" },
        ])
        .execute(),
    );
    const { rows } = await listAccounts({ tag: "VIP", page: 1 });
    expect(rows.map((r) => r.email)).toEqual(["payant@test.fr"]);
    expect((await tagsFor([ids.paidIdle!])).get(ids.paidIdle!)).toEqual(["VIP", "ambassadeur"]);
  });

  it("rassemble compte, foyers, demandes et prospect d'une même adresse (casse ignorée)", async () => {
    await testDb.admin(async (db) => {
      await db
        .insertInto("contact_messages")
        .values({
          audience: "asso",
          name: "Léa",
          email: "Payant@Test.fr",
          subject: "Partenariat",
          message: "Bonjour !",
        })
        .execute();
      await db
        .insertInto("association_leads")
        .values({ name: "Léa", email: "payant@test.fr", association_name: "APE Jules Ferry", consent: true })
        .execute();
    });
    const d = await contactSheet("PAYANT@test.fr");
    expect(d.user?.id).toBe(ids.paidIdle);
    expect(d.households).toHaveLength(1);
    expect(d.tags).toEqual(["VIP", "ambassadeur"]);
    expect(d.messages.map((m) => m.subject)).toEqual(["Partenariat"]);
    expect(d.leads.map((l) => [l.association_name, l.stage])).toEqual([["APE Jules Ferry", "to_contact"]]);
    expect(d.timeline.map((e) => e.label)).toContain("Inscription");
  });

  it("ouvre une fiche sans compte à partir d'une simple demande", async () => {
    const d = await contactSheet("inconnu@test.fr");
    expect(d.user).toBeNull();
    expect(d.timeline).toEqual([]);
  });
});

describe("synchronisation de la roadmap Notion", () => {
  const item = (pageId: string, over: Partial<RoadmapItem> = {}): RoadmapItem => ({
    pageId,
    url: `https://www.notion.so/${pageId}`,
    title: `Ligne ${pageId}`,
    status: "À faire",
    priority: "P2",
    phase: null,
    who: null,
    type: null,
    due: null,
    notes: null,
    ...over,
  });
  const tasks = () =>
    testDb.admin((db) =>
      db
        .selectFrom("admin_tasks")
        .select(["notion_page_id", "title", "status", "category", "done_at"])
        .where("notion_page_id", "is not", null)
        .orderBy("notion_page_id")
        .execute(),
    );

  it("crée, met à jour sans toucher la catégorie, et retire les lignes abandonnées ou disparues", async () => {
    expect(
      await testDb.admin((db) =>
        applyRoadmap(db, [
          item("a", { title: "Post Instagram de lancement" }),
          item("b"),
          item("c", { status: "Abandonné" }),
        ]),
      ),
    ).toEqual({ created: 2, updated: 0, removed: 0 });
    expect((await tasks()).map((t) => [t.notion_page_id, t.category, t.status])).toEqual([
      ["a", "social", "todo"],
      ["b", "dev", "todo"],
    ]);

    // Catégorie corrigée dans le back-office : elle survit à la synchronisation suivante.
    await testDb.admin((db) =>
      db
        .updateTable("admin_tasks")
        .set({ category: "marketing" })
        .where("notion_page_id", "=", "b")
        .execute(),
    );
    expect(
      await testDb.admin((db) =>
        applyRoadmap(db, [item("a", { status: "Fait" }), item("b", { title: "Renommée" })]),
      ),
    ).toEqual({ created: 0, updated: 2, removed: 0 });
    const [a, b] = await tasks();
    expect(a).toMatchObject({ status: "done", title: "Ligne a" });
    expect(a!.done_at).not.toBeNull();
    expect(b).toMatchObject({ title: "Renommée", category: "marketing" });

    expect(await testDb.admin((db) => applyRoadmap(db, [item("a", { status: "Abandonné" })]))).toEqual({
      created: 0,
      updated: 0,
      removed: 2,
    });
    expect(await tasks()).toEqual([]);
  });

  it("lit les propriétés d'une page de l'API Notion", () => {
    const t = (s: string) => [{ plain_text: s }];
    expect(
      roadmapItemFromPage({
        id: "p",
        url: "u",
        properties: {
          Nom: { type: "title", title: t("Stripe en mode réel") },
          Statut: { type: "status", status: { name: "En cours" } },
          Priorité: { type: "select", select: { name: "P0 bloquant" } },
          Phase: { type: "select", select: null },
          Échéance: { type: "date", date: { start: "2027-01-02" } },
          Notes: { type: "rich_text", rich_text: [] },
        },
      }),
    ).toMatchObject({
      title: "Stripe en mode réel",
      status: "En cours",
      priority: "P0 bloquant",
      phase: null,
      due: "2027-01-02",
      notes: null,
    });
  });
});
