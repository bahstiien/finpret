import type { Metadata } from "next";
import { CodeForm } from "@/components/asso/CodeForm";
import { StatusBanner } from "@/components/asso/StatusBanner";
import { fr } from "@/i18n/fr";
import { requireManager } from "@/server/asso-session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.asso.dashboard;

export const metadata: Metadata = { title: t.title };

type Stats = {
  households: number | null;
  monthly: number | null;
  yearly: number | null;
  current_quarter_cents: number;
  paid_total_cents: number;
};

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Tableau de bord : agrégats uniquement, tout compteur inférieur à 5 est affiché « moins de 5 » (D13). */
export default async function AssoDashboardPage() {
  const association = await requireManager();
  const supabase = await createClient();
  const { data } = await supabase.rpc("association_stats", { aid: association.id });
  const stats = (data ?? {}) as Stats;
  const count = (n: number | null | undefined) => (n === null || n === undefined ? t.fewer : String(n));
  const cards = [
    { label: t.households, value: count(stats.households) },
    { label: t.monthly, value: count(stats.monthly) },
    { label: t.yearly, value: count(stats.yearly) },
    { label: t.quarter, value: euros.format((stats.current_quarter_cents ?? 0) / 100) },
    { label: t.paid, value: euros.format((stats.paid_total_cents ?? 0) / 100) },
  ];
  return (
    <>
      <PageHeader title={t.title} />
      <StatusBanner association={association} />
      <Card tone="banane" className="flex flex-col gap-2" aria-label={t.code}>
        <h2 className="t-label">{t.code}</h2>
        <p className="num-l" data-testid="asso-code">
          {association.code}
        </p>
        <p className="t-small">
          {t.codeHint}
          {association.code}
        </p>
        <Card as="div" tone="surface" className="!shadow-none">
          <CodeForm code={association.code} />
        </Card>
      </Card>
      <dl className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3" data-testid="asso-stats">
        {cards.map((c, i) => (
          <div key={c.label} className={`card flex flex-col gap-1 ${i < 3 ? "tone-blue" : "tone-green"}`}>
            <dt className="t-label">{c.label}</dt>
            <dd className="num-l">{c.value}</dd>
          </div>
        ))}
      </dl>
      <p className="t-small muted">{t.fewerHint}</p>
      <Card aria-label={t.schools}>
        <h2 className="t-2 mb-2">{t.schools}</h2>
        <ul>
          {association.schools.map((s) => (
            <li key={s.id} className="row t-body">
              {s.name} ({s.city})
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
