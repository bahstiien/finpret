"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { SEASON_CODE, Stamp } from "@/components/ui/Stamp";
import { Flag } from "@/components/menu/Flag";
import type { CountryEntry, SeasonCard } from "@/engine/progress-view";
import { SEASON_STAMP_THRESHOLD } from "@/engine/passport";
import { fr } from "@/i18n/fr";
import { formatAbbr, formatShort } from "@/lib/dates";
import { recordProgressEvent } from "@/server/actions/progress";
import type { Flag as FlagData } from "@/server/menu-view";
import { PassportBadges } from "./PassportBadges";

const t = fr.progress.passport;
const GHOSTS = 3;

type Props = {
  countries: CountryEntry[];
  seasons: { current: SeasonCard; others: SeasonCard[] };
  /** Dernier jour de la saison en cours (ISO) et premier jour de la suivante. */
  seasonEnd: string;
  nextSeasonStart: string;
  seasonsEarned: number;
  flags: Record<string, FlagData>;
  /** Carte du monde (lot mappemonde), rendue en tête du passeport. */
  map?: React.ReactNode;
};

const seasonName = (s: SeasonCard) => t.seasonLabel(t.seasons[s.season], s.year);

/** Passeport des saveurs (maquette Nos progrès) : badges, tampons obtenus, pays à gagner, saisons. */
export function PassportBlock({ countries, seasons, seasonEnd, nextSeasonStart, seasonsEarned, flags, map }: Props) {
  const [country, setCountry] = useState<CountryEntry | null>(null);
  const [allGhosts, setAllGhosts] = useState(false);
  const earned = countries.filter((c) => c.earned);
  const toEarn = countries.filter((c) => !c.earned);
  const latest = earned.reduce((m, c) => ((c.firstCookedOn ?? "") > m ? (c.firstCookedOn ?? "") : m), "");
  const ghosts = allGhosts ? toEarn : toEarn.slice(0, GHOSTS);
  const cur = seasons.current;
  const curLeft = SEASON_STAMP_THRESHOLD - Math.min(cur.count, SEASON_STAMP_THRESHOLD);

  return (
    <div
      className="flex min-w-0 flex-col gap-7 border-[length:var(--bw)] border-line bg-[var(--yellow)] p-4 text-[var(--ink-fixed)] shadow-[var(--sh-sm)] min-[900px]:gap-8 min-[900px]:p-6"
      data-testid="passport"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="t-kicker">{t.countriesKicker}</h3>
          <span className="mono font-bold" data-testid="passport-count">
            {t.countries(earned.length, countries.length)}
          </span>
        </div>
        {map}
      </div>

      <PassportBadges earned={earned.length} total={countries.length} />

      {earned.length > 0 ? (
        <ul
          aria-label={t.stampedList}
          data-testid="country-stamps"
          className="m-0 grid list-none grid-cols-3 gap-x-2 gap-y-5 p-0"
        >
          {earned.map((c) => {
            const isNew = !!latest && c.firstCookedOn === latest;
            const legend = t.recipesOf(c.cooked.length, c.total);
            const flag = flags[c.code];
            return (
              <li key={c.code} className="flex min-w-0 justify-center">
                <Stamp
                  kind="country"
                  state="earned"
                  code={c.code.toUpperCase()}
                  name={c.firstCookedOn ? `${c.label} · ${t.stampDate(c.firstCookedOn)}` : c.label}
                  legend={legend}
                  isNew={isNew}
                  compact
                  flag={flag ? <Flag flag={flag} /> : undefined}
                  ariaLabel={`${c.label}, ${legend}${isNew ? `, ${t.newBadge.toLowerCase()} tampon` : ""}`}
                  onPress={() => setCountry(c)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="t-ui">{t.firstHint}</p>
          <p className="t-small">{t.firstHintSub}</p>
        </div>
      )}

      {toEarn.length > 0 && (
        <div className="flex flex-col">
          <h3 className="t-kicker mb-2">{earned.length > 0 ? t.toEarn : t.toStart}</h3>
          <ul id="countries-to-earn" className="m-0 list-none p-0" data-testid="countries-to-earn">
            {ghosts.map((c) => (
              <li key={c.code} className="border-t-[length:var(--bw)] border-line">
                <Link
                  href={`/app/discover?origin=${c.code}`}
                  data-state="empty"
                  onClick={() => void recordProgressEvent({ name: "empty_stamp_tapped", origin: c.code })}
                  className="flex min-h-16 items-center gap-3 py-2 text-inherit no-underline"
                >
                  <span aria-hidden="true" className="flex size-16 flex-none items-center justify-center">
                    <span className="flex scale-[.56]">
                      <span className="stamp stamp--empty">
                        <span className="stamp-name">{c.label}</span>
                      </span>
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t-ui">{c.label}</span>
                    {c.remaining[0] && <span className="t-small">{t.tryRecipe(c.remaining[0].name)}</span>}
                  </span>
                  <Icon name="chevronRight" className="size-5" />
                </Link>
              </li>
            ))}
          </ul>
          {toEarn.length > GHOSTS && (
            <div className="border-t-[length:var(--bw)] border-line pt-2">
              <button
                type="button"
                className="btn btn--ghost btn--sm !pl-0"
                aria-expanded={allGhosts}
                aria-controls="countries-to-earn"
                onClick={() => setAllGhosts((v) => !v)}
              >
                <span>{allGhosts ? t.seeLess : t.seeAllToEarn(toEarn.length)}</span>
                <Icon name={allGhosts ? "chevronDown" : "chevronRight"} className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3" data-testid="season-stamps">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="t-kicker">{t.seasonsKicker}</h3>
          <span className="mono font-bold">{t.seasonsCount(seasonsEarned)}</span>
        </div>
        <p className="t-small">{t.seasonIntro}</p>
        <div className="flex items-center gap-4 border-[length:var(--bw)] border-line bg-surface p-3 text-ink">
          <Stamp
            kind="season"
            state={cur.earned ? "earned" : "progress"}
            season={cur.season}
            code={SEASON_CODE[cur.season]}
            name={seasonName(cur)}
            fill={Math.min(cur.count, SEASON_STAMP_THRESHOLD) / SEASON_STAMP_THRESHOLD}
            compact
            ariaLabel={cur.earned ? t.seasonEarnedLabel(seasonName(cur)) : t.seasonProgressLabel(seasonName(cur), cur.count)}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="t-ui">{t.seasonCurrent(seasonName(cur))}</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="t-small font-bold">{t.seasonRecipes}</span>
                <span className="mono t-small font-bold">{t.seasonProgress(Math.min(cur.count, SEASON_STAMP_THRESHOLD))}</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={SEASON_STAMP_THRESHOLD}
                aria-valuenow={Math.min(cur.count, SEASON_STAMP_THRESHOLD)}
                aria-label={t.seasonRecipes}
                className="bar"
              >
                <div
                  className="bar-fill"
                  style={{ width: `${(Math.min(cur.count, SEASON_STAMP_THRESHOLD) / SEASON_STAMP_THRESHOLD) * 100}%` }}
                />
              </div>
            </div>
            <p className="t-small">{t.seasonLeft(curLeft, formatAbbr(seasonEnd))}</p>
          </div>
        </div>
        <ul aria-label={t.seasonOthers} className="m-0 grid list-none grid-cols-3 gap-2 p-0 pt-2">
          {seasons.others.map((s) => {
            const name = seasonName(s);
            const legend =
              s.state === "earned"
                ? t.seasonState.earned
                : s.state === "missed"
                  ? t.seasonState.missed(Math.min(s.count, SEASON_STAMP_THRESHOLD))
                  : t.seasonState.upcoming(formatAbbr(nextSeasonStart));
            return (
              <li key={s.key} className="flex min-w-0 justify-center">
                <Stamp
                  kind="season"
                  state={s.earned ? "earned" : "empty"}
                  season={s.season}
                  code={SEASON_CODE[s.season]}
                  name={name}
                  legend={legend}
                  compact
                  ariaLabel={`${name}, ${legend}`}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <Sheet open={!!country} onClose={() => setCountry(null)} title={country?.label ?? ""}>
        {country && (
          <div className="flex flex-col gap-4" data-testid="country-sheet">
            <p className="mono font-bold">{t.count(country.cooked.length, country.total)}</p>
            <div>
              <h3 className="t-label mb-2">{t.cooked}</h3>
              <ul className="flex flex-col gap-2">
                {country.cooked.map((r) => (
                  <li key={r.id} className="nb-flat tone-violet flex justify-between gap-3 px-4 py-2">
                    <span className="t-ui">{r.name}</span>
                    <span className="mono t-small">{formatShort(r.on)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="t-label mb-2">{t.remaining}</h3>
              {country.remaining.length === 0 ? (
                <p className="text-muted">{t.none}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {country.remaining.map((r) => (
                    <li key={r.id}>
                      <Pill>{r.name}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {country.remaining.length > 0 && (
              <Link href={`/app/discover?origin=${country.code}`} className={buttonClass()}>
                {t.discover}
              </Link>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
