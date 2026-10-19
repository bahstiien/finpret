"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";

export function SettingsNav({ sections }: { sections: (keyof typeof fr.settings.sections)[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={fr.settings.title} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {sections.map((s) => {
          const href = `/settings/${s}`;
          const active = pathname === href;
          return (
            <li key={s}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold whitespace-nowrap ${
                  active ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-chip"
                }`}
              >
                {fr.settings.sections[s]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
