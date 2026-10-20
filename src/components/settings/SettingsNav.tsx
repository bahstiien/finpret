"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
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
        <li>
          <Link
            href="/app/progress?from=profile"
            className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-violet-soft px-4 text-sm font-bold whitespace-nowrap text-violet-strong"
          >
            <Icon name="passport" className="size-4" />
            {fr.progress.nav}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
