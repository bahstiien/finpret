import { Icon } from "./Icon";
import { PhoneTabs } from "./Phone";

/**
 * Maquettes d'écrans (reference/design/) recomposées avec les jetons du design system.
 * Les données (plats, prénoms) sont des exemples.
 */

const days = [
  { n: 12, d: "Lun", past: true },
  { n: 13, d: "Mar", past: true },
  { n: 14, d: "Mer", past: true },
  { n: 15, d: "Jeu", today: true },
  { n: 16, d: "Ven" },
  { n: 17, d: "Sam", weekend: true },
  { n: 18, d: "Dim", weekend: true },
];

function Origin({ code }: { code: string }) {
  return (
    <span className="rounded-sm border border-ink/40 px-1 py-px text-xs leading-none font-bold">
      {code}
    </span>
  );
}

function Badge({ tone, children }: { tone: "yellow" | "violet" | "chip"; children: React.ReactNode }) {
  const tones = {
    yellow: "bg-yellow-soft text-cream-ink",
    violet: "bg-violet-soft text-violet-strong",
    chip: "bg-chip text-ink",
  };
  return <span className={`rounded-r2 px-2 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

/** Menu du jour : bandeau des jours, frise du jour, tuiles « Ce soir » et « Avant de dormir ». */
export function MenuScreen() {
  return (
    <>
      <div className="px-4">
        <p className="text-xs font-semibold text-muted">Jeudi 15 octobre</p>
        <p className="font-display text-2xl leading-tight font-bold">Bonsoir, Camille</p>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {days.map((day) => (
            <div
              key={day.n}
              className={`rounded-card py-1 text-center ${
                day.today
                  ? "bg-banana text-[#17151f]"
                  : day.weekend
                    ? "bg-surface ring-2 ring-banana ring-inset"
                    : "bg-surface"
              } ${day.past ? "text-muted" : ""}`}
            >
              <p className="font-display text-sm leading-none font-bold">{day.n}</p>
              <p className="mt-0.5 text-xs font-semibold">{day.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-card bg-surface p-3 border-[length:var(--bw)] border-line">
          <div className="flex gap-3">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-green text-white">
              <Icon name="check" className="size-3" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted">Midi · à réchauffer</p>
              <p className="flex items-center gap-1 text-xs leading-snug font-bold">
                <Origin code="IN" /> Curry de pois chiches coco
              </p>
              <div className="mt-1">
                <Badge tone="yellow">Favori</Badge>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-line" />
            <div>
              <p className="text-xs font-semibold text-muted">Soir · 15 min</p>
              <p className="flex items-center gap-1 text-xs leading-snug font-bold">
                <Origin code="IT" /> Pâtes poireaux, saumon et citron
              </p>
              <div className="mt-1">
                <Badge tone="violet">Soir simple</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-card bg-nav p-3 text-on-nav border-[length:var(--bw)] border-line">
            <span className="grid size-8 place-items-center rounded-card bg-banana text-[#17151f] border-[length:var(--bw)] border-line">
              <Icon name="pot" className="size-[18px]" />
            </span>
            <p className="mt-4 text-xs font-semibold opacity-80">Ce soir</p>
            <p className="font-display text-sm leading-tight font-bold">Cuis 200 g de pâtes</p>
          </div>
          <div className="rounded-card bg-yellow-soft p-3 text-cream-ink border-[length:var(--bw)] border-line">
            <span className="grid size-8 place-items-center rounded-card bg-white">
              <Icon name="snowflake" className="size-[18px]" />
            </span>
            <p className="mt-4 text-xs font-semibold">Avant de dormir</p>
            <p className="font-display text-sm leading-tight font-bold">
              Sors le chili du congélateur
            </p>
          </div>
        </div>
      </div>
      <PhoneTabs active="Menu" />
    </>
  );
}

const mealRows = [
  { label: "Midi", cells: ["on", "on", "on", "today", "on", "FR", "FR"] },
  { label: "Soir", cells: ["on", "on", "on", "today", "off", "add", "add"] },
] as const;
const weekdayLetters = ["L", "M", "M", "J", "V", "S", "D"];

/** Menu de la semaine : grille « Repas à prévoir », bandeau week-end et plat star. */
export function WeekScreen() {
  return (
    <div className="px-4">
      <p className="font-display text-xl leading-tight font-bold">Repas à prévoir</p>
      <div className="mt-2 rounded-card bg-surface p-3 border-[length:var(--bw)] border-line">
        <div className="grid grid-cols-[34px_repeat(7,1fr)] gap-1 text-center text-xs font-bold">
          <span />
          {weekdayLetters.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        {mealRows.map((row) => (
          <div key={row.label} className="mt-1 grid grid-cols-[34px_repeat(7,1fr)] items-center gap-1">
            <span className="text-xs font-bold text-muted">{row.label}</span>
            {row.cells.map((cell, i) => (
              <span
                key={i}
                className={`grid h-8 place-items-center rounded-card text-xs font-bold ${
                  cell === "on"
                    ? "bg-violet text-white"
                    : cell === "today"
                      ? "bg-nav text-on-nav"
                      : cell === "FR"
                        ? "bg-banana text-[#17151f]"
                        : cell === "add"
                          ? "bg-surface text-[#17151f] ring-2 ring-banana ring-inset"
                          : "bg-chip text-muted"
                }`}
              >
                {cell === "on" || cell === "today" ? (
                  <Icon name="check" className="size-4" />
                ) : cell === "add" ? (
                  <Icon name="plus" className="size-4" />
                ) : cell === "off" ? (
                  "–"
                ) : (
                  cell
                )}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-card bg-violet p-4 text-white border-[length:var(--bw)] border-line">
        <p className="font-display text-base leading-tight font-bold">
          Samedi et dimanche soir à remplir
        </p>
        <p className="mt-1 text-xs font-bold">Cuisiné le jour même</p>
        <span className="mt-3 flex h-10 items-center justify-center gap-1 rounded-r2 bg-white text-xs font-bold text-[#17151f]">
          <Icon name="sparkle" className="size-4" /> Suggérer des idées
        </span>
      </div>

      <p className="mt-4 text-xs font-bold">Plats de la semaine</p>
      <div className="mt-2 rounded-card bg-surface p-3 border-[length:var(--bw)] border-line">
        <p className="flex items-center gap-1 text-sm font-bold">
          <Origin code="MX" /> Chili con carne
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          6 portions · doublé <Icon name="snowflake" className="size-3" />
        </p>
      </div>
    </div>
  );
}

/** Courses : en-tête rose et progression, liste par rayon, placard à vérifier. */
export function ShoppingScreen() {
  return (
    <div className="px-4">
      <div className="rounded-card bg-pink-soft p-3 text-pink-ink border-[length:var(--bw)] border-line">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-xl font-bold">Courses</p>
          <p className="font-display text-xl font-bold">12/31</p>
        </div>
        <p className="text-xs font-bold">Partagée avec Julien · triée par rayon</p>
        <div className="mt-2 h-2 rounded-r2 bg-pink-ink/20">
          <div className="h-full w-[39%] rounded-r2 bg-pink-ink" />
        </div>
      </div>

      <div className="mt-3 rounded-card bg-surface p-3 border-[length:var(--bw)] border-line">
        <p className="text-xs font-bold tracking-wider text-muted uppercase">Fruits et légumes</p>
        {[
          { name: "Butternut", qty: "1 grosse" },
          { name: "Poireaux", qty: "1 botte de 3" },
          { name: "Citrons", qty: "2", done: true },
        ].map((item) => (
          <div key={item.name} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-card ${
                item.done ? "bg-green text-white" : "border-2 border-line"
              }`}
            >
              {item.done && <Icon name="check" className="size-3.5" />}
            </span>
            <span className={`flex-1 text-xs font-bold ${item.done ? "text-muted line-through" : ""}`}>
              {item.name}
            </span>
            <span className="text-xs text-muted">{item.qty}</span>
          </div>
        ))}
        <p className="mt-2 text-xs font-bold tracking-wider text-muted uppercase">Épicerie</p>
        {[
          { name: "Pâtes complètes", qty: "2 paquets de 500 g" },
          { name: "Lentilles corail", qty: "1 paquet de 500 g" },
        ].map((item) => (
          <div key={item.name} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
            <span className="size-6 shrink-0 rounded-card border-2 border-line" />
            <span className="flex-1 text-xs font-bold">{item.name}</span>
            <span className="text-xs text-muted">{item.qty}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-card bg-yellow-soft p-3 text-cream-ink border-[length:var(--bw)] border-line">
        <p className="font-display text-sm font-bold">Placard, à vérifier avant de partir</p>
        <div className="mt-2 flex gap-1 text-xs font-bold text-[#17151f]">
          <span className="rounded-r2 bg-white px-3 py-1">Cumin</span>
          <span className="flex items-center gap-1 rounded-r2 bg-nav px-3 py-1 text-on-nav">
            <Icon name="check" className="size-3" /> Bouillon
          </span>
        </div>
      </div>
    </div>
  );
}

/** Session : minuteurs, étape en cours en bleu, tâches à cocher, action jaune unique. */
export function SessionScreen() {
  return (
    <div className="px-3">
      <div className="flex gap-2">
        <div className="timer-ready flex flex-1 items-center justify-between rounded-r2 bg-banana py-1 pr-1 pl-3 text-[#17151f]">
          <div>
            <p className="text-xs font-semibold">Lentilles</p>
            <p className="font-display text-sm leading-none font-bold">Prêt !</p>
          </div>
          <span className="grid h-8 w-11 place-items-center rounded-r2 bg-[#17151f]/70 text-xs font-bold text-white">
            OK
          </span>
        </div>
        <div className="flex flex-1 items-center justify-between rounded-r2 bg-surface py-1 pr-1 pl-3">
          <div>
            <p className="text-xs font-semibold">Chili · plaque 1</p>
            <p className="font-display text-sm leading-none font-bold">18:42</p>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between px-1">
        <div>
          <p className="text-xs font-semibold text-muted">14:00 → fin prévue 16:36</p>
          <p className="font-display text-sm font-bold">Étape 5 sur 12</p>
        </div>
        <span className="rounded-r2 bg-peach px-2 py-1 text-xs font-bold text-peach-ink">+6 min</span>
      </div>

      <div className="mt-2 rounded-card bg-blue-soft p-3 text-blue-ink border-[length:var(--bw)] border-line">
        <div className="flex items-center justify-between">
          <p className="font-display text-4xl leading-none font-bold">15:10</p>
          <span className="flex items-center gap-1 rounded-r2 bg-white px-2 py-1 text-xs font-bold">
            <Icon name="fridge" className="size-3.5" /> Four, grille 1
          </span>
        </div>
        <p className="mt-3 font-display text-xl leading-tight font-bold text-ink">
          Enfourne la butternut
        </p>
        <div className="mt-3 rounded-card bg-surface px-3 text-ink border-[length:var(--bw)] border-line">
          {[
            { t: "Cubes de 2 cm", done: true },
            { t: "Huile d’olive, sel, cumin", done: true },
            { t: "Enfourne à 200 °C" },
          ].map((task) => (
            <div key={task.t} className="flex items-center gap-2 border-b border-line py-2 last:border-0">
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full ${
                  task.done ? "bg-green text-white" : "border-2 border-line"
                }`}
              >
                {task.done && <Icon name="check" className="size-3" />}
              </span>
              <span className={`text-xs font-bold ${task.done ? "text-muted line-through" : ""}`}>
                {task.t}
              </span>
            </div>
          ))}
        </div>
        <span className="mt-3 flex h-11 items-center justify-center gap-1 rounded-r2 bg-banana text-xs font-bold text-[#17151f]">
          <Icon name="timer" className="size-4" /> Lancer le minuteur de 25 min
        </span>
      </div>
    </div>
  );
}
