import { describe, expect, it } from "vitest";
import { enqueue, type NewItem, type QueuedOp } from "./offline-queue";

const item = (id: string): NewItem => ({
  id,
  household_id: "h",
  week_id: "w",
  source: "manual",
  ingredient_key: null,
  label: "Pain",
  qty_text: null,
  aisle: "boulangerie",
});

describe("file hors ligne des courses", () => {
  it("garde la dernière coche d'un article", () => {
    let q: QueuedOp[] = [];
    q = enqueue(q, { op: "check", id: "a", checked: true });
    q = enqueue(q, { op: "check", id: "b", checked: true });
    q = enqueue(q, { op: "check", id: "a", checked: false });
    expect(q).toEqual([
      { op: "check", id: "b", checked: true },
      { op: "check", id: "a", checked: false },
    ]);
  });

  it("annule un ajout suivi de sa suppression", () => {
    let q: QueuedOp[] = [];
    q = enqueue(q, { op: "add", item: item("n") });
    q = enqueue(q, { op: "check", id: "n", checked: true });
    q = enqueue(q, { op: "delete", id: "n" });
    expect(q).toEqual([]);
  });

  it("supprime un article existant une seule fois, sans coche en attente", () => {
    let q: QueuedOp[] = [];
    q = enqueue(q, { op: "check", id: "x", checked: true });
    q = enqueue(q, { op: "delete", id: "x" });
    q = enqueue(q, { op: "delete", id: "x" });
    expect(q).toEqual([{ op: "delete", id: "x" }]);
  });

  it("conserve l'ordre ajout puis coche d'un nouvel article", () => {
    let q: QueuedOp[] = [];
    q = enqueue(q, { op: "add", item: item("n") });
    q = enqueue(q, { op: "check", id: "n", checked: true });
    expect(q.map((x) => x.op)).toEqual(["add", "check"]);
  });
});
