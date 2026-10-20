"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: keyof typeof fr.nav; icon: IconName }[] = [
  { href: "/app", label: "menu", icon: "menu" },
  { href: "/app/discover", label: "discover", icon: "compass" },
  { href: "/app/shopping", label: "shopping", icon: "basket" },
  { href: "/app/stock", label: "stock", icon: "fridge" },
  { href: "/app/session", label: "session", icon: "timer" },
];

/**
 * Navigation (§10) : barre flottante sombre en bas sur mobile (onglet actif en pilule jaune avec son libellé),
 * pilules en haut à partir de 900 px, avec le nombre d'articles de courses restants.
 */
export function AppNav({ shoppingLeft }: { shoppingLeft: number }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  const accountActive = pathname.startsWith("/settings");
  return (
    <>
      <div className="flex justify-end min-[900px]:hidden">
        <Link
          href="/settings"
          aria-label={fr.nav.account}
          aria-current={accountActive ? "page" : undefined}
          className="grid size-11 place-items-center rounded-full bg-surface text-ink hover:bg-chip"
        >
          <Icon name="user" />
        </Link>
      </div>
      <nav
        aria-label={fr.nav.label}
        className="fixed inset-x-3 bottom-3 z-40 rounded-pill bg-nav p-2 shadow-float min-[900px]:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <ul className="flex items-center justify-between">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href} className="relative">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={active ? undefined : fr.nav[tab.label]}
                  className={`flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-pill px-3 font-bold ${
                    active ? "bg-banana text-[#17151F]" : "text-on-nav"
                  }`}
                >
                  <Icon name={tab.icon} />
                  {active && <span>{fr.nav[tab.label]}</span>}
                </Link>
                {tab.label === "shopping" && shoppingLeft > 0 && !active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-2 size-2.5 rounded-full bg-[#FF6B8B]"
                  />
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label={fr.nav.label} className="hidden min-[900px]:block">
        <ul className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href="/app"
              aria-label={fr.app.name}
              className="mr-2 grid size-12 place-items-center rounded-2xl bg-violet font-display text-2xl font-black text-white"
            >
              M
            </Link>
          </li>
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 rounded-pill px-5 font-bold ${
                    active ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-chip"
                  }`}
                >
                  <Icon name={tab.icon} className="size-5" />
                  {fr.nav[tab.label]}
                  {tab.label === "shopping" && shoppingLeft > 0 && (
                    <span className="rounded-pill bg-pink-soft px-2 text-sm text-pink-ink">
                      {shoppingLeft}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          <li className="ml-auto">
            <Link
              href="/settings"
              aria-current={accountActive ? "page" : undefined}
              className="flex min-h-12 items-center gap-2 rounded-pill bg-surface px-5 font-bold text-ink hover:bg-chip"
            >
              <Icon name="user" className="size-5" />
              {fr.nav.account}
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
