"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";
import { signOut } from "@/server/actions/auth";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: keyof typeof fr.nav; icon: IconName }[] = [
  { href: "/app", label: "menu", icon: "menu" },
  { href: "/app/discover", label: "discover", icon: "compass" },
  { href: "/app/shopping", label: "shopping", icon: "basket" },
  { href: "/app/stock", label: "stock", icon: "fridge" },
  { href: "/app/session", label: "session", icon: "timer" },
];

/** Entrées de la barre latérale seulement : la barre du bas mobile garde ses cinq onglets. */
const SIDE_ONLY: { href: string; label: string; icon: IconName }[] = [
  { href: "/app/progress", label: fr.progress.nav, icon: "passport" },
];

/**
 * Navigation (maquette) : barre d'onglets bordée en bas sur mobile (onglet actif violet, décalé),
 * barre latérale blanche à partir de 900 px, avec le nombre d'articles de courses restants
 * et l'accès à « Progrès » (sur mobile, il passe par Mon compte et le bandeau de série).
 */
export function AppNav({ shoppingLeft, userName }: { shoppingLeft: number; userName: string }) {
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
          className="iconbtn"
        >
          <Icon name="user" />
        </Link>
      </div>
      <nav
        aria-label={fr.nav.label}
        className="tabbar !fixed inset-x-0 bottom-3 z-40 !m-0 mx-3 min-[900px]:hidden"
        style={{ left: 12, right: 12, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="tab"
            >
              <Icon name={tab.icon} className="ic" />
              <span>{fr.nav[tab.label]}</span>
              {tab.label === "shopping" && shoppingLeft > 0 && !active && (
                <span aria-hidden="true" className="dot" />
              )}
            </Link>
          );
        })}
      </nav>
      <nav
        aria-label={fr.nav.label}
        className="side hidden min-[900px]:sticky min-[900px]:top-4 min-[900px]:flex min-[900px]:h-[calc(100dvh-2rem)] min-[900px]:self-start min-[900px]:overflow-y-auto min-[900px]:!border-[length:var(--bw)] min-[900px]:border-line min-[900px]:shadow-[var(--sh)]"
      >
        <Link href="/app" className="logo px-1 pb-4" aria-label={fr.app.name}>
          <span aria-hidden="true" className="logo-mark">
            <Icon name="pot" className="ic" />
          </span>
          {fr.app.name}
        </Link>
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="side-link"
            >
              <Icon name={tab.icon} className="ic" />
              <span className="flex-1">{fr.nav[tab.label]}</span>
              {tab.label === "shopping" && shoppingLeft > 0 && (
                <span className="pill tone-pink mono">{shoppingLeft}</span>
              )}
            </Link>
          );
        })}
        {SIDE_ONLY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className="side-link"
          >
            <Icon name={item.icon} className="ic" />
            <span className="flex-1">{item.label}</span>
          </Link>
        ))}
        <div className="mt-auto flex flex-col gap-3">
          <div className="card tone-banane [@media(max-height:820px)]:hidden">
            <p className="t-3">{fr.nav.sessionPromo}</p>
            <Link href="/app/session" className="btn btn--dark btn--sm mt-3">
              <Icon name="timer" className="ic" />
              {fr.nav.session}
            </Link>
          </div>
          <div className="flex flex-col">
            <Link
              href="/settings"
              aria-label={`${fr.nav.account} (${userName})`}
              aria-current={accountActive ? "page" : undefined}
              className="side-link"
            >
              <Icon name="user" className="ic" />
              <span className="min-w-0 flex-1 truncate">{userName}</span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="lnk min-h-11 pl-[2.75rem] text-sm">
                {fr.appShell.signOut}
              </button>
            </form>
          </div>
        </div>
      </nav>
    </>
  );
}
