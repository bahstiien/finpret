import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, LinkCard, PageFrame } from "@/components/seo/Shell";
import { breadcrumbJsonLd, type Crumb } from "@/seo/jsonld";
import { EXAMPLES } from "@/seo/exemples";
import { pageMetadata } from "@/seo/meta";

const DESCRIPTION = "Trois exemples de semaine : avec liste de courses, pour 2 adultes et 2 enfants, végétarien. Plats, portions, quantités et organisation.";

export const metadata = pageMetadata({
  title: "Exemples de menus de la semaine | Fin Prêt",
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
          Exemples de menus de la semaine
        </h1>
        <p className="t-body max-w-[640px] text-[19px]">{DESCRIPTION}</p>
      </header>
      <ul className="grid gap-4 min-[900px]:grid-cols-3">
        {EXAMPLES.map((e) => (
          <li key={e.slug} className="flex">
            <LinkCard href={e.path} kicker="Exemple de semaine" tone="tone-menu" title={e.label}>
              <span className="t-small">{e.teaser}</span>
            </LinkCard>
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
