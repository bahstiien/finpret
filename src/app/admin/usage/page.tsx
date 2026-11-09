import Link from "next/link";
import { BarChart, BarList, Funnel, Kpi, StackedBar } from "@/components/admin/Charts";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionHeader } from "@/components/ui/Layout";
import { originOf } from "@/engine/origins";
import { deltaPct } from "@/lib/admin-board";
import {
  ENGAGEMENT_EVENTS,
  fillSeries,
  KIND_LABEL,
  parsePeriod,
  PROTEIN_LABEL,
  share,
  STREAK_LABEL,
  topBy,
  USAGE_PERIOD_KEYS,
  USAGE_PERIODS,
  usageRange,
} from "@/lib/admin-usage";
import { formatMinutes, formatShort, todayIn } from "@/lib/dates";
import { requireAdmin } from "@/server/admin";
import { type RecipeOpinion, usageData } from "@/server/admin-usage";

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const flag = (code: string | null) => {
  const o = originOf(code);
  return o ? `${o.flag} ${o.name}` : null;
};

/** Usage et communauté : sessions terminées, recettes cuisinées, avis des foyers, anti-gaspi et engagement. */
export default async function AdminUsagePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAdmin();
  const period = parsePeriod((await searchParams).p);
  const today = todayIn("Europe/Paris");
  const range = usageRange(period, today);
  const data = await usageData(range);
  const { sessions, cooks, ratings, antigaspi } = data;

  const weekly = range.unit === "week";
  const seriesFormat = (k: string) => (weekly ? `sem. ${formatShort(k)}` : formatShort(k));
  const labelEvery = period === "30" ? 5 : period === "90" ? 2 : 8;
  const periodLabel = USAGE_PERIODS[period].label;
  const perHousehold = sessions.households
    ? (sessions.done / sessions.households).toFixed(1).replace(".", ",")
    : "—";

  const opinionLine = (o: RecipeOpinion, main: number, details: string[] = []) => ({
    key: o.id,
    label: o.name,
    n: main,
    hint: [...details, `cuisinée par ${o.cookedBy} foyer${o.cookedBy > 1 ? "s" : ""}`].join(" · "),
  });
  const loved = topBy(ratings.opinions, (o) => o.liked + o.kids).map((o) =>
    opinionLine(o, o.liked + o.kids, [
      ...(o.liked ? [`${o.liked} « à refaire »`] : []),
      ...(o.kids ? [`${o.kids} aimée des enfants`] : []),
    ]),
  );
  const refused = topBy(ratings.opinions, (o) => o.refused).map((o) => opinionLine(o, o.refused));
  const tooLong = topBy(ratings.opinions, (o) => o.tooLong).map((o) => opinionLine(o, o.tooLong));

  const streakOf = (k: string) => data.streak.find((s) => s.outcome === k)?.n ?? 0;
  const streakClosed = data.streak.reduce((s, r) => s + r.n, 0);

  return (
    <>
      <PageHeader
        title="Usage et communauté"
        description={`Ce que les foyers font vraiment avec l'app, depuis le ${formatShort(range.since)}.`}
      />

      <nav aria-label="Période" className="flex flex-wrap gap-2">
        {USAGE_PERIOD_KEYS.map((k) => (
          <Link
            key={k}
            href={`/admin/usage?p=${k}`}
            aria-current={k === period ? "page" : undefined}
            className={`btn btn--sm ${k === period ? "btn--dark" : "btn--outline"}`}
          >
            {USAGE_PERIODS[k].label}
          </Link>
        ))}
      </nav>

      <dl className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <Kpi
          label="Sessions terminées"
          value={sessions.done}
          delta={deltaPct(sessions.done, sessions.donePrev)}
          hint="vs période précédente"
          tone="violet"
        />
        <Kpi
          label="Foyers qui cuisinent"
          value={sessions.households}
          delta={deltaPct(sessions.households, sessions.householdsPrev)}
          hint={`${perHousehold} session(s) par foyer`}
          tone="banane"
        />
        <Kpi
          label="Recettes cuisinées"
          value={cooks.total}
          delta={deltaPct(cooks.total, cooks.prev)}
          hint={`${cooks.distinct} recettes différentes`}
          tone="green"
        />
        <Kpi
          label="Durée médiane d'une session"
          value={sessions.medianMinutes === null ? "—" : formatMinutes(sessions.medianMinutes)}
          hint="de la 1re étape à la fin"
        />
      </dl>

      <section className="flex flex-col gap-4" aria-labelledby="sessions-title">
        <h2 id="sessions-title" className="t-2">
          Sessions de batch cooking
        </h2>
        <div className="grid gap-4 min-[1100px]:grid-cols-3">
          <Card className="!shadow-none min-[1100px]:col-span-2">
            <SectionHeader title="Sessions terminées" aside={weekly ? "par semaine" : "par jour"} />
            <div className="mt-6">
              <BarChart
                data={fillSeries(sessions.series, range.keys)}
                label={`Sessions terminées sur ${periodLabel}`}
                labelEvery={labelEvery}
                format={seriesFormat}
              />
            </div>
          </Card>
          <Card className="!shadow-none">
            <SectionHeader title="Du menu à la session" />
            <div className="mt-4">
              <Funnel
                label="Du menu créé à la session terminée"
                steps={[
                  { label: "Menus créés", n: sessions.menus },
                  { label: "Sessions démarrées", n: sessions.started },
                  { label: "Sessions terminées", n: sessions.done },
                ]}
              />
            </div>
            <p className="t-small muted mt-3">
              {sessions.abandoned} session(s) démarrée(s) il y a plus d&apos;un jour sans être terminée(s).
            </p>
          </Card>
        </div>
        <div className="grid gap-4 min-[1100px]:grid-cols-2">
          <Card className="!shadow-none">
            <SectionHeader title="Jour de la session" aside="jour où elle se termine" />
            <div className="mt-6">
              <BarChart
                data={WEEKDAYS.map((_, i) => ({
                  key: String(i + 1),
                  n: sessions.weekdays.find((d) => d.dow === i + 1)?.n ?? 0,
                }))}
                label="Sessions terminées par jour de la semaine"
                color="blue"
                height={110}
                format={(k) => WEEKDAYS[Number(k) - 1] ?? k}
              />
            </div>
          </Card>
          <Card className="!shadow-none">
            <SectionHeader
              title="Série « semaines fin prêtes »"
              aside={`${streakClosed} semaines clôturées`}
            />
            <div className="mt-4">
              <StackedBar
                label="Issue des semaines clôturées"
                parts={[
                  { label: STREAK_LABEL.done!, n: streakOf("done"), color: "green" },
                  { label: STREAK_LABEL.paused!, n: streakOf("paused"), color: "banane" },
                  { label: STREAK_LABEL.neutral!, n: streakOf("neutral"), color: "chip" },
                  { label: STREAK_LABEL.missed!, n: streakOf("missed"), color: "pink" },
                ]}
              />
            </div>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="recettes-title">
        <h2 id="recettes-title" className="t-2">
          Recettes cuisinées
        </h2>
        <div className="grid gap-4 min-[1100px]:grid-cols-3">
          <Card className="!shadow-none min-[1100px]:col-span-2">
            <SectionHeader
              title="Volume"
              aside={`${share(cooks.distinct, cooks.catalog)} du catalogue cuisiné`}
            />
            <div className="mt-6">
              <BarChart
                data={fillSeries(cooks.series, range.keys)}
                label={`Recettes cuisinées sur ${periodLabel}`}
                color="green"
                labelEvery={labelEvery}
                format={seriesFormat}
              />
            </div>
          </Card>
          <Card className="flex flex-col gap-4 !shadow-none">
            <SectionHeader title="Par type" />
            <StackedBar
              label="Recettes cuisinées par type"
              parts={[
                {
                  label: KIND_LABEL.main!,
                  n: cooks.byKind.find((k) => k.kind === "main")?.n ?? 0,
                  color: "violet",
                },
                {
                  label: KIND_LABEL.soup!,
                  n: cooks.byKind.find((k) => k.kind === "soup")?.n ?? 0,
                  color: "peach",
                },
                {
                  label: KIND_LABEL.simple!,
                  n: cooks.byKind.find((k) => k.kind === "simple")?.n ?? 0,
                  color: "blue",
                },
              ]}
            />
            <p className="t-small muted">
              {cooks.imported} recette(s) importée(s) par les foyers cuisinée(s) · {data.imports.total}{" "}
              import(s) sur la période, dont {data.imports.validated} validé(s).
            </p>
          </Card>
        </div>
        <div className="grid gap-4 min-[1100px]:grid-cols-3">
          <Card className="flex flex-col gap-3 !shadow-none">
            <SectionHeader title="Top 10 des recettes" />
            <BarList
              label="Recettes les plus cuisinées"
              items={cooks.top.map((r) => ({
                key: r.id,
                label: r.name,
                n: r.n,
                hint: `${KIND_LABEL[r.kind] ?? r.kind} · ${r.households} foyer${r.households > 1 ? "s" : ""}`,
              }))}
            />
          </Card>
          <Card className="flex flex-col gap-3 !shadow-none">
            <SectionHeader title="Voyages culinaires" aside="origine des recettes" />
            <BarList
              label="Origines les plus cuisinées"
              color="banane"
              items={cooks.byOrigin.map((o) => ({
                key: o.origin,
                label: flag(o.origin) ?? o.origin,
                n: o.n,
              }))}
            />
          </Card>
          <Card className="flex flex-col gap-3 !shadow-none">
            <SectionHeader title="Protéines" />
            <BarList
              label="Recettes cuisinées par protéine"
              color="peach"
              items={cooks.byProtein.map((p) => ({
                key: p.protein,
                label: PROTEIN_LABEL[p.protein] ?? "Non renseignée",
                n: p.n,
                hint: share(p.n, cooks.total),
              }))}
            />
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="avis-title">
        <h2 id="avis-title" className="t-2">
          Avis de la communauté
        </h2>
        <p className="t-small muted -mt-2">
          Les avis ne sont pas datés : ils sont comptés depuis le début. {ratings.households} foyer(s) ont
          donné au moins un avis, soit {share(ratings.households, ratings.cookingHouseholds)} des foyers qui
          ont cuisiné.
        </p>
        <dl className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          <Kpi
            label="« À refaire »"
            value={ratings.liked}
            hint={share(ratings.liked, ratings.total)}
            tone="green"
          />
          <Kpi
            label="Aimé des enfants"
            value={ratings.kids}
            hint={share(ratings.kids, ratings.total)}
            tone="banane"
          />
          <Kpi label="« Trop long »" value={ratings.tooLong} hint={share(ratings.tooLong, ratings.total)} />
          <Kpi
            label="Refusées"
            value={ratings.refused}
            hint={share(ratings.refused, ratings.total)}
            tone="violet"
          />
        </dl>
        <div className="grid gap-4 min-[1100px]:grid-cols-3">
          <Card className="flex flex-col gap-3 !shadow-none">
            <SectionHeader title="Les plus appréciées" />
            <BarList
              label="Recettes les plus appréciées"
              color="green"
              items={loved}
              empty="Aucun avis pour l'instant."
            />
          </Card>
          <Card className="flex flex-col gap-3 !shadow-none">
            <SectionHeader title="Les plus refusées" />
            <BarList
              label="Recettes les plus refusées"
              color="pink"
              items={refused}
              empty="Aucun refus pour l'instant."
            />
          </Card>
          <Card className="flex flex-col gap-3 !shadow-none">
            <SectionHeader title="Jugées trop longues" />
            <BarList
              label="Recettes jugées trop longues"
              color="banane"
              items={tooLong}
              empty="Personne ne s'en plaint pour l'instant."
            />
          </Card>
        </div>
      </section>

      <section className="grid gap-4 min-[1100px]:grid-cols-2" aria-label="Anti-gaspi et engagement">
        <Card className="flex flex-col gap-3 !shadow-none">
          <SectionHeader title="Anti-gaspi" aside={`${antigaspi.households} foyer(s)`} />
          <p className="t-small">
            <b>{antigaspi.saves}</b> ingrédient(s) pris dans le stock par les sessions, dont{" "}
            <b>{antigaspi.urgent}</b> à date courte.
          </p>
          <BarList
            label="Ingrédients les plus sauvés"
            color="green"
            items={antigaspi.top.map((i) => ({ key: i.label, label: i.label, n: i.n }))}
          />
        </Card>
        <Card className="flex flex-col gap-3 !shadow-none">
          <SectionHeader title="Engagement" aside="vs période précédente" />
          <ul>
            {ENGAGEMENT_EVENTS.map(([name, label]) => {
              const e = data.events.find((x) => x.name === name);
              const n = e?.n ?? 0;
              const d = deltaPct(n, e?.prev ?? 0);
              return (
                <li key={name} className="row t-small">
                  <span className="row-main">{label}</span>
                  <b className="mono">{n}</b>
                  <span className="mono muted w-16 text-right">
                    {d === null ? "—" : `${d > 0 ? "+" : ""}${d} %`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    </>
  );
}
