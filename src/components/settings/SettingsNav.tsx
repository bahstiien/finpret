"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";

const SECTIONS = ["profile", "household"] as const;

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label={fr.settingsAccount.nav}>
      <ul className="flex gap-2">
        {SECTIONS.map((s) => {
          const href = `/settings/${s}`;
          const active = pathname === href;
          return (
            <li key={s}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-pill px-5 font-bold ${
                  active ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-chip"
                }`}
              >
                {fr.settingsAccount.sections[s]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
