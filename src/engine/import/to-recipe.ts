import { z } from "zod";
import { CAKE_TYPES, PROTEINS, UNITS, type Cake, type Main, type Simple, type Soup } from "../catalog/schema";
import type { ImportDraft } from "./classify";

/**
 * Recette validée sur l'écran d'import (§8.8) → données au format du catalogue (seed/README.md),
 * pour qu'elle rejoigne le pool du générateur comme les autres.
 */

export const importLineSchema = z.object({
  original: z.string().max(300),
  key: z.string().max(60).nullable(),
  label: z.string().trim().min(1).max(80),
  qty: z.number().positive().max(100000).nullable(),
  unit: z.enum(UNITS),
  aisle: z.string().min(1).max(40),
  toTaste: z.boolean(),
});

export const importFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  /** null : saisie à la main. */
  sourceUrl: z.url().max(2000).nullable(),
  sourceName: z.string().trim().min(1).max(60).nullable(),
  kind: z.enum(["main", "soup", "simple", "cake"]),
  protein: z.enum(PROTEINS),
  origin: z.string().regex(/^[a-z]{2}$/),
  pasta: z.boolean(),
  comfort: z.boolean(),
  oven: z.boolean(),
  fridge: z.number().int().min(1).max(7),
  freeze: z.boolean(),
  months: z.array(z.number().int().min(1).max(12)).min(1).max(12).nullable(),
  kcal: z.number().int().min(0).max(3000).nullable(),
  proteinG: z.number().int().min(0).max(300).nullable(),
  prepMin: z.number().int().min(0).max(600),
  cookMin: z.number().int().min(0).max(1440),
  cakeType: z.enum(CAKE_TYPES),
  parts: z.number().int().min(1).max(50),
  lines: z.array(importLineSchema).min(1).max(60),
  steps: z.array(z.string().trim().min(2).max(500)).min(1).max(30),
});

export type ImportForm = z.infer<typeof importFormSchema>;

export type ImportedRecipe =
  | { kind: "main"; data: Omit<Main, "id"> }
  | { kind: "soup"; data: Omit<Soup, "id"> }
  | { kind: "simple"; data: Omit<Simple, "id"> }
  | { kind: "cake"; data: Omit<Cake, "id"> };

/** Nom court affiché sur les cartes du menu : avant la première virgule ou « et », 40 caractères au plus. */
export function shortName(name: string): string {
  const cut = name.split(/,| et | avec /)[0]!.trim();
  return cut.length <= 40 ? cut : `${cut.slice(0, 39).trimEnd()}…`;
}

/**
 * @param keys clé finale de chaque ligne (catalogue, ingrédient du foyer existant ou créé) ; null = ligne ignorée
 * (« sel, poivre » sans équivalent au catalogue : on le mentionne dans les étapes, pas dans les courses).
 */
export function toRecipe(form: ImportForm, keys: (string | null)[]): ImportedRecipe {
  const ing: Record<string, number> = {};
  form.lines.forEach((l, i) => {
    const key = keys[i];
    if (!key) return;
    // Un ingrédient de placard « au goût » garde une quantité symbolique (le catalogue n'accepte que des quantités positives).
    ing[key] = (ing[key] ?? 0) + (l.qty ?? 1);
  });
  const known = form.kcal !== null && form.proteinG !== null;
  // Macros inconnues (le site ne les donne pas et le seed n'a pas de table nutritionnelle) : `mu` le signale.
  const m: [number, number, number, number] = [form.kcal ?? 0, form.proteinG ?? 0, 0, 0];
  const common = {
    n: form.name,
    m,
    ing,
    ...(form.months && form.months.length < 12 && { months: [...form.months].sort((a, b) => a - b) }),
    ...(!known && { mu: true as const }),
  };
  const opt = {
    ...(form.pasta && { pasta: true as const }),
    ...(form.comfort && { comfort: true as const }),
  };

  if (form.kind === "cake") {
    return {
      kind: "cake",
      data: {
        ...common,
        t: form.cakeType,
        tm: `${form.prepMin + form.cookMin} min`,
        parts: `${form.parts} parts`,
        kid: "",
        steps: form.steps,
      },
    };
  }
  if (form.kind === "simple") {
    return {
      kind: "simple",
      data: {
        ...common,
        s: shortName(form.name),
        o: form.origin,
        p: form.protein,
        steps: form.steps,
        ...opt,
      },
    };
  }
  // Plat de batch ou soupe : les étapes deviennent un bloc de cuisson que la session sait ordonnancer.
  const batch = {
    ...common,
    s: shortName(form.name),
    d: form.name,
    o: form.origin,
    p: form.protein,
    fridge: form.fridge,
    freeze: form.freeze,
    prepMin: form.prepMin,
    prep: [],
    blocks: [
      {
        mode: form.oven ? ("four" as const) : ("feu" as const),
        active: form.prepMin,
        passive: form.cookMin,
        a: form.steps,
      },
    ],
    box: "",
    jj: "",
    ...opt,
  };
  if (form.kind === "soup") return { kind: "soup", data: batch };
  return { kind: "main", data: { ...batch, oven: form.oven } };
}

