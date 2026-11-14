/**
 * Première session accompagnée (SPEC_PRISE_EN_MAIN §4.4) : boîtes à prévoir, affichage de la Tile de la veille,
 * niveau effectif. TypeScript pur (CLAUDE.md, règle 2).
 */
import { addDays, isoWeekday } from "@/lib/dates";
import type { Env } from "./env";
import { fmtP } from "./format";
import { mealPd, type PortionModel } from "./portions";
import type { SessionLevel, WeekPlan } from "./types";
import { activeMains, activeSoup, dayShort, mealLabel } from "./week";

export type PackBox = {
  /** Nom court du plat. */
  recipe: string;
  /** Conditionnement du seed (« curry seul, riz à part »), s'il existe. */
  box: string | null;
  /** Portions de la boîte, formatées (« 2,5 »). */
  portions: string;
  /** Repas servi (« mardi midi »). */
  label: string;
  to: "fridge" | "freezer";
};

export type Packaging = { boxes: PackBox[]; fridge: number; freezer: number };

/**
 * Boîtes du portionnage de la session : une par repas portionné de chaque plat de batch et par soir de soupe,
 * au frigo ou au congélateur selon la durée de conservation du plat (même règle que l'étape « Portionnage »).
 * Le seed ne donne ni volume ni forme de boîte : seules la taille en portions et le conditionnement texte sont connus.
 */
export function packaging(env: Env, week: WeekPlan, pm: PortionModel): Packaging {
  const boxes: PackBox[] = [];
  for (const x of activeMains(env, week, pm)) {
    if (!x.P) continue;
    for (const m of x.meals) {
      boxes.push({
        recipe: x.r.s,
        box: x.r.box ?? null,
        portions: fmtP(mealPd(week, pm, m.day, m.meal)),
        label: mealLabel(week, m),
        to: m.day > x.r.fridge ? "freezer" : "fridge",
      });
    }
  }
  const so = activeSoup(env, week, pm);
  if (so?.P) {
    for (const d of so.days) {
      boxes.push({
        recipe: so.r.s,
        box: null,
        portions: fmtP(mealPd(week, pm, d, "dinner")),
        label: `${dayShort(week, d)} soir`,
        to: d > so.r.fridge ? "freezer" : "fridge",
      });
    }
  }
  const freezer = boxes.filter((b) => b.to === "freezer").length;
  return { boxes, fridge: boxes.length - freezer, freezer };
}

export type PrepTileState = "eve" | "today" | null;

/**
 * Tile « Demain, ta première session » : la veille du jour de session du foyer, et le jour même tant que la session
 * n'est pas lancée. `sessionDay` : 0 = dimanche … 6 = samedi (réglage Session). `today` : jour local du foyer.
 */
export function prepTile(i: {
  today: string;
  sessionDay: number;
  hasWeek: boolean;
  started: boolean;
  done: boolean;
}): PrepTileState {
  if (!i.hasWeek || i.started || i.done) return null;
  const weekday = i.sessionDay === 0 ? 7 : i.sessionDay;
  if (isoWeekday(i.today) === weekday) return "today";
  if (isoWeekday(addDays(i.today, 1)) === weekday) return "eve";
  return null;
}

/**
 * Niveau d'une session : à la première session du foyer, le choix fait pour elle, sinon « débutant » (+20 % de marge) ;
 * ensuite, le réglage Session du foyer.
 */
export function effectiveLevel(i: {
  firstSession: boolean;
  override: SessionLevel | null;
  setting: SessionLevel;
}): SessionLevel {
  return i.firstSession ? (i.override ?? "beginner") : i.setting;
}

/** Heure de fin prévue (« 17:30 ») d'une session qui commence à `time` (« 14:00 ») et dure `minutes`. */
export function endTime(time: string, minutes: number): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const total = (h * 60 + m + Math.round(minutes)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
