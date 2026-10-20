import { describe, expect, it, vi } from "vitest";
import { closeQuarter } from "@/server/payouts";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/server/emails";
import { createFakeDb } from "./fake-db";

vi.mock("@/server/events", () => ({ trackEvent: vi.fn(async () => {}) }));

const line = (id: string, asso: string, kind: string, cents: number, at: string) => ({
  id,
  association_id: asso,
  kind,
  amount_cents: cents,
  created_at: at,
  payout_id: null,
});

function setup() {
  return createFakeDb({
    associations: [
      { id: "a", name: "APE A", email: "a@ape.test" },
      { id: "b", name: "APE B", email: "b@ape.test" },
    ],
    payout_lines: [
      // A : 3 annuels (24 €) → versé. B : 1 annuel + 2 mensuels (9 €) → reporté.
      line("l1", "a", "yearly", 800, "2027-01-10T10:00:00Z"),
      line("l2", "a", "yearly", 800, "2027-02-10T10:00:00Z"),
      line("l3", "a", "yearly", 800, "2027-03-10T10:00:00Z"),
      line("l4", "b", "yearly", 800, "2027-01-15T10:00:00Z"),
      line("l5", "b", "monthly", 50, "2027-02-15T10:00:00Z"),
      line("l6", "b", "monthly", 50, "2027-03-15T10:00:00Z"),
      // Hors trimestre : ne compte pas.
      line("l7", "a", "yearly", 800, "2027-04-02T10:00:00Z"),
    ],
  });
}

const deps = () => {
  const statements: string[] = [];
  const notified: string[] = [];
  return {
    statements,
    notified,
    deps: {
      writeStatement: async (i: { associationId: string; quarter: string }) => {
        statements.push(i.associationId);
        return `${i.associationId}/${i.quarter}.pdf`;
      },
      notifyReady: async (i: { associationId: string }) => {
        notified.push(i.associationId);
      },
    },
  };
};

describe("clôture trimestrielle", () => {
  it("verse dès 20 €, reporte sinon, et n'oublie aucune ligne du trimestre", async () => {
    const w = setup();
    const d = deps();
    const summary = await closeQuarter(w.db, "2027-T1", d.deps);
    expect(summary).toMatchObject({ created: 2, ready: 1, carried: 1 });
    const payouts = w.table("payouts");
    expect(payouts.find((p) => p.association_id === "a")).toMatchObject({
      status: "ready",
      amount_cents: 2400,
      statement_path: "a/2027-T1.pdf",
    });
    expect(payouts.find((p) => p.association_id === "b")).toMatchObject({
      status: "carried_over",
      amount_cents: 900,
    });
    expect(d.statements).toEqual(["a"]);
    expect(d.notified).toEqual(["a"]);
  });

  it("les lignes versées sont rattachées au versement, les reportées restent libres", async () => {
    const w = setup();
    await closeQuarter(w.db, "2027-T1", deps().deps);
    const lines = w.table("payout_lines");
    expect(lines.filter((l) => l.association_id === "a" && l.id !== "l7").every((l) => l.payout_id)).toBe(
      true,
    );
    expect(lines.filter((l) => l.association_id === "b").every((l) => l.payout_id === null)).toBe(true);
    expect(lines.find((l) => l.id === "l7")?.payout_id).toBeNull();
  });

  it("un second passage ne recrée aucun versement", async () => {
    const w = setup();
    await closeQuarter(w.db, "2027-T1", deps().deps);
    const again = await closeQuarter(w.db, "2027-T1", deps().deps);
    expect(again.created).toBe(0);
    expect(w.table("payouts")).toHaveLength(2);
  });

  it("le montant reporté s'ajoute au trimestre suivant", async () => {
    const w = setup();
    await closeQuarter(w.db, "2027-T1", deps().deps);
    w.table("payout_lines").push(line("l8", "b", "yearly", 800, "2027-05-02T10:00:00Z"));
    w.table("payout_lines").push(line("l9", "b", "yearly", 800, "2027-06-02T10:00:00Z"));
    await closeQuarter(w.db, "2027-T2", deps().deps);
    expect(w.table("payouts").find((p) => p.association_id === "b" && p.quarter === "2027-T2")).toMatchObject(
      {
        status: "ready",
        amount_cents: 2500,
      },
    );
  });

  it("un remboursement vient en déduction du total", async () => {
    const w = setup();
    w.table("payout_lines").push(line("l10", "a", "refund", -800, "2027-03-20T10:00:00Z"));
    await closeQuarter(w.db, "2027-T1", deps().deps);
    expect(w.table("payouts").find((p) => p.association_id === "a")).toMatchObject({
      amount_cents: 1600,
      status: "carried_over",
    });
  });
});

describe("désinscription", () => {
  it("le jeton se vérifie pour le bon compte seulement", () => {
    const token = unsubscribeToken("user-1", "secret");
    expect(verifyUnsubscribeToken("user-1", token, "secret")).toBe(true);
    expect(verifyUnsubscribeToken("user-2", token, "secret")).toBe(false);
    expect(verifyUnsubscribeToken("user-1", token, "autre")).toBe(false);
    expect(verifyUnsubscribeToken("user-1", "court", "secret")).toBe(false);
  });
});
