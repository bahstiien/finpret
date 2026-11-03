"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";
import type { SettingsGroup } from "@/lib/settings-sections";

const t = fr.settings;

/**
 * Cadre des réglages. Desktop : colonne de navigation groupée à gauche du contenu.
 * Mobile : retour vers l'accueil des réglages, puis les onglets du groupe courant seulement.
 * L'accueil (/settings) n'affiche pas de navigation : il liste lui-même toutes les sections.
 */
export function SettingsShell({ groups, children }: { groups: SettingsGroup[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const isIndex = pathname === "/settings";
  // Un membre n'a que son Profil : pas d'accueil vers lequel revenir.
  const hasIndex = groups.some((g) => g.key !== "account");
  const current = groups.find((g) => g.sections.some((s) => pathname === `/settings/${s}`));

  if (isIndex) return <div className="flex max-w-3xl flex-col gap-6">{children}</div>;

  return (
    <div className="flex flex-col gap-4 min-[900px]:grid min-[900px]:grid-cols-[13rem_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-8">
      <div className="flex flex-col gap-2 min-[900px]:sticky min-[900px]:top-6">
        <Link
          href={hasIndex ? "/settings" : "/app"}
          className="lnk t-ui inline-flex min-h-11 items-center self-start text-sm min-[900px]:hidden"
        >
          ← {hasIndex ? t.overview : t.back}
        </Link>
        <nav aria-label={t.title} className="-mx-4 overflow-x-auto px-4 pb-1 min-[900px]:mx-0 min-[900px]:overflow-visible min-[900px]:p-0">
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.key} className={g === current ? "" : "max-[899px]:hidden"}>
                <p className="t-kicker muted mb-2 max-[899px]:hidden">{t.groups[g.key]}</p>
                <ul className="flex gap-3 min-[900px]:flex-col min-[900px]:gap-1">
                  {g.sections.map((s) => {
                    const href = `/settings/${s}`;
                    const active = pathname === href;
                    return (
                      <li key={s}>
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className={`chiptg whitespace-nowrap min-[900px]:w-full min-[900px]:justify-start ${
                            active
                              ? "!bg-violet !text-white !shadow-none translate-x-0.5 translate-y-0.5 min-[900px]:translate-0"
                              : // Desktop : liste légère, la bordure n'apparaît qu'au survol.
                                "min-[900px]:!border-transparent min-[900px]:!bg-transparent min-[900px]:!shadow-none min-[900px]:hover:!border-line"
                          }`}
                        >
                          {t.sections[s]}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </div>
      <div className="flex min-w-0 max-w-3xl flex-col gap-4">{children}</div>
    </div>
  );
}
