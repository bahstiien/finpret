import { fr } from "@/i18n/fr";

const t = fr.progress.stats;

/** Bandeau de chiffres (maquette Progrès) : sessions terminées, repas maison, origines cuisinées. */
export function ProgressStats({ sessions, meals, origins }: { sessions: number; meals: number; origins: number }) {
  const items = [
    { label: t.sessions, value: sessions, id: "stat-sessions" },
    { label: t.meals, value: meals, id: "stat-meals" },
    { label: t.origins, value: origins, id: "stat-origins" },
  ];
  return (
    <dl className="bento grid-cols-3 shadow-[var(--sh)]" aria-label={t.label} data-testid="progress-stats">
      {items.map((i) => (
        <div key={i.id} className="flex flex-col gap-1 p-3">
          <dt className="t-kicker">{i.label}</dt>
          <dd className="num-l" data-testid={i.id}>
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
