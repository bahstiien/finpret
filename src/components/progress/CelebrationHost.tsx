"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { SEASON_CODE, Stamp } from "@/components/ui/Stamp";
import { badgeLadder } from "@/engine/progress-view";
import type { Season } from "@/engine/passport";
import { fr } from "@/i18n/fr";
import { markAchievementsSeen } from "@/server/actions/progress";
import type { Celebrations } from "@/server/progress-view";
import { BadgeMark } from "./PassportBadges";
import { ShareButton } from "./ShareButton";

const t = fr.progress;

type Step = "milestone" | "stamps" | "badge";

/**
 * Célébrations (SPEC_PROGRES §3.5, §4.4 ; maquette Nos progrès) : à la fin de la session qui les déclenche, une seule
 * fois, d'abord le palier, puis les tampons (une feuille pour plusieurs), puis le badge de passeport franchi.
 * La fermeture marque comme vus (`achievements.seen_at`) ; le badge suit les tampons pays qui l'ont fait franchir.
 */
export function CelebrationHost({ data }: { data: Celebrations }) {
  const steps: Step[] = [
    ...(data.milestone ? (["milestone"] as const) : []),
    ...(data.stamps.length ? (["stamps"] as const) : []),
    ...(data.badge && data.stamps.length ? (["badge"] as const) : []),
  ];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const seen = (keys: string[]) => void markAchievementsSeen(keys);
  const next = () => {
    if (step === "milestone" && data.milestone) seen([`streak:${data.milestone.weeks}`]);
    if (step === "stamps") seen(data.stamps.map((s) => `${s.kind}:${s.key}`));
    setIndex((i) => i + 1);
  };

  const badge = data.badge ? badgeLadder(data.badge.countries, data.badge.total).find((b) => b.key === data.badge!.key) : null;
  const badgeName = data.badge ? t.passport.badgeNames[data.badge.key] : "";

  return (
    <>
      {data.milestone && (
        <Sheet open={step === "milestone"} onClose={next} title={t.streak.milestoneTitle(data.milestone.weeks)}>
          <div className="flex flex-col items-center gap-3 text-center" data-testid="milestone-sheet">
            <span className="nb tone-progres grid size-20 place-items-center">
              <Icon name="streak" className="size-10" />
            </span>
            <p className="t-body !text-lg">{t.streak.milestoneBody(data.milestone.meals)}</p>
            <ShareButton milestone={data.milestone.weeks} />
          </div>
        </Sheet>
      )}

      <Sheet
        open={step === "stamps"}
        onClose={next}
        title={data.stamps.length === 1 ? t.passport.newStamp(data.stamps[0]!.label) : t.passport.newStamps}
      >
        <ul
          className="m-0 flex list-none flex-wrap justify-center gap-6 border-[length:var(--bw)] border-line bg-[var(--yellow)] p-5"
          data-testid="new-stamps"
        >
          {data.stamps.map((s) => {
            const season = s.kind === "season" ? (s.key.split("-")[1] as Season) : undefined;
            return (
              <li key={`${s.kind}:${s.key}`}>
                <Stamp
                  kind={s.kind}
                  state="earned"
                  season={season}
                  name={s.label}
                  code={season ? SEASON_CODE[season] : s.key.toUpperCase()}
                  isNew
                  ariaLabel={t.passport.seasonEarnedLabel(s.label)}
                />
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="dark" className="btn--block" onClick={next}>
          {t.close}
        </Button>
      </Sheet>

      {data.badge && badge && (
        <Sheet open={step === "badge"} onClose={next} title={t.passport.badgeSheetTitle(badgeName)}>
          <div className="flex flex-col items-center gap-4 text-center" data-testid="badge-sheet">
            <BadgeMark badge={badge} large />
            <p className="t-body !text-lg">{t.passport.badgeSheetBody(data.badge.countries)}</p>
            <Link href="/app/progress?from=session" className={buttonClass({ variant: "outline", className: "btn--block" })} onClick={next}>
              {t.passport.seeProgress}
            </Link>
          </div>
        </Sheet>
      )}
    </>
  );
}
