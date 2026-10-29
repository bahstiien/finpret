import Link from "next/link";
import { Flag } from "@/components/menu/Flag";
import { fr } from "@/i18n/fr";
import type { Flag as FlagData } from "@/server/menu-view";

const t = fr.progress.passport;

export type OriginItem = { code: string; label: string; flag: FlagData; isNew: boolean };

/** Origines déjà cuisinées, avec leur drapeau (maquette Progrès). Les plus récentes sont sur aplat banane. */
export function OriginsList({ origins }: { origins: OriginItem[] }) {
  if (origins.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="origins-title" data-testid="origins-list">
      <div className="sh">
        <h2 id="origins-title" className="t-2">
          {t.originsTitle(origins.length)}
        </h2>
        <span className="rule" />
      </div>
      <ul className="flex flex-wrap gap-2.5" aria-label={t.originsCooked}>
        {origins.map((o) => (
          <li
            key={o.code}
            className={`nb-flat flex min-h-11 items-center gap-2 px-2.5 py-1.5 ${o.isNew ? "tone-banane" : "tone-surface"}`}
          >
            <Flag flag={o.flag} />
            <span className="t-small font-bold">{o.label}</span>
          </li>
        ))}
      </ul>
      <Link href="/app/discover" className="btn btn--outline self-start">
        <span aria-hidden="true">+</span>
        {t.discoverOrigin}
      </Link>
    </section>
  );
}
