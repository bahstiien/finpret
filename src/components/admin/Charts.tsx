import { formatShort } from "@/lib/dates";

/**
 * Graphiques du back-office, dessinés en HTML et SVG côté serveur (aucune librairie) : couleurs pleines du design
 * system, bordure encre, pas de dégradé. Chaque graphique porte un résumé lisible par les lecteurs d'écran.
 */

export type ChartColor = "violet" | "banane" | "green" | "blue" | "pink" | "peach" | "chip";
const FILL: Record<ChartColor, string> = {
  violet: "var(--violet)",
  banane: "var(--banane)",
  green: "var(--green)",
  blue: "var(--blue)",
  pink: "var(--pink)",
  peach: "var(--peach)",
  chip: "var(--chip)",
};

/** Histogramme vertical d'une série (jours ou semaines) ; un libellé d'axe toutes les `labelEvery` barres. */
export function BarChart({
  data,
  label,
  color = "violet",
  labelEvery = 1,
  format = (k) => formatShort(k),
  height = 140,
}: {
  data: { key: string; n: number }[];
  label: string;
  color?: ChartColor;
  labelEvery?: number;
  format?: (key: string) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  const peak = data.reduce((best, d) => (d.n > best.n ? d : best), data[0] ?? { key: "", n: 0 });
  return (
    <figure className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`${label} : ${total} au total${peak.n ? `, maximum ${peak.n} le ${format(peak.key)}` : ""}.`}
        className="flex items-end gap-[3px] border-b-[length:var(--bw)] border-l-[length:var(--bw)] border-line pl-1"
        style={{ height }}
      >
        {data.map((d) => (
          <div
            key={d.key}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${format(d.key)} : ${d.n}`}
          >
            <span className="mono pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[11px] font-bold group-hover:block">
              {d.n}
            </span>
            <span
              className="block w-full border-[length:var(--bw)] border-b-0 border-line"
              style={{
                height: d.n ? `${Math.max(4, (d.n / max) * (height - 8))}px` : "0px",
                background: FILL[color],
                borderWidth: d.n ? undefined : 0,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] pl-1" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className="mono muted flex-1 overflow-visible whitespace-nowrap text-[10px]">
            {i % labelEvery === 0 ? format(d.key) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Barre empilée à 100 % avec légende : répartition d'un total (offres, états…). */
export function StackedBar({
  parts,
  label,
}: {
  parts: { label: string; n: number; color: ChartColor }[];
  label: string;
}) {
  const total = parts.reduce((s, p) => s + p.n, 0);
  const shown = parts.filter((p) => p.n > 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <figure className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`${label} : ${parts.map((p) => `${p.label} ${p.n}`).join(", ")}.`}
        className="flex h-10 w-full overflow-hidden border-[length:var(--bw)] border-line bg-chip"
      >
        {shown.map((p, i) => (
          <span
            key={p.label}
            title={`${p.label} : ${p.n} (${pct(p.n)} %)`}
            className={i ? "border-l-[length:var(--bw)] border-line" : ""}
            style={{ width: `${(p.n / total) * 100}%`, background: FILL[p.color] }}
          />
        ))}
      </div>
      <ul className="t-small grid grid-cols-2 gap-x-4 gap-y-1 min-[600px]:grid-cols-3" aria-hidden="true">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span
              className="size-3 shrink-0 border-[length:var(--bw)] border-line"
              style={{ background: FILL[p.color] }}
            />
            <span className="flex-1">{p.label}</span>
            <b className="mono">{p.n}</b>
            <span className="mono muted w-10 text-right">{pct(p.n)} %</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Entonnoir : chaque étape en barre horizontale, avec le taux de passage depuis l'étape précédente. */
export function Funnel({
  steps,
  label,
}: {
  steps: { label: string; n: number; hint?: string }[];
  label: string;
}) {
  const top = Math.max(1, steps[0]?.n ?? 0);
  const colors: ChartColor[] = ["violet", "blue", "green", "banane", "pink"];
  return (
    <ol className="flex flex-col gap-3" aria-label={label}>
      {steps.map((s, i) => {
        const prev = steps[i - 1]?.n ?? 0;
        const rate = i && prev ? Math.round((s.n / prev) * 100) : null;
        return (
          <li key={s.label} className="flex flex-col gap-1">
            <div className="t-small flex items-baseline justify-between gap-2">
              <span>
                <b>{s.label}</b>
                {s.hint && <span className="muted"> · {s.hint}</span>}
              </span>
              <span className="mono">
                <b>{s.n}</b>
                {rate !== null && <span className="muted"> · {rate} % de l&apos;étape précédente</span>}
              </span>
            </div>
            <span className="block h-6 border-[length:var(--bw)] border-line bg-chip" aria-hidden="true">
              <span
                className="block h-full border-r-[length:var(--bw)] border-line"
                style={{
                  width: `${(s.n / top) * 100}%`,
                  background: FILL[colors[i % colors.length] ?? "violet"],
                  borderRightWidth: s.n ? undefined : 0,
                }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Indicateur chiffré avec évolution par rapport à la période précédente. */
export function Kpi({
  label,
  value,
  delta,
  hint,
  tone = "surface",
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  hint?: string;
  tone?: "surface" | "violet" | "banane" | "green";
}) {
  return (
    <div className={`card flex flex-col gap-1 !shadow-none ${tone === "surface" ? "" : `tone-${tone}`}`}>
      <dt className="t-label">{label}</dt>
      <dd className="num-l">{value}</dd>
      {(delta !== undefined || hint) && (
        <dd className="t-small">
          {delta !== undefined && delta !== null && (
            <b className="mono">
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {delta > 0 ? "+" : ""}
              {delta} %
            </b>
          )}
          {hint && <span className="opacity-80"> {hint}</span>}
        </dd>
      )}
    </div>
  );
}
