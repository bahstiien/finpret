import Link from "next/link";
import { sql } from "kysely";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { stripeAvailable, stripeClient, stripeConfig } from "@/server/stripe";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");

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

/** Accueil du back-office : alertes à traiter, indicateurs d'activité et d'abonnement. */
export default async function AdminHome() {
  await requireAdmin();
  const cfg = stripeConfig();
  const [data, monthly, yearly] = await Promise.all([
    withAdmin(async (db) => {
      const n = async (q: { executeTakeFirst: () => Promise<{ n: number | string } | undefined> }) =>
        Number((await q.executeTakeFirst())?.n ?? 0);
      const count = sql<number>`count(*)`.as("n");
      const sub = (plan?: string, status?: string) => {
        let q = db.selectFrom("subscriptions").select(count);
        if (plan) q = q.where("plan", "=", plan as "monthly");
        if (status) q = q.where("status", "=", status);
        return n(q);
      };
      const weekly = await db
        .selectFrom("auth.users")
        .select([sql<string>`to_char(date_trunc('week', created_at), 'YYYY-MM-DD')`.as("week"), count])
        .where(sql<boolean>`created_at >= date_trunc('week', now()) - interval '7 weeks'`)
        .groupBy(sql`1`)
        .orderBy(sql`1`)
        .execute();
      return {
        accounts: await n(db.selectFrom("auth.users").select(count)),
        households: await n(db.selectFrom("households").select(count)),
        weekly,
        trial: await sub("trial"),
        monthlyActive: await sub("monthly", "active"),
        yearlyActive: await sub("yearly", "active"),
        canceled: await sub(undefined, "canceled"),
        pastDue: await sub(undefined, "past_due"),
        endingSoon: await n(
          db
            .selectFrom("subscriptions")
            .select(count)
            .where("plan", "=", "trial")
            .where(sql<boolean>`trial_ends_at between now() and now() + interval '7 days'`),
        ),
        pendingAssos: await n(db.selectFrom("associations").select(count).where("status", "=", "pending")),
        leads: await n(db.selectFrom("association_leads").select(count).where("contacted_at", "is", null)),
        payouts: await n(db.selectFrom("payouts").select(count).where("status", "=", "ready")),
        unverified: await n(
          db
            .selectFrom("auth.users")
            .select(count)
            .where("email_verified", "=", false)
            .where(sql<boolean>`created_at < now() - interval '7 days'`),
        ),
      };
    }),
    priceEuros(cfg.monthlyPrice),
    priceEuros(cfg.yearlyPrice),
  ]);
  const paid = data.monthlyActive + data.yearlyActive;
  const mrr = monthly !== null && yearly !== null ? data.monthlyActive * monthly + (data.yearlyActive * yearly) / 12 : null;
  const alerts = [
    [data.pastDue, "paiement(s) en échec", "/admin/abonnements?status=past_due"],
    [data.pendingAssos, "association(s) à valider", "/admin/associations"],
    [data.payouts, "versement(s) à effectuer", "/admin/reversements"],
    [data.leads, "demande(s) de présentation à contacter", "/admin/prospects"],
    [data.endingSoon, "essai(s) finissant sous 7 jours", "/admin/abonnements"],
    [data.unverified, "compte(s) sans e-mail vérifié depuis plus de 7 jours", "/admin/comptes"],
  ] as const;
  const open = alerts.filter(([count]) => count > 0);
  const max = Math.max(1, ...data.weekly.map((w) => Number(w.n)));
  const stats = [
    ["Comptes", data.accounts],
    ["Foyers", data.households],
    ["Abonnés payants", paid],
    ["MRR", mrr === null ? "—" : eur.format(mrr)],
    ["Conversion essai → payant", pct(paid, paid + data.trial + data.canceled)],
    ["Résiliations", pct(data.canceled, paid + data.canceled)],
  ] as const;
  return (
    <>
      <PageHeader title="Back-office" />
      <Card tone={open.length ? "yellow" : "surface"}>
        <h2 className="t-label">À traiter</h2>
        <ul className="t-small mt-2 flex flex-col gap-1">
          {open.map(([count, label, href]) => (
            <li key={label}>
              <Link href={href} className="underline">
                <b>{count}</b> {label}
              </Link>
            </li>
          ))}
          {!open.length && <li className="muted">Rien en attente.</li>}
        </ul>
      </Card>
      <dl className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-3">
        {stats.map(([label, value]) => (
          <Card as="div" key={label}>
            <dt className="t-label">{label}</dt>
            <dd className="num-l">{value}</dd>
          </Card>
        ))}
      </dl>
      <Card>
        <h2 className="t-label">Inscriptions par semaine (8 dernières)</h2>
        <ul className="mt-3 flex items-end gap-2" aria-label="Inscriptions par semaine">
          {data.weekly.map((w) => (
            <li key={w.week} className="flex flex-1 flex-col items-center gap-1 t-small">
              <b>{w.n}</b>
              <span className="w-full bg-ink" style={{ height: `${Math.max(4, (Number(w.n) / max) * 80)}px` }} aria-hidden="true" />
              <span className="mono muted">{w.week.slice(5)}</span>
            </li>
          ))}
          {!data.weekly.length && <li className="muted t-small">Aucune inscription.</li>}
        </ul>
      </Card>
      {mrr === null && (
        <p className="t-small muted">MRR indisponible : Stripe non configuré ou prix introuvables (STRIPE_PRICE_MONTHLY / YEARLY).</p>
      )}
    </>
  );
}
