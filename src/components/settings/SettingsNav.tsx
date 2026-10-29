"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { fr } from "@/i18n/fr";

export function SettingsNav({ sections }: { sections: (keyof typeof fr.settings.sections)[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={fr.settings.title} className="-mx-4 overflow-x-auto px-4 pt-1 pb-3">
      <ul className="flex gap-3">
        {sections.map((s) => {
          const href = `/settings/${s}`;
          const active = pathname === href;
          return (
            <li key={s}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`chiptg whitespace-nowrap ${
                  active ? "!bg-violet !text-white !shadow-none translate-x-0.5 translate-y-0.5" : ""
                }`}
              >
                {fr.settings.sections[s]}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/app/progress?from=profile"
            className="chiptg whitespace-nowrap !bg-banana !text-ink"
          >
            <Icon name="passport" className="size-4" />
            {fr.progress.nav}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
