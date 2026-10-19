import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Cadre de téléphone qui présente une maquette d'écran. Décoratif : le contenu est masqué
 * aux lecteurs d'écran et remplacé par `label`. Reste en mode clair quel que soit le thème.
 */
export function Phone({
  label,
  children,
  className = "",
  height = "h-[560px]",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`theme-light relative w-[300px] shrink-0 rounded-[44px] bg-ink p-2 shadow-float ${className}`}
    >
      <div aria-hidden="true" className={`relative overflow-hidden rounded-[36px] bg-bg text-ink ${height}`}>
        <div className="flex items-center justify-between px-6 pt-3 pb-2 text-[12px] font-bold">
          <span>9:41</span>
          <span className="h-3 w-5 rounded-[4px] border-[1.5px] border-ink" />
        </div>
        {children}
      </div>
    </div>
  );
}

const tabs: { icon: IconName; label: string }[] = [
  { icon: "utensils", label: "Menu" },
  { icon: "compass", label: "Découvrir" },
  { icon: "basket", label: "Courses" },
  { icon: "fridge", label: "Stock" },
  { icon: "timer", label: "Session" },
];

/** Barre d'onglets flottante : l'onglet actif est une pilule jaune avec son libellé. */
export function PhoneTabs({ active }: { active: string }) {
  return (
    <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-pill bg-nav p-1.5 text-on-nav shadow-float">
      {tabs.map((tab) =>
        tab.label === active ? (
          <span
            key={tab.label}
            className="flex h-10 items-center gap-1.5 rounded-pill bg-banana px-3 text-[12px] font-bold text-[#17151f]"
          >
            <Icon name={tab.icon} className="size-[18px]" />
            {tab.label}
          </span>
        ) : (
          <span key={tab.label} className="grid size-10 place-items-center">
            <Icon name={tab.icon} className="size-[18px]" />
          </span>
        ),
      )}
    </div>
  );
}
