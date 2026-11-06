import Link from "next/link";
import { requireAdmin } from "@/server/admin";
import { dashboardData } from "@/server/admin-board";
import { stripeAvailable, stripeClient, stripeConfig } from "@/server/stripe";
import { BarChart, Funnel, Kpi, StackedBar } from "@/components/admin/Charts";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionHeader } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";
import {
  dailySeries,
  deltaPct,
  isOverdue,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABEL,
  TASK_PRIORITY_LABEL,
} from "@/lib/admin-board";
import { addDays, formatShort, mondayOf, todayIn } from "@/lib/dates";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");
const TZ = "Europe/Paris";

/** Montant d'un prix Stripe en euros (null si Stripe n'est pas configuré ou injoignable). */
async function priceEuros(id: string): Promise<number | null> {
  if (!id || !stripeAvailable()) return null;
  try {
    const p = await stripeClient().prices.retrieve(id);
    return p.unit_amount !== null && p.currency === "eur" ? p.unit_amount / 100 : null;
  } catch {
    return null;
  }
}

/** Accueil du back-office : à traiter, indicateurs, graphiques, dernières demandes et prochaines actions. */
export default async function AdminHome() {
  await requireAdmin();
  const cfg = stripeConfig();
  const [data, monthly, yearly] = await Promise.all([
    dashboardData(),
    priceEuros(cfg.monthlyPrice),
    priceEuros(cfg.yearlyPrice),
  ]);
  const today = todayIn(TZ);

  const sub = (plan?: string, status?: string) =>
    data.subs
      .filter((s) => (!plan || s.plan === plan) && (!status || s.status === status))
      .reduce((sum, s) => sum + s.n, 0);
  const monthlyActive = sub("monthly", "active");
  const yearlyActive = sub("yearly", "active");
  const paid = monthlyActive + yearlyActive;
  const trial = sub("trial");
  const canceled = sub(undefined, "canceled");
  const pastDue = sub(undefined, "past_due");
  const mrr =
    monthly !== null && yearly !== null ? monthlyActive * monthly + (yearlyActive * yearly) / 12 : null;

  const signups = dailySeries(data.signups, 30, today);
  const signups30 = signups.reduce((s, d) => s + d.n, 0);

  const alerts = [
    [data.newContactCount, "demande(s) de contact nouvelle(s)", "/admin/demandes?status=new"],
    [pastDue, "paiement(s) en échec", "/admin/abonnements?status=past_due"],
    [data.pendingAssos, "association(s) à valider", "/admin/associations"],
    [data.payouts, "versement(s) à effectuer", "/admin/reversements"],
    [data.leads, "demande(s) de présentation à contacter", "/admin/prospects"],
    [data.endingSoon, "essai(s) finissant sous 7 jours", "/admin/abonnements"],
    [data.unverified, "compte(s) sans e-mail vérifié depuis plus de 7 jours", "/admin/comptes"],
  ] as const;
  const open = alerts.filter(([n]) => n !== 0);

  const taskStats = TASK_CATEGORIES.map((c) => {
    const rows = data.tasksByCategory.filter((t) => t.category === c);
    const by = (s: string) => rows.filter((r) => r.status === s).reduce((sum, r) => sum + r.n, 0);
    return { category: c, todo: by("todo"), doing: by("doing"), done: by("done") };
  });

  return (
    <>
      <PageHeader title="Tableau de bord" description={`Situation au ${formatShort(today)}`} />

      {open.length > 0 && (
        <Card tone="yellow" className="!shadow-none">
          <h2 className="t-label">À traiter</h2>
          <ul className="t-small mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {open.map(([n, label, href]) => (
              <li key={label}>
                <Link href={href} className="underline">
                  <b>{n}</b> {label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <dl className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <Kpi
          label="Comptes"
          value={data.accounts}
          delta={deltaPct(signups30, data.accountsPrev30)}
          hint={`${signups30} inscrits sur 30 j`}
        />
        <Kpi
          label="Abonnés payants"
          value={paid}
          hint={`${monthlyActive} mensuels · ${yearlyActive} annuels`}
          tone="green"
        />
        <Kpi
          label="MRR"
          value={mrr === null ? "—" : eur.format(mrr)}
          hint={mrr === null ? "Stripe non configuré" : undefined}
          tone="violet"
        />
        <Kpi
          label="Foyers actifs"
          value={data.activeThisWeek}
          hint={`menu modifié sur 7 j · ${data.households} foyers`}
          tone="banane"
        />
      </dl>

      <div className="grid gap-4 min-[1100px]:grid-cols-3">
        <Card className="!shadow-none min-[1100px]:col-span-2">
          <SectionHeader title="Inscriptions" aside="30 derniers jours" />
          <div className="mt-6">
            <BarChart
              data={signups.map((d) => ({ key: d.day, n: d.n }))}
              label="Inscriptions par jour sur 30 jours"
              labelEvery={5}
            />
          </div>
        </Card>
        <Card className="!shadow-none">
          <SectionHeader title="Activation" />
          <div className="mt-4">
            <Funnel
              label="Entonnoir d'activation"
              steps={[
                { label: "Comptes", n: data.accounts },
                { label: "Foyer créé", n: data.households },
                { label: "Premier menu", n: data.householdsWithMenu },
                { label: "Abonné payant", n: paid },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 min-[1100px]:grid-cols-2">
        <Card className="!shadow-none">
          <SectionHeader title="Abonnements" aside={`conversion ${pct(paid, paid + trial + canceled)}`} />
          <div className="mt-4">
            <StackedBar
              label="Répartition des abonnements"
              parts={[
                { label: "Essai", n: trial, color: "banane" },
                { label: "Mensuel", n: monthlyActive, color: "violet" },
                { label: "Annuel", n: yearlyActive, color: "green" },
                { label: "Gratuit", n: sub("free"), color: "blue" },
                { label: "Impayé", n: pastDue, color: "peach" },
                { label: "Résilié", n: canceled, color: "pink" },
              ]}
            />
          </div>
        </Card>
        <Card className="!shadow-none">
          <SectionHeader title="Demandes de contact" aside="par semaine" />
          <div className="mt-6">
            <BarChart
              data={Array.from({ length: 8 }, (_, i) => {
                const week = mondayOf(addDays(today, (i - 7) * 7));
                return { key: week, n: data.contactsWeekly.find((w) => w.week === week)?.n ?? 0 };
              })}
              label="Demandes de contact par semaine sur 8 semaines"
              color="pink"
              height={110}
              format={(k) => `sem. ${formatShort(k)}`}
              labelEvery={2}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 min-[1100px]:grid-cols-2">
        <Card className="flex flex-col gap-3 !shadow-none">
          <SectionHeader
            title="Dernières demandes"
            aside={
              <Link href="/admin/demandes" className="underline">
                Tout voir
              </Link>
            }
          />
          <ul>
            {data.newContacts.map((c) => (
              <li key={c.id} className="row t-small">
                <span className="row-main">
                  <Link href={`/admin/demandes?status=new#demande-${c.id}`} className="underline">
                    <b>{c.subject}</b>
                  </Link>
                  <br />
                  <span className="muted">
                    {c.name} · {c.email} · {formatShort(c.created_at.slice(0, 10))}
                  </span>
                </span>
                <Pill tone={c.audience === "asso" ? "blue" : "chip"}>
                  {c.audience === "asso" ? "Asso" : "Famille"}
                </Pill>
              </li>
            ))}
            {!data.newContacts.length && <li className="muted t-small">Aucune nouvelle demande.</li>}
          </ul>
        </Card>
        <Card className="flex flex-col gap-3 !shadow-none">
          <SectionHeader
            title="Prochaines actions"
            aside={
              <Link href="/admin/actions" className="underline">
                Tout voir
              </Link>
            }
          />
          <ul className="flex flex-col gap-2" aria-label="Avancement par catégorie">
            {taskStats.map((t) => {
              const total = t.todo + t.doing + t.done;
              return (
                <li key={t.category} className="t-small flex items-center gap-3">
                  <span className="w-32 shrink-0 font-bold">{TASK_CATEGORY_LABEL[t.category]}</span>
                  <span
                    className="flex h-4 flex-1 overflow-hidden border-[length:var(--bw)] border-line bg-chip"
                    aria-hidden="true"
                  >
                    <span
                      style={{ width: `${total ? (t.done / total) * 100 : 0}%`, background: "var(--green)" }}
                    />
                    <span
                      style={{
                        width: `${total ? (t.doing / total) * 100 : 0}%`,
                        background: "var(--banane)",
                      }}
                    />
                  </span>
                  <span className="mono w-20 text-right">
                    {t.done}/{total} faites
                  </span>
                </li>
              );
            })}
          </ul>
          <ul>
            {data.openTasks.map((t) => (
              <li key={t.id} className="row t-small">
                <span className="row-main">
                  <b>{t.title}</b>
                  <br />
                  <span className="muted">
                    {TASK_CATEGORY_LABEL[t.category]} · priorité{" "}
                    {TASK_PRIORITY_LABEL[t.priority].toLowerCase()}
                    {t.due_on ? ` · pour le ${formatShort(t.due_on)}` : ""}
                  </span>
                </span>
                {isOverdue(t, today) ? (
                  <Pill tone="pink">En retard</Pill>
                ) : t.status === "doing" ? (
                  <Pill tone="yellow">En cours</Pill>
                ) : null}
              </li>
            ))}
            {!data.openTasks.length && <li className="muted t-small">Aucune action ouverte.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
