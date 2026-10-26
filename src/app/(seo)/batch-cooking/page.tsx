import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Cta } from "@/components/seo/Shell";
import { INDEXABLE_HUBS } from "@/seo/hubs";
import { breadcrumbJsonLd, type Crumb } from "@/seo/jsonld";
import { pageMetadata } from "@/seo/meta";

const DESCRIPTION = "Le batch cooking pour la famille : en 2 heures, pour débutant, sans four. Menus, recettes et conseils.";

export const metadata = pageMetadata({
  title: "Batch cooking : guides, menus et recettes | Fin Prêt",
  description: DESCRIPTION,
  path: "/batch-cooking",
  indexable: true,
  image: "/og/batch-cooking/index",
  imageAlt: "Batch cooking Fin Prêt",
});

export default function BatchCookingIndex() {
  const crumbs: Crumb[] = [
    { name: "Accueil", path: "/" },
    { name: "Batch cooking", path: "/batch-cooking" },
  ];
  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Batch cooking : guides, menus et recettes</h1>
      <p className="mt-3 text-lg text-muted">{DESCRIPTION}</p>
      <ul className="mt-6 flex flex-col">
        {INDEXABLE_HUBS.map((h) => (
          <li key={h.slug}>
            <Link href={`/batch-cooking/${h.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
              {h.h1}
            </Link>
          </li>
        ))}
      </ul>
      <Cta />
    </main>
  );
}
