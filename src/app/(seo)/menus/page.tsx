import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Cta } from "@/components/seo/Shell";
import { breadcrumbJsonLd, type Crumb } from "@/seo/jsonld";
import { INDEXABLE_MENUS } from "@/seo/menus";
import { pageMetadata } from "@/seo/meta";

const DESCRIPTION = `${INDEXABLE_MENUS.length} menus de la semaine : 2, 4 ou 6 personnes, pas cher, végétarien, enfants, rapide, avec liste de courses.`;

export const metadata = pageMetadata({
  title: "Menus de la semaine pour toute la famille | Fin Prêt",
  description: DESCRIPTION,
  path: "/menus",
  indexable: true,
  image: "/og/menus/index",
  imageAlt: "Menus de la semaine Fin Prêt",
});

export default function MenusIndex() {
  const crumbs: Crumb[] = [
    { name: "Accueil", path: "/" },
    { name: "Menus de la semaine", path: "/menus" },
  ];
  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Menus de la semaine pour toute la famille</h1>
      <p className="mt-3 text-lg text-muted">{DESCRIPTION}</p>
      <ul className="mt-6 flex flex-col">
        {INDEXABLE_MENUS.map((m) => (
          <li key={m.slug}>
            <Link href={`/menus/${m.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
              {m.h1}
            </Link>
          </li>
        ))}
      </ul>
      <Cta />
    </main>
  );
}
