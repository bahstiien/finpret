import Link from "next/link";
import { Icon } from "./Icon";

/**
 * Pagination commune du site : « Page N » sans total, bouton précédent absent en page 1, bouton suivant absent en
 * dernière page, rien du tout s'il n'y a qu'une page. Des liens (`href`, pages serveur) ou des boutons (`onPage`,
 * listes filtrées dans le navigateur).
 */
export function Pagination({
  page,
  hasNext,
  href,
  onPage,
  prevLabel = "Précédentes",
  nextLabel = "Suivantes",
  label = "Pagination",
}: {
  page: number;
  hasNext: boolean;
  href?: (page: number) => string;
  onPage?: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
  label?: string;
}) {
  if (page <= 1 && !hasNext) return null;

  const step = (to: number, text: string, icon: "arrowBack" | "arrowRight") => {
    const content =
      icon === "arrowBack" ? (
        <>
          <Icon name={icon} className="ic" />
          {text}
        </>
      ) : (
        <>
          {text}
          <Icon name={icon} className="ic" />
        </>
      );
    return href ? (
      <Link href={href(to)} className="btn btn--outline btn--sm">
        {content}
      </Link>
    ) : (
      <button type="button" className="btn btn--outline btn--sm" onClick={() => onPage?.(to)}>
        {content}
      </button>
    );
  };

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      {page > 1 && step(page - 1, prevLabel, "arrowBack")}
      <span className="mono t-small font-bold" aria-current="page">
        Page {page}
      </span>
      {hasNext && step(page + 1, nextLabel, "arrowRight")}
    </nav>
  );
}
