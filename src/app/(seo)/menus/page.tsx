import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, LinkCard, PageFrame } from "@/components/seo/Shell";
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
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="flex flex-col gap-4">
        <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
          Menus de la semaine pour toute la famille
        </h1>
        <p className="t-body max-w-[640px] text-[19px]">{DESCRIPTION}</p>
      </header>
      <ul className="grid gap-4 min-[900px]:grid-cols-3">
        {INDEXABLE_MENUS.map((m) => (
          <li key={m.slug} className="flex">
            <LinkCard href={`/menus/${m.slug}`} kicker="Menu de la semaine" tone="tone-menu" title={m.h1} />
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
