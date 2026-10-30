import { MealFrieze } from "@/components/ui/Card";
import { Bento, Sticker } from "@/components/ui/Extras";
import { Icon, type IconName } from "@/components/ui/Icon";
import { StatTile } from "@/components/ui/Layout";
import { fr } from "@/i18n/fr";

const t = fr.login;

/** Panneau d'accroche à gauche du formulaire : promesse, deux chiffres clés, quatre bénéfices. */
export function LoginHero() {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="max-[999px]:hidden">
            <Sticker tone="banane">
              <Icon name="pot" className="size-4" />
              {t.stickerBatch}
            </Sticker>
          </span>
          <p className="t-kicker">{t.kicker}</p>
        </div>
        <h1 className="t-hero balance !text-[clamp(36px,5.4vw,84px)]">{t.hero}</h1>
        <p className="t-body max-w-[34rem] text-xl max-[999px]:hidden">
          {t.heroLeadBefore}
          <span className="mono">{t.heroLeadMeals}</span>
          {t.heroLeadBetween}
          <span className="mono">{t.heroLeadTime}</span>.
        </p>
      </div>

      <div className="grid max-w-[480px] grid-cols-2 gap-4 max-[999px]:hidden">
        <StatTile tone="yellow" label={t.heroMeals} value="10" />
        <StatTile tone="session" label={t.heroSession} value="2 h 30" />
      </div>

      <Bento columns={2} shadow="md" className="max-[999px]:hidden">
        {t.features.map((f) => (
          <div key={f.title} className="flex items-start gap-3 p-4">
            <span
              className={`tone-${f.tone} nb-sm grid size-11 flex-none place-items-center !shadow-none`}
              aria-hidden="true"
            >
              <Icon name={f.icon as IconName} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="t-ui">{f.title}</p>
              <p className="t-small muted">{f.text}</p>
            </div>
          </div>
        ))}
      </Bento>
    </section>
  );
}

/** Pied des écrans étroits : la frise des dix repas de la session. */
export function MobileFooter() {
  return (
    <div className="flex items-center gap-3 min-[1000px]:hidden">
      <MealFrieze count={10} size={14} />
      <p className="t-kicker">{t.heroFooter}</p>
    </div>
  );
}
