import { Icon } from "@/components/ui/Icon";
import { type Badge, badgeLadder } from "@/engine/progress-view";
import { fr } from "@/i18n/fr";

const t = fr.progress.passport;

/** Losange d'un badge : obtenu = banane plein et ombré ; en cours = l'encre monte ; à venir = pointillé et cadenas. */
export function BadgeMark({ badge, large = false }: { badge: Badge; large?: boolean }) {
  const pct = Math.round(badge.progress * 100);
  const bg =
    badge.state === "earned"
      ? "var(--banane)"
      : badge.state === "current"
        ? `linear-gradient(to top left, var(--banane) ${pct}%, var(--surface) ${pct}%)`
        : "transparent";
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center ${large ? "size-[110px]" : "size-14 min-[900px]:size-[76px]"}`}
    >
      <span
        style={{ background: bg }}
        className={`box-border flex rotate-45 items-center justify-center border-[length:var(--bw)] border-line ${
          badge.state === "locked" ? "border-dashed" : ""
        } ${badge.state === "earned" ? "shadow-[var(--sh-sm)]" : ""} ${
          large ? "size-[76px]" : "size-[38px] min-[900px]:size-[50px]"
        }`}
      >
        <span className="flex -rotate-45">
          {badge.state === "locked" ? (
            <Icon name="lock" className="size-4" />
          ) : (
            <span
              className={`mono leading-none font-bold tracking-[-.04em] ${
                large ? "text-[30px]" : "text-base min-[900px]:text-xl"
              }`}
            >
              {badge.at}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

/** Badges de progression du passeport : un par palier de pays tamponnés. */
export function PassportBadges({ earned, total }: { earned: number; total: number }) {
  const ladder = badgeLadder(earned, total);
  const got = ladder.filter((b) => b.state === "earned").length;
  const current = ladder.find((b) => b.state === "current");
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="passport-badges">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="t-kicker">{t.badgesKicker}</h3>
        <span className="mono font-bold">{t.badgesCount(got, ladder.length)}</span>
      </div>
      <ol
        aria-label={t.badgesList}
        className="m-0 grid list-none gap-1 p-0"
        style={{ gridTemplateColumns: `repeat(${ladder.length}, minmax(0, 1fr))` }}
      >
        {ladder.map((b) => {
          const name = t.badgeNames[b.key];
          const status =
            b.state === "earned"
              ? t.badgeEarned
              : b.state === "current"
                ? t.badgeProgress(earned, b.at)
                : t.badgeLocked(b.at);
          return (
            <li
              key={b.key}
              data-state={b.state}
              aria-label={t.badgeLabel(name, b.at, status.toLowerCase())}
              className="flex min-w-0 flex-col items-center gap-1 text-center"
            >
              <BadgeMark badge={b} />
              <span aria-hidden="true" className="text-xs leading-tight font-bold [text-wrap:balance] min-[900px]:text-sm">
                {name}
              </span>
              <span aria-hidden="true" className="mono text-xs leading-tight">
                {status}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="t-small">
        {current
          ? t.badgeNext(got === 0, t.badgeNames[current.key], current.at - earned)
          : total > 0
            ? t.badgeDone
            : ""}
      </p>
    </div>
  );
}
