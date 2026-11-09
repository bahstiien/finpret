"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type Item = { href: string; label: string; icon: IconName; badge?: "inbox" | "tasks" | "recipes" };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Pilotage",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: "dashboard" },
      { href: "/admin/usage", label: "Usage et communauté", icon: "pot" },
      { href: "/admin/actions", label: "Actions à mener", icon: "todo", badge: "tasks" },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/admin/demandes", label: "Demandes de contact", icon: "inbox", badge: "inbox" },
      { href: "/admin/fiche", label: "Fiche contact", icon: "clipboard" },
      { href: "/admin/comptes", label: "Comptes", icon: "users" },
      { href: "/admin/segments", label: "Segments", icon: "chart" },
      { href: "/admin/prospects", label: "Pipeline associations", icon: "handshake" },
      { href: "/admin/support", label: "Support", icon: "lifebuoy" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/recettes", label: "Suggestions de recettes", icon: "chefHat", badge: "recipes" },
      { href: "/admin/bibliotheque", label: "Bibliothèque", icon: "pot" },
    ],
  },
  {
    title: "Revenus",
    items: [
      { href: "/admin/abonnements", label: "Abonnements", icon: "card" },
      { href: "/admin/codes-promo", label: "Codes promo", icon: "tag" },
      { href: "/admin/reversements", label: "Reversements", icon: "bank" },
    ],
  },
  {
    title: "Réseau",
    items: [
      { href: "/admin/associations", label: "Associations", icon: "users" },
      { href: "/admin/ecoles", label: "Écoles", icon: "school" },
      { href: "/admin/menus", label: "Menus", icon: "menu" },
    ],
  },
  {
    title: "Système",
    items: [
      { href: "/admin/journal", label: "Journal", icon: "journal" },
      { href: "/admin/admins", label: "Admins", icon: "shield" },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

/** Menu latéral du back-office : fixe à gauche sur grand écran, tiroir sous la barre du haut sur mobile. */
export function AdminNav({ badges }: { badges: { inbox: number; tasks: number; recipes: number } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Le tiroir mobile se referme à chaque changement de page.
  useEffect(() => setOpen(false), [pathname]);

  const links = (
    <nav aria-label="Back-office" className="flex flex-col gap-5 p-3">
      {GROUPS.map((g) => (
        <div key={g.title} className="flex flex-col gap-1">
          <p className="t-label px-3 text-[11px] opacity-70">{g.title}</p>
          <ul className="flex flex-col gap-1">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-[var(--r1)] border-[length:var(--bw)] px-3 text-[15px] font-bold ${
                      active
                        ? "border-[var(--on-nav)] bg-[var(--banane)] text-[var(--on-banane)] shadow-[var(--sh-sm)]"
                        : "border-transparent hover:border-[var(--on-nav)]"
                    }`}
                  >
                    <Icon name={item.icon} className="size-5" />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={`mono min-w-6 rounded-full border-[length:var(--bw)] px-1.5 text-center text-xs ${
                          item.badge === "inbox" || item.badge === "recipes"
                            ? "border-[var(--ink-fixed)] bg-[var(--pink)] text-[var(--on-fill)]"
                            : "border-current"
                        }`}
                        aria-label={`${count} en attente`}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r-[length:var(--bw)] border-line bg-nav text-on-nav min-[1000px]:flex">
        <Link
          href="/admin"
          className="flex items-center gap-3 border-b-[length:var(--bw)] border-[var(--muted)] px-5 py-4"
        >
          <span className="logo-mark" aria-hidden="true">
            M
          </span>
          <span className="t-kicker">Back-office</span>
        </Link>
        {links}
      </aside>
      <div className="sticky top-0 z-20 min-[1000px]:hidden">
        <header className="topbar">
          <Link href="/admin" className="inline-flex items-center gap-3">
            <span className="logo-mark" aria-hidden="true">
              M
            </span>
            <span className="t-kicker">Back-office</span>
          </Link>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            aria-expanded={open}
            aria-controls="admin-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "close" : "hamburger"} className="size-5" />
            Menu
            {badges.inbox > 0 && <span className="pill tone-pink">{badges.inbox}</span>}
          </button>
        </header>
        {open && (
          <div
            id="admin-drawer"
            className="max-h-[80dvh] overflow-y-auto border-b-[length:var(--bw)] border-line bg-nav text-on-nav"
          >
            {links}
          </div>
        )}
      </div>
    </>
  );
}
