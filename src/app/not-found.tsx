import type { Metadata } from "next";
import Link from "next/link";
import { SeoFooter, SeoHeader } from "@/components/seo/Shell";
import { INDEXABLE_HUBS } from "@/seo/hubs";

export const metadata: Metadata = {
  title: { absolute: "Page introuvable | Fin Prêt" },
  robots: { index: false, follow: true },
};

/** Vraie 404 (code HTTP 404) avec des liens vers les hubs, pour ne laisser ni le visiteur ni les robots dans une impasse. */
export default function NotFound() {
  const link = "inline-flex min-h-11 items-center underline underline-offset-4";
  return (
    <>
      <SeoHeader />
      <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-8">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Cette page n’existe pas</h1>
        <p className="mt-3 text-lg text-muted">Elle a peut-être été déplacée. Voici où poursuivre :</p>
        <ul className="mt-5 flex flex-col">
          {INDEXABLE_HUBS.map((h) => (
            <li key={h.slug}>
              <Link href={`/batch-cooking/${h.slug}`} className={link}>
                {h.h1}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/menus" className={link}>
              Tous les menus de la semaine
            </Link>
          </li>
          <li>
            <Link href="/recettes" className={link}>
              Toutes les recettes
            </Link>
          </li>
        </ul>
      </main>
      <SeoFooter />
    </>
  );
}
