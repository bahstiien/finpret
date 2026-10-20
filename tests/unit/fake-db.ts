import type { Db } from "@/lib/supabase/types";

type Row = Record<string, unknown>;
type Filter = { col: string; op: "eq" | "neq" | "is" | "lt" | "in"; val: unknown };

/**
 * Base en mémoire pour tester les traitements serveur sans Supabase : un sous-ensemble de l'API (from, insert,
 * update, delete, select, eq, neq, maybeSingle, single) et les contraintes d'unicité utiles aux reversements.
 */
export function createFakeDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }));
  const table = (name: string) => (tables[name] ??= []);

  const unique = (name: string, existing: Row[], row: Row): boolean => {
    if (name === "stripe_events") return existing.some((r) => r.id === row.id);
    if (name === "payout_lines" && row.kind !== "refund") {
      return existing.some(
        (r) => r.stripe_invoice_id === row.stripe_invoice_id && r.kind === row.kind && r.kind !== "refund",
      );
    }
    return false;
  };

  const match = (row: Row, filters: Filter[]) =>
    filters.every((f) => {
      const v = row[f.col];
      if (f.op === "eq") return v === f.val;
      if (f.op === "neq") return v !== f.val;
      if (f.op === "is") return (v ?? null) === f.val;
      if (f.op === "lt") return String(v) < String(f.val);
      return (f.val as unknown[]).includes(v);
    });

  function builder(name: string) {
    let mode: "select" | "update" | "delete" | "insert" = "select";
    let values: Row = {};
    const filters: Filter[] = [];
    const run = () => {
      const rows = table(name);
      if (mode === "insert") {
        if (unique(name, rows, values))
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        // Les tables à identifiant généré par la base (uuid) reçoivent le leur.
        const generated =
          ["payouts", "payout_lines"].includes(name) && !("id" in values) ? { id: crypto.randomUUID() } : {};
        rows.push({ ...generated, ...values });
        return { data: null, error: null };
      }
      const hit = rows.filter((r) => match(r, filters));
      if (mode === "update") {
        for (const r of hit) Object.assign(r, values);
        return { data: null, error: null };
      }
      if (mode === "delete") {
        tables[name] = rows.filter((r) => !match(r, filters));
        return { data: null, error: null };
      }
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const api = {
      insert(v: Row) {
        mode = "insert";
        values = v;
        return api;
      },
      update(v: Row) {
        mode = "update";
        values = v;
        return api;
      },
      delete() {
        mode = "delete";
        return api;
      },
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, op: "eq", val });
        return api;
      },
      neq(col: string, val: unknown) {
        filters.push({ col, op: "neq", val });
        return api;
      },
      is(col: string, val: unknown) {
        filters.push({ col, op: "is", val });
        return api;
      },
      lt(col: string, val: unknown) {
        filters.push({ col, op: "lt", val });
        return api;
      },
      in(col: string, val: unknown[]) {
        filters.push({ col, op: "in", val });
        return api;
      },
      maybeSingle: async () => {
        const res = run();
        const data = (res.data as Row[] | null)?.[0] ?? null;
        return { data, error: res.error };
      },
      single: async () => {
        const res = run();
        const data = (res.data as Row[] | null)?.[0] ?? null;
        return { data, error: data ? null : { code: "PGRST116", message: "no rows" } };
      },
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return api;
  }

  const db = { from: (name: string) => builder(name) } as unknown as Db;
  return { db, tables, table };
}
