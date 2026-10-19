import { engineFr } from "@/i18n/engine";
import { bankRecipe, type Env } from "./env";
import { fill, fmtP, fmtQ, fmtRaw, snapNum } from "./format";
import { mealPd, type PortionModel } from "./portions";
import { pantryAfterWeek, type Totals } from "./quantities";
import type { Equipment, Pantry, SessionLevel, WeekPlan } from "./types";
import { activeMains, activeSimples, activeSoup, dayShort, isRemoved, mealLabel } from "./week";

/** Session du dimanche (§7.5) : port de buildSession. */

const t = engineFr.session;

type Block = { mode: string; active: number; passive: number; wait?: false; a: string[] };

export type SessionStep = {
  /** Minutes depuis le début de la session. */
  start: number;
  name: string;
  where: string;
  tasks: string[];
  timer?: { label: string; minutes: number };
  /** Dernière étape : proposer de ranger les plats doublés et de mettre à jour le garde-manger. */
  actions?: { bankDoubles: boolean; pantryUpdate: boolean };
};

export type Session = {
  steps: SessionStep[];
  /** Durée totale (minutes), fin de cuisson, temps de travail actif. */
  total: number;
  cook: number;
  active: number;
};

export type SessionInput = {
  env: Env;
  week: WeekPlan;
  pm: PortionModel;
  pantry: Pantry;
  /** Totaux de la semaine (pour les restes du garde-manger). */
  totals: Totals;
  equipment: Equipment;
  /** Niveau débutant : +20 % sur chaque étape. */
  level?: SessionLevel;
};

