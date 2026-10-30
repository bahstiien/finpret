import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeQuarter } from "@/server/payouts";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/server/emails";
import { createTestDb, type TestDb } from "./pglite-db";

vi.mock("@/server/events", () => ({ trackEvent: vi.fn(async () => {}) }));

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const id = (n: number) => `00000000-0000-4000-8000-1000000000${String(n).padStart(2, "0")}`;

const line = (n: number, asso: string, kind: "yearly" | "monthly" | "refund", cents: number, at: string) => ({
  id: id(n),
  association_id: asso,
  kind,
  amount_cents: cents,
  created_at: at,
  payout_id: null,
});

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());

beforeEach(async () => {
  await db.admin(async (tx) => {
    await tx.deleteFrom("payout_lines").execute();
    await tx.deleteFrom("payouts").execute();
    await tx.deleteFrom("associations").execute();
    await tx
      .insertInto("associations")
      .values([
        {
          id: A,
          name: "APE A",
          email: "a@ape.test",
          rna_or_siren: "W123456789",
          manager_name: "Alice",
          code: "APE-A",
        },
        {
          id: B,
          name: "APE B",
          email: "b@ape.test",
          rna_or_siren: "W987654321",
          manager_name: "Bob",
          code: "APE-B",
        },
      ])
      .execute();
    await tx
      .insertInto("payout_lines")
      .values([
        // A : 3 annuels (24 €) → versé. B : 1 annuel + 2 mensuels (9 €) → reporté.
        line(1, A, "yearly", 800, "2027-01-10T10:00:00Z"),
        line(2, A, "yearly", 800, "2027-02-10T10:00:00Z"),
        line(3, A, "yearly", 800, "2027-03-10T10:00:00Z"),
        line(4, B, "yearly", 800, "2027-01-15T10:00:00Z"),
        line(5, B, "monthly", 50, "2027-02-15T10:00:00Z"),
        line(6, B, "monthly", 50, "2027-03-15T10:00:00Z"),
        // Hors trimestre : ne compte pas.
        line(7, A, "yearly", 800, "2027-04-02T10:00:00Z"),
      ])
      .execute();
  });
});

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

const close = (quarter: string, d = deps().deps) => db.admin((tx) => closeQuarter(tx, quarter, d));
const addLines = (...rows: ReturnType<typeof line>[]) =>
  db.admin((tx) => tx.insertInto("payout_lines").values(rows).execute());
const payouts = () => db.rows("payouts");
const lines = () => db.rows("payout_lines");

describe("clôture trimestrielle", () => {
  it("verse dès 20 €, reporte sinon, et n'oublie aucune ligne du trimestre", async () => {
    const d = deps();
    const summary = await close("2027-T1", d.deps);
    expect(summary).toMatchObject({ created: 2, ready: 1, carried: 1 });
    const rows = await payouts();
    expect(rows.find((p) => p.association_id === A)).toMatchObject({
      status: "ready",
      amount_cents: 2400,
      statement_path: `${A}/2027-T1.pdf`,
    });
    expect(rows.find((p) => p.association_id === B)).toMatchObject({
      status: "carried_over",
      amount_cents: 900,
    });
    expect(d.statements).toEqual([A]);
    expect(d.notified).toEqual([A]);
  });

  it("les lignes versées sont rattachées au versement, les reportées restent libres", async () => {
    await close("2027-T1");
    const rows = await lines();
    expect(rows.filter((l) => l.association_id === A && l.id !== id(7)).every((l) => l.payout_id)).toBe(true);
    expect(rows.filter((l) => l.association_id === B).every((l) => l.payout_id === null)).toBe(true);
    expect(rows.find((l) => l.id === id(7))?.payout_id).toBeNull();
  });

  it("un second passage ne recrée aucun versement", async () => {
    await close("2027-T1");
    const again = await close("2027-T1");
    expect(again.created).toBe(0);
    expect(await payouts()).toHaveLength(2);
  });

  it("le montant reporté s'ajoute au trimestre suivant", async () => {
    await close("2027-T1");
    await addLines(
      line(8, B, "yearly", 800, "2027-05-02T10:00:00Z"),
      line(9, B, "yearly", 800, "2027-06-02T10:00:00Z"),
    );
    await close("2027-T2");
    expect((await payouts()).find((p) => p.association_id === B && p.quarter === "2027-T2")).toMatchObject({
      status: "ready",
      amount_cents: 2500,
    });
  });

  it("un remboursement vient en déduction du total", async () => {
    await addLines(line(10, A, "refund", -800, "2027-03-20T10:00:00Z"));
    await close("2027-T1");
    expect((await payouts()).find((p) => p.association_id === A)).toMatchObject({
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
