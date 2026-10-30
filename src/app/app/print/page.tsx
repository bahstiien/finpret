import type { Metadata } from "next";
import Link from "next/link";
import { PrintSheet, type PrintData } from "@/components/print/PrintSheet";
import { canteenDays } from "@/engine/canteen";
import { breakfastId } from "@/engine/catalog/derive";
import { dur, fmtQ } from "@/engine/format";
import { dayTotals, dailyAverages } from "@/engine/nutrition";
import { isRemoved, slotMap } from "@/engine/week";
import { fr } from "@/i18n/fr";
import { addDays, formatLong } from "@/lib/dates";
import { loadHouseholdContext, portionModelFor } from "@/server/household-context";
import { buildMenuView } from "@/server/menu-view";
import { UpgradeCard } from "@/components/ui/UpgradeCard";
import { householdCan } from "@/server/entitlements-load";
import { requireHousehold, withSession } from "@/server/session";
import { currentAndNext, engineEnvFor, summarize } from "@/server/weeks";

export const metadata: Metadata = { title: fr.menuScreen.print };

const t = fr.print;

/** Vue imprimable (§8.6) : une page A4 portrait en noir et blanc, du dimanche de la session au dimanche suivant. */
export default async function PrintPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const params = await searchParams;
  const { household } = await requireHousehold("/app/print");
  if (!(await householdCan(household.id, "print"))) return <UpgradeCard />;
  const ctx = await loadHouseholdContext(household.id);
  const { today, current, next } = currentAndNext(ctx);
  const row = ctx.weeks.find((w) => w.start_date === params.week) ?? next ?? current;
  if (!row) {
    return (
      <p className="text-muted">
        {t.noWeek} <Link href="/app" className="lnk">{t.back}</Link>
      </p>
    );
  }

  const env = await engineEnvFor(ctx);
  const pm = portionModelFor(ctx, row.start_date);
  const view = buildMenuView(ctx, env, row, pm, today);
  const summary = await summarize(ctx, row.plan, env);
  const tot = dayTotals(env, row.plan);
  const avg = dailyAverages(env, row.plan);
  const map = slotMap(env, row.plan);
  const recipeOf = (id: string) =>
    env.mainById.get(id) ?? env.soupById.get(id) ?? env.simpleById.get(id) ?? null;

  // Le dimanche de la session : ce qui sort du congélateur pour le lundi.
  const sundayThaw = (["lunch", "dinner"] as const)
    .filter((m) => map[`1-${m}`]?.kind === "bank" && !isRemoved(row.plan, 1, m))
    .map((m) => map[`1-${m}`]!.r.s.toLowerCase());

  const kids = ctx.members.filter((m) => m.kind === "child" && !m.archived);
  const { menus, breakfasts } = await withSession(async (db) => ({
    menus: kids.length
      ? await db
          .selectFrom("canteen_menus")
          .select(["member_id", "date", "text"])
          .where("validated", "=", true)
          .where(
            "member_id",
            "in",
            kids.map((k) => k.id),
          )
          .where("date", ">=", row.start_date)
          .where("date", "<=", addDays(row.start_date, 4))
          .orderBy("date")
          .execute()
      : [],
    breakfasts: await db
      .selectFrom("recipes")
      .select(["id", "data"])
      .where("kind", "=", "breakfast")
      .where("household_id", "is", null)
      .execute(),
  }));
  const pick = (type: "sucre" | "sale") => {
    const list = breakfasts
      .map((b) => ({ id: b.id ?? "", ...(b.data as { n: string; d: string; t: string }) }))
      .filter((b) => b.t === type);
    const b = list[Math.floor(Math.random() * list.length)];
    return b
      ? {
          id: b.id || breakfastId(b.n),
          name: b.n.replace("{fruit}", fr.discover.seasonalFruit),
          description: b.d,
        }
      : null;
  };

  const cake = view.cake ? env.cakeById.get(view.cake.id) : null;
  const data: PrintData = {
    title: t.title(formatLong(row.start_date)),
    chips: [t.meals(view.plannedMeals), t.session(dur(summary.sessionMinutes))],
    sunday: {
      label: `${fr.days[6]} ${Number(addDays(row.start_date, -1).slice(8))}`,
      text: t.batchLead(dur(summary.sessionMinutes), view.plannedMeals),
      thaw: sundayThaw,
    },
    days: view.days.map((d) => ({
      label: `${fr.days[d.day - 1]} ${Number(d.iso.slice(8))}`,
      cake: view.cake && view.cake.day === d.day ? t.cake(view.cake.name) : null,
      meals: (["lunch", "dinner"] as const).map((meal) => {
        const m = d.meals.find((x) => x.meal === meal && !x.removed);
        if (!m) return null;
        const r = recipeOf(m.recipeId);
        return {
          tag: m.kind === "weekend" ? t.weekend : null,
          name: m.name,
          macros: r && !r.mu ? t.macros(r.m[0], r.m[1]) : null,
          guests: t.for(m.guests),
          how: m.how,
        };
      }),
      thaw: d.day < 5 ? d.thaw : [],
      total: d.day <= 5 && tot[d.day]![0] > 0 ? t.totals(...tot[d.day]!) : null,
    })),
    average: t.averageText(avg.kcal, avg.protein),
    canteen: kids.map((k) => ({
      name: k.name,
      days: canteenDays(k, ctx.presence, row.start_date, ctx.alternatingFrom),
      menus: menus
        .filter((m) => m.member_id === k.id)
        .map((m) => ({ day: fr.days[(new Date(`${m.date}T12:00:00Z`).getUTCDay() + 6) % 7]!, text: m.text })),
    })),
    breakfasts: { sweet: pick("sucre"), savory: pick("sale") },
    cake: cake
      ? {
          name: cake.n,
          meta: `${cake.tm} · ${cake.parts}`,
          ingredients: Object.entries(cake.ing).map(
            ([k, q]) => `${env.lib.ingredients[k]?.l ?? k} : ${fmtQ(env.lib, k, q)}`,
          ),
          steps: view.cake!.steps,
        }
      : null,
  };
  return <PrintSheet data={data} />;
}
