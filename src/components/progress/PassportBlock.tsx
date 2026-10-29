"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { Stamp } from "@/components/ui/Stamp";
import type { CountryEntry, SeasonEntry } from "@/engine/progress-view";
import { fr } from "@/i18n/fr";
import { formatShort } from "@/lib/dates";
import { recordProgressEvent } from "@/server/actions/progress";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const t = fr.progress.passport;

/** Passeport des saveurs (SPEC_PROGRES §4.4) : grille de tampons pays, rangée des saisons, feuilles de détail. */
export function PassportBlock({ countries, seasons }: { countries: CountryEntry[]; seasons: SeasonEntry[] }) {
  const router = useRouter();
  const [country, setCountry] = useState<CountryEntry | null>(null);
  const [season, setSeason] = useState<SeasonEntry | null>(null);
  const earned = countries.filter((c) => c.earned).length;
  const percent = countries.length ? Math.round((earned / countries.length) * 100) : 0;

  const press = (c: CountryEntry) => {
    if (c.earned) return setCountry(c);
    void recordProgressEvent({ name: "empty_stamp_tapped", origin: c.code });
    router.push(`/app/discover?origin=${c.code}`);
  };

  return (
    <Card className="flex flex-col gap-4" aria-labelledby="passport-title">
      <div className="flex flex-col gap-2">
        <h2 id="passport-title" className="text-2xl font-bold">
          {t.title}
        </h2>
        <p className="font-bold" data-testid="passport-count">
          {t.countries(earned, countries.length)}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={countries.length}
          aria-valuenow={earned}
          aria-label={t.countries(earned, countries.length)}
          className="h-3 overflow-hidden rounded-r2 bg-chip"
        >
          <div className="h-full rounded-r2 bg-violet" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ul
        className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] justify-items-center gap-3"
        data-testid="country-stamps"
      >
        {countries.map((c) => (
          <li key={c.code}>
            <Stamp
              kind="country"
              state={c.earned ? "earned" : "empty"}
              label={c.label}
              code={c.code.toUpperCase()}
              count={c.earned ? t.count(c.cooked.length, c.total) : undefined}
              ariaLabel={
                c.earned ? t.earnedLabel(c.label, c.cooked.length, c.total) : t.emptyLabel(c.label, c.total)
              }
              onPress={() => press(c)}
            />
          </li>
        ))}
      </ul>

      <ul
        className="flex flex-wrap justify-center gap-3 border-t border-line pt-4"
        data-testid="season-stamps"
      >
        {seasons.map((s) => {
          const label = t.seasonLabel(t.seasons[s.season], s.year);
          return (
            <li key={s.key}>
              <Stamp
                kind="season"
                state={s.earned ? "earned" : "empty"}
                season={s.season}
                label={label}
                code={s.key}
                count={s.earned ? undefined : t.seasonProgress(Math.min(s.count, 6))}
                ariaLabel={s.earned ? t.seasonEarnedLabel(label) : t.seasonProgressLabel(label, s.count)}
                onPress={() => setSeason(s)}
              />
            </li>
          );
        })}
      </ul>

      <Sheet open={!!country} onClose={() => setCountry(null)} title={country?.label ?? ""}>
        {country && (
          <div className="flex flex-col gap-4" data-testid="country-sheet">
            <p className="font-bold">{t.count(country.cooked.length, country.total)}</p>
            <div>
              <h3 className="mb-2 font-bold">{t.cooked}</h3>
              <ul className="flex flex-col gap-2">
                {country.cooked.map((r) => (
                  <li
                    key={r.id}
                    className="flex justify-between gap-3 rounded-card bg-violet-soft px-4 py-2 text-violet-strong border-[length:var(--bw)] border-line"
                  >
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-sm">{formatShort(r.on)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-bold">{t.remaining}</h3>
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

      <Sheet
        open={!!season}
        onClose={() => setSeason(null)}
        title={season ? t.seasonLabel(t.seasons[season.season], season.year) : ""}
      >
        {season && (
          <div className="flex flex-col gap-2">
            <p className="font-bold">{t.seasonProgress(Math.min(season.count, 6))}</p>
            <p className="text-muted">{t.seasonRule}</p>
          </div>
        )}
      </Sheet>
    </Card>
  );
}
