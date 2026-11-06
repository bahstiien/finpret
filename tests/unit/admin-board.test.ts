import { describe, expect, it } from "vitest";
import {
  dailySeries,
  deltaPct,
  guessCategory,
  isOverdue,
  sortTasks,
  tagSchema,
  taskFromRoadmap,
  taskSchema,
} from "@/lib/admin-board";

describe("todolist du back-office", () => {
  it("valide une action et transforme les champs vides en null", () => {
    expect(
      taskSchema.parse({ title: "  Post Instagram ", category: "social", due_on: "", details: "" }),
    ).toEqual({
      title: "Post Instagram",
      category: "social",
      priority: "normal",
      due_on: null,
      details: null,
    });
    expect(taskSchema.safeParse({ title: "", category: "dev" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "X", category: "compta" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "X", category: "dev", due_on: "31/12/2026" }).success).toBe(false);
  });

  it("trie par priorité, puis échéance (sans échéance en dernier), puis ancienneté", () => {
    const t = (id: number, priority: "high" | "normal" | "low", due_on: string | null) => ({
      id,
      priority,
      due_on,
    });
    const sorted = sortTasks([
      t(1, "low", "2026-11-10"),
      t(2, "normal", null),
      t(3, "normal", "2026-12-01"),
      t(4, "high", null),
    ]);
    expect(sorted.map((x) => x.id)).toEqual([4, 3, 2, 1]);
  });

  it("signale une action ouverte dont l'échéance est passée", () => {
    expect(isOverdue({ status: "todo", due_on: "2026-11-05" }, "2026-11-06")).toBe(true);
    expect(isOverdue({ status: "done", due_on: "2026-11-05" }, "2026-11-06")).toBe(false);
    expect(isOverdue({ status: "doing", due_on: "2026-11-06" }, "2026-11-06")).toBe(false);
    expect(isOverdue({ status: "todo", due_on: null }, "2026-11-06")).toBe(false);
  });
});

describe("séries des graphiques", () => {
  it("complète les jours manquants par 0 et finit à aujourd'hui", () => {
    const s = dailySeries([{ day: "2026-11-05", n: "3" }], 3, "2026-11-06");
    expect(s).toEqual([
      { day: "2026-11-04", n: 0 },
      { day: "2026-11-05", n: 3 },
      { day: "2026-11-06", n: 0 },
    ]);
  });

  it("calcule l'évolution d'une période à l'autre", () => {
    expect(deltaPct(15, 10)).toBe(50);
    expect(deltaPct(5, 10)).toBe(-50);
    expect(deltaPct(3, 0)).toBeNull();
  });
});

describe("roadmap Notion", () => {
  const item = {
    pageId: "p1",
    url: "https://www.notion.so/p1",
    title: "Search Console et Bing : propriété, sitemap",
    status: "À vérifier",
    priority: "P1",
    phase: "2 Avant le gel",
    who: "Toi",
    type: "Action",
    due: "2026-12-18",
    notes: "Ajouter le sitemap.",
  };

  it("convertit une ligne en action (statut, priorité, échéance, contexte)", () => {
    expect(taskFromRoadmap(item)).toEqual({
      title: "Search Console et Bing : propriété, sitemap",
      details: "2 Avant le gel · Qui : Toi · Action · À vérifier\n\nAjouter le sitemap.",
      status: "doing",
      priority: "high",
      due_on: "2026-12-18",
      notion_page_id: "p1",
      notion_url: "https://www.notion.so/p1",
    });
    expect(taskFromRoadmap({ ...item, status: "Abandonné" })).toBeNull();
    expect(taskFromRoadmap({ ...item, status: "Idée", priority: "P3" })).toMatchObject({
      status: "todo",
      priority: "low",
    });
    expect(taskFromRoadmap({ ...item, status: "Fait", priority: null })).toMatchObject({
      status: "done",
      priority: "normal",
    });
  });

  it("devine la catégorie à partir du titre", () => {
    expect(guessCategory("Search Console et Bing")).toBe("marketing");
    expect(guessCategory("Publier le carrousel sur Instagram")).toBe("social");
    expect(guessCategory("Jouer Playwright complet et corriger")).toBe("dev");
  });
});

describe("étiquettes", () => {
  it("nettoie l'étiquette saisie et limite sa longueur", () => {
    expect(tagSchema.parse("  bêta   testeur ")).toBe("bêta testeur");
    expect(tagSchema.safeParse("   ").success).toBe(false);
    expect(tagSchema.safeParse("x".repeat(31)).success).toBe(false);
  });
});