/** Recette importée déjà enregistrée → formulaire de l'écran de validation (modification). */
export function fromRecipe(
  kind: ImportedRecipe["kind"],
  data: Record<string, unknown>,
  source: { url: string | null; name: string | null },
  ingredients: Record<string, { l: string; u: (typeof UNITS)[number]; c: string }>,
): ImportForm {
  const d = data as Partial<Main & Simple & Cake> & { mu?: true };
  const ing = d.ing ?? {};
  const block = d.blocks?.[0];
  const minutes = Number.parseInt(String(d.tm ?? ""), 10);
  return {
    name: d.n ?? "",
    sourceUrl: source.url,
    sourceName: source.name,
    kind,
    protein: d.p ?? "veg",
    origin: d.o ?? "fr",
    pasta: !!d.pasta,
    comfort: !!d.comfort,
    oven: d.oven ?? block?.mode === "four",
    fridge: d.fridge ?? 3,
    freeze: d.freeze ?? false,
    months: d.months ?? null,
    kcal: d.mu ? null : (d.m?.[0] ?? null),
    proteinG: d.mu ? null : (d.m?.[1] ?? null),
    prepMin: d.prepMin ?? (Number.isFinite(minutes) ? minutes : 0),
    cookMin: block?.passive ?? 0,
    cakeType: d.t ?? "gateau",
    parts: Number.parseInt(String(d.parts ?? "8"), 10) || 8,
    lines: Object.entries(ing).map(([key, qty]) => {
      const g = ingredients[key];
      return {
        original: "",
        key,
        label: g?.l ?? key,
        qty,
        unit: g?.u ?? "pc",
        aisle: g?.c ?? "divers",
        toTaste: false,
      };
    }),
    steps: d.steps ?? [...(d.prep ?? []), ...(d.blocks ?? []).flatMap((b) => b.a)],
  };
}

/** Brouillon proposé par l'analyse → valeurs initiales du formulaire de validation. */
export function draftToForm(d: ImportDraft): ImportForm {
  return {
    name: d.name,
    sourceUrl: d.sourceUrl || null,
    sourceName: d.sourceName || null,
    kind: d.kind,
    protein: d.protein,
    origin: d.origin,
    pasta: d.pasta,
    comfort: d.comfort,
    oven: d.oven,
    fridge: d.fridge,
    freeze: d.freeze,
    months: d.months,
    kcal: d.macros?.[0] ?? null,
    proteinG: d.macros?.[1] ?? null,
    prepMin: d.prepMin ?? 0,
    cookMin: d.cookMin ?? Math.max(0, (d.totalMin ?? 0) - (d.prepMin ?? 0)),
    cakeType: "gateau",
    parts: d.servings && d.kind === "cake" ? Math.round(d.servings) : 8,
    lines: d.lines.map((l) => ({
      original: l.original,
      key: l.key,
      label: l.label,
      qty: l.qty,
      unit: l.unit,
      aisle: l.aisle,
      toTaste: l.toTaste,
    })),
    steps: d.steps,
  };
}

/** Recette vide pour la saisie à la main. */
export const EMPTY_DRAFT: ImportDraft = {
  name: "",
  sourceUrl: "",
  sourceName: "",
  servings: 4,
  totalMin: null,
  prepMin: null,
  cookMin: null,
  kind: "main",
  protein: "veg",
  origin: "fr",
  pasta: false,
  comfort: false,
  oven: false,
  fridge: 3,
  freeze: true,
  months: null,
  macros: null,
  lines: [],
  steps: [],
};
