"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Stamp } from "@/components/ui/Stamp";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { fr } from "@/i18n/fr";
import { markAchievementsSeen } from "@/server/actions/progress";
import { ShareButton } from "./ShareButton";
import type { Celebrations } from "@/server/progress-view";

const t = fr.progress;

/**
 * Célébrations (SPEC_PROGRES §3.5, §4.4) : à la première ouverture après l'inscription, une feuille courte liste les
 * nouveaux tampons (une seule pour plusieurs tampons), puis la feuille du palier avec la carte à partager.
 * Un seul affichage par tampon : la fermeture les marque comme vus (`achievements.seen_at`).
 */
export function CelebrationHost({ data }: { data: Celebrations }) {
  const [stampsOpen, setStampsOpen] = useState(data.stamps.length > 0);
  const [milestoneOpen, setMilestoneOpen] = useState(data.stamps.length === 0 && !!data.milestone);
  const seen = (keys: string[]) => void markAchievementsSeen(keys);

  const closeStamps = () => {
    setStampsOpen(false);
    seen(data.stamps.map((s) => `${s.kind}:${s.key}`));
    if (data.milestone) setMilestoneOpen(true);
  };
  const closeMilestone = () => {
    setMilestoneOpen(false);
    if (data.milestone) seen([`streak:${data.milestone.weeks}`]);
  };

  return (
    <>
      <Sheet
        open={stampsOpen}
        onClose={closeStamps}
        title={data.stamps.length === 1 ? t.passport.newStamp(data.stamps[0]!.label) : t.passport.newStamps}
      >
        <ul className="flex flex-wrap justify-center gap-3" data-testid="new-stamps">
          {data.stamps.map((s) => (
            <li key={`${s.kind}:${s.key}`}>
              <Stamp
                kind={s.kind}
                state="earned"
                label={s.label}
                code={s.key.toUpperCase()}
                ariaLabel={t.passport.seasonEarnedLabel(s.label)}
                disabled
              />
            </li>
          ))}
        </ul>
        <Button type="button" onClick={closeStamps}>
          {t.close}
        </Button>
      </Sheet>
      {data.milestone && (
        <Sheet
          open={milestoneOpen}
          onClose={closeMilestone}
          title={t.streak.milestoneTitle(data.milestone.weeks)}
        >
          <div className="flex flex-col items-center gap-3 text-center" data-testid="milestone-sheet">
            <span className="grid size-20 place-items-center rounded-full bg-violet-soft text-violet-strong">
              <Icon name="streak" className="size-10" />
            </span>
            <p className="text-lg">{t.streak.milestoneBody(data.milestone.meals)}</p>
            <ShareButton milestone={data.milestone.weeks} />
          </div>
        </Sheet>
      )}
    </>
  );
}
