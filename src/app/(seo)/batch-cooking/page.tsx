import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, LinkCard, PageFrame } from "@/components/seo/Shell";
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
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="flex flex-col gap-4">
        <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
          Batch cooking : guides, menus et recettes
        </h1>
        <p className="t-body max-w-[640px] text-[19px]">{DESCRIPTION}</p>
      </header>
      <ul className="grid gap-4 min-[900px]:grid-cols-3">
        {INDEXABLE_HUBS.map((h) => (
          <li key={h.slug} className="flex">
            <LinkCard href={`/batch-cooking/${h.slug}`} kicker="Batch cooking" tone="tone-session" title={h.h1} />
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
