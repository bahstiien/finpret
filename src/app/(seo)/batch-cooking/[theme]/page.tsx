import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Faq, LinkCard, PageFrame, RecipeTile, SectionHead } from "@/components/seo/Shell";
import { displayName } from "@/seo/catalog";
import { EXAMPLES } from "@/seo/exemples";
import { getHub, HUBS } from "@/seo/hubs";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd, type Crumb } from "@/seo/jsonld";
import { hubDescription, hubTitle, pageMetadata } from "@/seo/meta";

export const dynamicParams = false;

export const generateStaticParams = () => HUBS.map((h) => ({ theme: h.slug }));

export async function generateMetadata({ params }: { params: Promise<{ theme: string }> }): Promise<Metadata> {
  const { theme } = await params;
  const h = getHub(theme);
  if (!h) return {};
  return pageMetadata({
    title: hubTitle(h),
    description: hubDescription(h),
    path: `/batch-cooking/${h.slug}`,
    indexable: h.indexable,
    image: `/og/batch-cooking/${h.slug}`,
    imageAlt: h.h1,
  });
}

export default async function HubPage({ params }: { params: Promise<{ theme: string }> }) {
  const { theme } = await params;
  const h = getHub(theme);
  if (!h) notFound();

  const crumbs: Crumb[] = [
    { name: "Accueil", path: "/" },
    { name: "Batch cooking", path: "/batch-cooking" },
    { name: h.label, path: `/batch-cooking/${h.slug}` },
  ];
  const menus = h.menus.slice(0, 12);

  return (
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(h.h1, [
          ...menus.map((m) => ({ name: m.h1, path: `/menus/${m.slug}` })),
          ...h.recipes.map((r) => ({ name: r.name, path: `/recettes/${r.slug}` })),
        ])}
      />
      <JsonLd data={faqJsonLd(h.faq)} />
      <Breadcrumbs crumbs={crumbs} />
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
            {h.h1}
          </h1>
          <div className="t-body flex max-w-[640px] flex-col gap-3 text-[19px]">
            {h.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </header>

        <section aria-labelledby="menus" className="flex flex-col gap-3.5">
          <SectionHead id="menus" title={menus.length ? "Menus de la semaine" : "Exemples de semaine"} />
          <ul className="grid gap-4 min-[900px]:grid-cols-3">
            {menus.length
              ? menus.map((m) => (
                  <li key={m.slug} className="flex">
                    <LinkCard href={`/menus/${m.slug}`} kicker="Menu de la semaine" tone="tone-menu" title={m.h1} />
                  </li>
                ))
              : EXAMPLES.map((e) => (
                  // Les menus générés sont en noindex : la page renvoie alors vers les exemples de semaine indexables.
                  <li key={e.slug} className="flex">
                    <LinkCard href={e.path} kicker="Exemple de semaine" tone="tone-menu" title={e.label}>
                      <span className="t-small">{e.teaser}</span>
                    </LinkCard>
                  </li>
                ))}
          </ul>
        </section>

        <section aria-labelledby="recettes" className="flex flex-col gap-3.5">
          <SectionHead id="recettes" title="Recettes pour commencer" />
          <p>
            <span className="mono font-bold">{h.recipeCount}</span> recettes correspondent à ce thème ; en voici une sélection.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 min-[900px]:grid-cols-3 min-[1100px]:grid-cols-4">
            {h.recipes.map((r) => (
              <li key={r.id} className="flex">
                <RecipeTile href={`/recettes/${r.slug}`} name={displayName(r)} photo={r.photo} />
              </li>
            ))}
          </ul>
        </section>
      </article>

      <Faq items={h.faq} />
    </PageFrame>
  );
}
