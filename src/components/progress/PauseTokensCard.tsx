import { Icon } from "@/components/ui/Icon";
import { PAUSES_PER_QUARTER } from "@/engine/streak";
import { fr } from "@/i18n/fr";
import { formatAbbr } from "@/lib/dates";
import type { ProgressView } from "@/server/progress-view";
import { PauseSheet } from "./PauseSheet";

const t = fr.progress.streak;

/** Jetons de pause (maquette Nos progrès) : 2 par trimestre civil, chaque jeton pris porte sa date. */
export function PauseTokensCard({ view, canEdit }: { view: ProgressView; canEdit: boolean }) {
  const used = view.tokens.used.slice(-PAUSES_PER_QUARTER);
  const left = Math.max(0, PAUSES_PER_QUARTER - view.tokens.used.length);
  const hasUpcoming = used.some((u) => u.upcoming);
  const slots = [
    ...Array.from({ length: left }, () => null),
    ...used,
  ];
  return (
    <section className="card flex min-w-0 flex-col gap-4" aria-labelledby="pause-title" data-testid="pause-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pause-title" className="t-3">
          {t.pauseTokens}
        </h2>
        <span className="num-l" aria-label={t.tokensCount(left, PAUSES_PER_QUARTER)}>
          {left}/{PAUSES_PER_QUARTER}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <ul className="m-0 flex flex-none list-none gap-3 p-0">
          {slots.map((s, i) => (
            <li key={s?.weekStart ?? `free-${i}`} className="flex flex-col items-center gap-1.5">
              {s ? (
                <span
                  role="img"
                  aria-label={(s.upcoming ? t.tokenPlannedLabel : t.tokenUsedLabel)(formatAbbr(s.weekStart))}
                  className="box-border flex size-14 items-center justify-center border-[length:var(--bw)] border-dotted border-line text-muted"
                >
                  <Icon name="pause" className="size-7" />
                </span>
              ) : (
                <span
                  role="img"
                  aria-label={t.tokenFreeLabel}
                  className="tone-banane box-border flex size-14 items-center justify-center border-[length:var(--bw)] border-line shadow-[var(--sh-sm)]"
                >
                  <Icon name="pause" className="size-7" />
                </span>
              )}
              <span className="t-kicker" aria-hidden="true">
                {s ? formatAbbr(s.weekStart) : t.tokenFree}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex min-w-0 flex-1 flex-col gap-0.5" data-testid="pauses-left">
          <span className="t-ui">{t.tokensStatus(left)}</span>
          <span className="t-small">{left === 0 ? t.tokensRenew(formatAbbr(view.tokens.renewOn)) : t.tokensSub}</span>
        </p>
      </div>

      <p className="t-small">{t.pauseHelp}</p>

      {canEdit ? (
        (left > 0 || hasUpcoming) && (
          <PauseSheet options={view.streak.pauseOptions} mode={left > 0 ? "plan" : "view"} />
        )
      ) : (
        <p className="t-small flex items-start gap-2 border-[length:var(--bw)] border-dashed border-line bg-chip p-3">
          <Icon name="lock" className="size-4 flex-none" />
          <span>{t.readOnly}</span>
        </p>
      )}
    </section>
  );
}
