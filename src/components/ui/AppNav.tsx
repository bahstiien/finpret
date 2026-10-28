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
      <nav
        aria-label={fr.nav.label}
        className="hidden min-[900px]:sticky min-[900px]:top-4 min-[900px]:flex min-[900px]:h-[calc(100dvh-2rem)] min-[900px]:flex-col min-[900px]:self-start min-[900px]:gap-6 min-[900px]:overflow-y-auto min-[900px]:[scrollbar-width:none] min-[900px]:[&::-webkit-scrollbar]:hidden min-[900px]:rounded-3xl min-[900px]:bg-nav min-[900px]:p-4 min-[900px]:text-on-nav"
      >
        <Link href="/app" className="flex items-center gap-3 px-1 pt-1" aria-label={fr.app.name}>
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-2xl bg-violet font-display text-2xl font-bold text-white"
          >
            M
          </span>
          <span className="font-display text-2xl font-bold">{fr.app.name}</span>
        </Link>
        <ul className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-pill px-4 font-bold transition-colors duration-300 ease-base ${
                    active ? "bg-banana text-[#17151F]" : "text-on-nav/80 hover:bg-white/10 hover:text-on-nav"
                  }`}
                >
                  <Icon name={tab.icon} className="size-5" />
                  <span className="flex-1">{fr.nav[tab.label]}</span>
                  {tab.label === "shopping" && shoppingLeft > 0 && (
                    <span className="grid min-w-6 place-items-center rounded-full bg-peach px-1 text-sm font-bold text-peach-ink">
                      {shoppingLeft}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex flex-col gap-4">
          <div className="rounded-3xl bg-banana p-4 text-[#17151F] [@media(max-height:820px)]:hidden">
            <p className="font-display text-lg leading-tight font-bold">{fr.nav.sessionPromo}</p>
            <Link
              href="/app/session"
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill bg-[#17151F] px-4 text-sm font-bold text-white"
            >
              <Icon name="timer" className="size-4" />
              {fr.nav.session}
            </Link>
          </div>
          <Link
            href="/settings"
            aria-current={accountActive ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-pill px-4 font-bold transition-colors duration-300 ease-base ${
              accountActive
                ? "bg-banana text-[#17151F]"
                : "text-on-nav/80 hover:bg-white/10 hover:text-on-nav"
            }`}
          >
            <Icon name="user" className="size-5" />
            {fr.nav.account}
          </Link>
        </div>
      </nav>
    </>
  );
}