export function buildSession(input: SessionInput): Session {
  const { env, week, pm, equipment } = input;
  const lib = env.lib;
  const margin = input.level === "beginner" ? 1.2 : 1;
  const scaleBlock = (b: Block): Block =>
    margin === 1
      ? b
      : { ...b, active: Math.round(b.active * margin), passive: Math.round(b.passive * margin) };

  const mains = activeMains(env, week, pm);
  const so = activeSoup(env, week, pm);
  const items: {
    r: { s: string; ing: Record<string, number>; prep: string[]; blocks: Block[]; jj?: string };
    sc: number;
    blocks: Block[];
  }[] = [];
  for (const x of mains) {
    if (x.P) {
      items.push({
        r: x.r,
        sc: x.cookP / 4,
        blocks: [{ mode: "plan", active: x.r.prepMin, passive: 0, a: x.r.prep }, ...x.r.blocks].map(
          scaleBlock,
        ),
      });
    }
  }
  if (so && so.P) {
    items.push({
      r: so.r,
      sc: so.P / 4,
      blocks: [{ mode: "plan", active: so.r.prepMin, passive: 0, a: so.r.prep }, ...so.r.blocks].map(
        scaleBlock,
      ),
    });
  }
  if (!items.length) {
    return {
      steps: [{ start: 0, name: t.nothing.name, where: t.nothing.where, tasks: [t.nothing.task] }],
      total: 0,
      cook: 0,
      active: 0,
    };
  }

  // Appareil réellement utilisé : sans air fryer, ces étapes passent au four ; sans blender chauffant ni
  // micro-ondes, sur les plaques.
  const modeOf = (mode: string) =>
    mode === "airfryer" && !equipment.airfryer
      ? "four"
      : (mode === "blender" && !equipment.blender) || (mode === "micro" && !equipment.microwave)
        ? "feu"
        : mode;
  const hasOven = items.some((it) => it.blocks.some((b) => modeOf(b.mode) === "four"));
  const racks = Math.max(1, equipment.ovenRacks);

  // Ingrédients de la session, sans ceux servis uniquement le jour du repas (jj).
  const sess: Record<string, number> = {};
  for (const it of items) {
    const r = it.r;
    const used = new Set<string>();
    for (const text of [...(r.prep ?? []), ...(r.blocks ?? []).flatMap((b) => b.a)]) {
      for (const m of text.match(/\{(\w+)\}/g) ?? []) used.add(m.slice(1, -1));
    }
    const jjOnly = new Set(
      (r.jj?.match(/\{(\w+)\}/g) ?? []).map((m) => m.slice(1, -1)).filter((k) => !used.has(k)),
    );
    for (const k in r.ing) {
      if (jjOnly.has(k) || !lib.ingredients[k]) continue;
      let q = snapNum(lib, k, r.ing[k]! * it.sc);
      if (lib.ingredients[k]!.u === "boite") q = Math.max(1, Math.round(q));
      sess[k] = (sess[k] ?? 0) + q;
    }
  }
  const order = [...lib.aisles.map(([k]) => k), "base"];
  const ingLines = Object.keys(sess)
    .sort(
      (a, b) =>
        order.indexOf(lib.ingredients[a]!.c) - order.indexOf(lib.ingredients[b]!.c) ||
        lib.ingredients[a]!.l.localeCompare(lib.ingredients[b]!.l),
    )
    .map((k) => t.ingredients.line(lib.ingredients[k]!.l, fmtQ(lib, k, sess[k]!)));

  const steps: SessionStep[] = [
    {
      start: 0,
      name: t.setup.name,
      where: t.setup.where,
      tasks: [
        hasOven ? t.setup.preheat(racks) : t.setup.noOven,
        ...(items.some((it) => it.blocks.some((b) => modeOf(b.mode) === "airfryer"))
          ? [t.setup.airfryer]
          : []),
        t.setup.wash,
        t.setup.boxes,
      ],
    },
    {
      start: 0,
      name: t.ingredients.name,
      where: t.ingredients.where,
      tasks: [t.ingredients.lead, ...ingLines],
    },
  ];

  // Ordonnancement : à chaque tour, le bloc qui peut commencer le plus tôt ; à égalité, la plus longue attente,
  // puis le plat qui a le plus de travail restant. Four, plaques et appareils sont des ressources partagées.
  let time = 5;
  let active = 5;
  const res: Record<string, number[]> = {
    four: new Array(racks).fill(5),
    airfryer: [5],
    feu: new Array(Math.max(1, equipment.burners)).fill(5),
    blender: [5],
    micro: [5],
  };
  const where: Record<string, string> = {
    airfryer: t.where.airfryer,
    blender: t.where.blender,
    micro: t.where.micro,
    robot: t.where.robot,
    mixeur: t.where.mixeur,
    plan: t.where.plan,
  };
  const ptr = items.map(() => 0);
  const ready = items.map(() => 5);
  while (ptr.some((p, i) => p < items[i]!.blocks.length)) {
    let best: { i: number; b: Block; e: number; g: number; rem: number; pas: number } | null = null;
    items.forEach((it, i) => {
      if (ptr[i]! >= it.blocks.length) return;
      const b = it.blocks[ptr[i]!]!;
      let e = Math.max(time, b.wait === false ? 0 : ready[i]!);
      let g = -1;
      const pool = res[modeOf(b.mode)];
      if (pool) {
        g = pool.indexOf(Math.min(...pool));
        e = Math.max(e, pool[g]!);
      }
      const rem = it.blocks.slice(ptr[i]!).reduce((s, x) => s + x.active + (x.passive || 0), 0);
      const pas = b.passive || 0;
      if (!best || e < best.e || (e === best.e && (pas > best.pas || (pas === best.pas && rem > best.rem)))) {
        best = { i, b, e, g, rem, pas };
      }
    });
    const { i, b, e, g } = best!;
    const it = items[i]!;
    const end = e + b.active + (b.passive || 0);
    time = e + b.active;
    active += b.active;
    ready[i] = Math.max(ready[i]!, end);
    const mode = modeOf(b.mode);
    if (g >= 0) res[mode]![g] = end;
    const label =
      mode === "four" ? t.where.oven(g + 1) : mode === "feu" ? t.where.burner(g + 1) : where[mode]!;
    const minutes = b.passive || 0;
    steps.push({
      start: e,
      name: it.r.s,
      where: label,
      tasks: b.a.map((x) => fill(lib, x, it.r.ing, it.sc)),
      ...(minutes ? { timer: { label: it.r.s, minutes } } : {}),
    });
    ptr[i]!++;
  }
  steps.sort((a, b) => a.start - b.start);
  const endCook = Math.max(time, ...ready);
  steps.push({
    start: endCook,
    name: t.cooling.name,
    where: t.cooling.where,
    tasks: [...t.cooling.tasks],
    timer: { label: t.cooling.name, minutes: 25 },
  });

  // Portionnage par boîte.
  const box: string[] = [];
  const fridge: string[] = [];
  const freezer: string[] = [];
  for (const x of mains) {
    if (!x.P) continue;
    const boxes = x.meals
      .map((m) => t.portioning.box(fmtP(mealPd(week, pm, m.day, m.meal)), mealLabel(week, m)))
      .join(", ");
    box.push(
      t.portioning.main(x.r.s, x.r.box, boxes) + (x.doubled ? t.portioning.doubled(x.meals.length) : ""),
    );
    for (const m of x.meals) {
      const l = `${x.r.s}, ${mealLabel(week, m)}`;
      if (m.day > x.r.fridge) freezer.push(t.storage.thaw(l, dayShort(week, m.day - 1)));
      else fridge.push(l);
    }
  }
  if (so && so.P) {
    const boxes = so.days
      .map((d) => t.portioning.box(fmtP(mealPd(week, pm, d, "dinner")), `${dayShort(week, d)} soir`))
      .join(", ");
    box.push(t.portioning.soup(so.r.s, boxes));
    for (const d of so.days) {
      const l = `${so.r.s}, ${dayShort(week, d)} soir`;
      if (d > so.r.fridge) freezer.push(t.storage.thaw(l, dayShort(week, d - 1)));
      else fridge.push(l);
    }
  }
  box.push(t.portioning.label);
  steps.push({ start: endCook + 25, name: t.portioning.name, where: t.portioning.where, tasks: box });

  // Rangement : frigo, congélateur, réserve, restes du garde-manger.
  const st: string[] = [];
  if (fridge.length) st.push(t.storage.fridge(fridge.join(" ; ")));
  const dbl = mains.filter((x) => x.doubled && x.meals.length);
  if (dbl.length)
    st.push(
      t.storage.bank(dbl.map((x) => t.storage.bankItem(x.meals.length, x.r.s.toLowerCase())).join(", ")),
    );
  const fromBank = (week.bank ?? []).filter((b) => !isRemoved(week, b.day, b.meal));
  if (fromBank.length) {
    st.push(
      t.storage.fromBank(
        fromBank
          .map((b) => t.storage.fromBankItem(mealLabel(week, b), bankRecipe(env, b.id)!.s.toLowerCase()))
          .join(", "),
      ),
    );
  }
  if (freezer.length) st.push(t.storage.freezer(freezer.join(" ; ")));
  const sim = activeSimples(env, week).filter((s) => s.on);
  if (sim.length)
    st.push(t.storage.simples(sim.map((s) => `${s.r.s.toLowerCase()} ${dayShort(week, s.day)}`).join(", ")));
  const pu = week.pantryDone ? [] : pantryAfterWeek(env, input.pantry, input.totals);
  const keep = pu.filter((c) => c.after > 0);
  const usedUp = pu.filter((c) => !(c.after > 0));
  if (keep.length) {
    st.push(
      t.storage.keep(
        keep
          .map((c) =>
            ["pc", "boite"].includes(lib.ingredients[c.k]!.u)
              ? fmtQ(lib, c.k, c.after)
              : t.storage.keepItem(fmtRaw(lib, c.k, c.after), lib.ingredients[c.k]!.l.toLowerCase()),
          )
          .join(", "),
      ),
    );
  }
  if (usedUp.length)
    st.push(t.storage.used(usedUp.map((c) => lib.ingredients[c.k]!.l.toLowerCase()).join(", ")));
  steps.push({
    start: endCook + 40,
    name: t.storage.name,
    where: t.storage.where,
    tasks: st,
    actions: { bankDoubles: dbl.length > 0 && !week.banked, pantryUpdate: pu.length > 0 },
  });

  return { steps, total: endCook + 50, cook: endCook, active: active + 25 };
}
