import { fr } from "@/i18n/fr";

const t = fr.progress.stats;

/** « Tes chiffres » (maquette Nos progrès) : sessions terminées, repas maison, origines cuisinées. */
export function ProgressStats({ sessions, meals, origins }: { sessions: number; meals: number; origins: number }) {
  const items = [
    { label: t.sessions, value: sessions, id: "stat-sessions" },
    { label: t.meals, value: meals, id: "stat-meals" },
    { label: t.origins, value: origins, id: "stat-origins" },
  ];
  return (
    <section aria-labelledby="stats-title" className="flex min-w-0 flex-col gap-4">
      <h2 id="stats-title" className="t-2">
        {t.label}
      </h2>
      <dl className="bento m-0 grid-cols-3 shadow-[var(--sh)]" data-testid="progress-stats">
        {items.map((i) => (
          <div key={i.id} className="flex flex-col justify-start gap-1 p-3">
            <dt className="t-kicker order-2">{i.label}</dt>
            <dd className="num-l order-1 m-0" data-testid={i.id}>
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
