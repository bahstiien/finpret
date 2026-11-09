import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildCatalogRows, validateSeed } from "@/engine/catalog";
import { rawSeed } from "@/engine/catalog/seed-files";
import { createTestDb, type TestDb } from "./pglite-db";

let testDb: TestDb;
let user = { id: "", email: "parent@test.local" };
let householdId = "";
const sent: { subject: string }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  withAdmin: (fn: Parameters<TestDb["admin"]>[0]) => testDb.admin(fn),
}));
vi.mock("@/server/session", () => ({
  requireHousehold: async () => ({ user, household: { id: householdId, role: "admin" } }),
}));
vi.mock("@/server/emails", () => ({
  sendContactMessage: async (_to: string, input: { subject: string }) => {
    sent.push(input);
    return { ok: true };
  },
}));
vi.mock("@/server/admin", () => ({
  requireOwner: async () => ({ user, role: "owner" }),
  audit: async () => {},
}));

import { saveCatalogRecipe, setSuggestionStatus } from "@/server/actions/admin-recipes";
import { sendRecipeSuggestion } from "@/server/actions/recipe-suggestions";
import { navBadges } from "@/server/admin-board";
import { listSuggestions, searchCatalog } from "@/server/recipe-suggestions";
import { json } from "@/server/db";

const rows = buildCatalogRows(validateSeed(rawSeed).seed!);
const croque = rows.recipes.find((r) => r.id === "croque")!;

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};

beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.admin(async (db) => {
    const u = await db
      .insertInto("auth.users")
      .values({ email: user.email })
      .returning("id")
      .executeTakeFirstOrThrow();
    user = { ...user, id: u.id };
    const h = await db
      .insertInto("households")
      .values({ name: "Foyer test", created_by: u.id })
      .returning("id")
      .executeTakeFirstOrThrow();
    householdId = h.id;
    await db.insertInto("aisles").values(rows.aisles).execute();
    await db
      .insertInto("ingredients")
      .values(rows.ingredients.map((i) => ({ ...i, unit: i.unit as "g", forms: json(i.forms) })))
      .execute();
    await db
      .insertInto("recipes")
      .values({ ...croque, data: json(croque.data), protein: croque.protein })
      .execute();
  });
}, 60_000);
afterAll(() => testDb.close());

describe("suggestions de recettes", () => {
  it("enregistre une correction et une nouvelle recette, signalées à l'équipe et dans le menu", async () => {
    const edit = await sendRecipeSuggestion({
      kind: "edit",
      recipeId: "croque",
      message: "Sans jambon, c'est aussi très bon.",
    });
    expect(edit.ok).toBe(true);
    const add = await sendRecipeSuggestion({
      kind: "new",
      recipeKind: "simple",
      title: "Omelette aux herbes",
      message: "4 œufs, ciboulette, persil. Battre, cuire 5 min.",
      sourceUrl: "",
    });
    expect(add.ok).toBe(true);
    expect(sent.map((s) => s.subject)).toEqual([
      "Modification suggérée : Croque-madame à l'air fryer et salade verte",
      "Nouvelle recette proposée : Omelette aux herbes",
    ]);
    expect((await navBadges()).recipes).toBe(2);
    const { rows: list, counts } = await listSuggestions({ status: "new" });
    expect(counts.new).toBe(2);
    expect(list.find((s) => s.kind === "edit")).toMatchObject({ email: user.email, recipe_id: "croque" });
  });

  it("refuse une recette hors catalogue et un message vide", async () => {
    expect(
      await sendRecipeSuggestion({ kind: "edit", recipeId: "inexistante", message: "Une idée." }),
    ).toEqual({
      ok: false,
      error: expect.stringContaining("plus dans la bibliothèque"),
    });
    expect((await sendRecipeSuggestion({ kind: "edit", recipeId: "croque", message: " " })).ok).toBe(false);
  });

  it("applique la correction au catalogue : régime recalculé, suggestion appliquée, seed averti", async () => {
    const { rows: list } = await listSuggestions({ status: "new" });
    const suggestion = list.find((s) => s.kind === "edit")!;
    const data = {
      ...croque.data,
      ing: { painmie: 8, emmental: 120, oeufs: 4, salade: 1 },
      steps: ["Monte {painmie} avec {emmental}.", "Cuis {oeufs} au plat et sers avec {salade}."],
    };
    const bad = await saveCatalogRecipe(
      form({ mode: "edit", kind: "simple", id: "croque", data: "{", suggestion: String(suggestion.id) }),
    );
    expect(bad.ok).toBe(false);
    const res = await saveCatalogRecipe(
      form({
        mode: "edit",
        kind: "simple",
        id: "croque",
        data: JSON.stringify(data),
        active: "on",
        suggestion: String(suggestion.id),
      }),
    );
    expect(res).toEqual({ ok: true, data: { id: "croque" } });
    const recipe = (await testDb.rows("recipes")).find((r) => r.id === "croque")!;
    expect(recipe.diet_tags).toContain("vegetarien");
    expect(recipe.edited_in_admin_at).not.toBeNull();
    const after = await listSuggestions({ status: "accepted" });
    expect(after.rows.map((s) => [s.id, s.applied_recipe_id])).toEqual([[suggestion.id, "croque"]]);
    expect((await searchCatalog({ edited: true })).map((r) => r.id)).toEqual(["croque"]);
  });

  it("ajoute une nouvelle recette à la bibliothèque sans écraser un identifiant pris", async () => {
    const { rows: list } = await listSuggestions({ status: "new" });
    const suggestion = list.find((s) => s.kind === "new")!;
    const data = {
      n: "Omelette aux herbes et salade",
      s: "Omelette aux herbes",
      o: "fr",
      m: [380, 22, 6, 28],
      diff: 1,
      ing: { oeufs: 8, salade: 1 },
      steps: ["Bats {oeufs} et cuis l'omelette 5 min.", "Sers avec {salade}."],
    };
    const taken = await saveCatalogRecipe(
      form({ mode: "new", kind: "simple", id: "croque", data: JSON.stringify(data), active: "on" }),
    );
    expect(taken).toEqual({ ok: false, error: "L'identifiant « croque » est déjà pris." });
    const res = await saveCatalogRecipe(
      form({
        mode: "new",
        kind: "simple",
        id: "omelette_herbes",
        data: JSON.stringify(data),
        active: "on",
        suggestion: String(suggestion.id),
      }),
    );
    expect(res.ok).toBe(true);
    const recipe = (await testDb.rows("recipes")).find((r) => r.id === "omelette_herbes")!;
    expect(recipe).toMatchObject({ kind: "simple", household_id: null, is_active: true, protein: "veg" });
    expect((await navBadges()).recipes).toBe(0);
  });

  it("refuse puis remet à traiter une suggestion", async () => {
    const add = await sendRecipeSuggestion({
      kind: "new",
      recipeKind: "cake",
      title: "Cookies",
      message: "Farine, beurre, sucre, pépites.",
    });
    expect(add.ok).toBe(true);
    const s = (await listSuggestions({ status: "new" })).rows[0]!;
    await setSuggestionStatus(form({ id: String(s.id), status: "rejected" }));
    expect((await listSuggestions({ status: "rejected" })).rows.map((r) => r.id)).toEqual([s.id]);
    await setSuggestionStatus(form({ id: String(s.id), status: "new" }));
    expect((await navBadges()).recipes).toBe(1);
  });
});
