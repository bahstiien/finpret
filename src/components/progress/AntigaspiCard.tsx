import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { Impact } from "@/engine/antigaspi";
import { fr } from "@/i18n/fr";

const t = fr.progress.antigaspi;
const kg = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function Figure({ label, impact, id }: { label: string; impact: Impact; id: string }) {
  return (
    <div className="flex flex-col gap-1" data-testid={id}>
      <p className="t-kicker">{label}</p>
      <p className="t-ui font-bold">{t.saved(impact.count)}</p>
      {impact.grams >= 100 && <p className="t-small">{t.weight(kg.format(impact.grams / 1000))}</p>}
      {impact.urgent > 0 && <p className="t-small">{t.urgent(impact.urgent)}</p>}
    </div>
  );
}

/** Anti-gaspi (écran Progrès) : ingrédients pris dans le stock par les sessions, ce mois-ci et depuis le début. */
export function AntigaspiCard({ month, total }: { month: Impact; total: Impact }) {
  return (
    <Card tone="green" className="flex flex-col gap-4" aria-labelledby="antigaspi-title" data-testid="antigaspi">
      <div className="flex items-center justify-between gap-3">
        <h2 id="antigaspi-title" className="t-2">
          {t.title}
        </h2>
        <Icon name="leaf" className="size-8" />
      </div>
      {total.count === 0 ? (
        <p className="t-small">{t.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Figure label={t.monthLabel} impact={month} id="antigaspi-month" />
          <Figure label={t.totalLabel} impact={total} id="antigaspi-total" />
        </div>
      )}
    </Card>
  );
}
