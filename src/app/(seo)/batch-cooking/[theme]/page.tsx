import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Cta, Faq, PageFrame } from "@/components/seo/Shell";
import { displayName } from "@/seo/catalog";
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
      <article className="mt-4">
        <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">{h.h1}</h1>
        <div className="mt-3 flex flex-col gap-3 text-lg text-muted">
          {h.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <section aria-labelledby="menus" className="mt-8">
          <h2 id="menus" className="text-2xl font-extrabold">
            Menus de la semaine
          </h2>
          <ul className="mt-3 flex flex-col">
            {menus.map((m) => (
              <li key={m.slug}>
                <Link href={`/menus/${m.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {m.h1}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="recettes" className="mt-8">
          <h2 id="recettes" className="text-2xl font-extrabold">
            Recettes pour commencer
          </h2>
          <p className="mt-1 text-muted">{h.recipeCount} recettes correspondent à ce thème ; en voici une sélection.</p>
          <ul className="mt-3 flex flex-col">
            {h.recipes.map((r) => (
              <li key={r.id}>
                <Link href={`/recettes/${r.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {displayName(r)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>

      <Faq items={h.faq} />
      <Cta />
    </PageFrame>
  );
}
