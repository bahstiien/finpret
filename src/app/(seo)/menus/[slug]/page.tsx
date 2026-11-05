import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Faq, LinkCard, PageFrame, SectionHead } from "@/components/seo/Shell";
import { RecipeImage } from "@/components/ui/RecipeImage";
import { displayName } from "@/seo/catalog";
import { EXAMPLES_BASE } from "@/seo/exemples";
import { getHub, INDEXABLE_HUBS } from "@/seo/hubs";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd, type Crumb } from "@/seo/jsonld";
import { getMenu, MENUS } from "@/seo/menus";
import { menuDescription, menuTitle, pageMetadata } from "@/seo/meta";

export const dynamicParams = false;

export const generateStaticParams = () => MENUS.map((m) => ({ slug: m.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = getMenu(slug);
  if (!m) return {};
  return pageMetadata({
    title: menuTitle(m),
    description: menuDescription(m),
    path: `/menus/${m.slug}`,
    indexable: m.indexable,
    image: `/og/menus/${m.slug}`,
    imageAlt: m.h1,
  });
}

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = getMenu(slug);
  if (!m) notFound();

  const hub = INDEXABLE_HUBS.find((h) => h.menu(m)) ?? getHub("pour-debutant");
  const crumbs: Crumb[] = [
    { name: "Accueil", path: "/" },
    { name: "Menus de la semaine", path: "/menus" },
    { name: m.h1, path: `/menus/${m.slug}` },
  ];

  return (
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          m.h1,
          m.recipes.map((r) => ({ name: r.name, path: `/recettes/${r.slug}` })),
        )}
      />
      <JsonLd data={faqJsonLd(m.faq)} />
      <Breadcrumbs crumbs={crumbs} />
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
            {m.h1}
          </h1>
          <div className="t-body flex max-w-[640px] flex-col gap-3 text-[19px]">
            {m.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </header>

        <section aria-labelledby="repas" className="flex flex-col gap-3.5">
          <SectionHead id="repas" title={`Les ${m.recipes.length} repas de la semaine`} />
          <ol className="grid gap-4 min-[900px]:grid-cols-2">
            {m.recipes.map((r, i) => (
              <li key={r.id} className="card recipe-zoom flex flex-col gap-1.5">
                {r.photo && (
                  <RecipeImage photo={r.photo} sizes="(min-width: 900px) 560px, 100vw" decorative className="card-photo mb-2" />
                )}
                <p className="t-kicker">Repas {i + 1}</p>
                <h3 className="t-3">
                  <Link href={`/recettes/${r.slug}`} className="lnk">
                    {displayName(r)}
                  </Link>
                </h3>
                {r.description && <p className="t-small">{r.description}</p>}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="courses" className="flex flex-col gap-3.5">
          <SectionHead id="courses" title={`Liste de courses pour ${m.combo.persons} personnes`} />
          <div className="grid gap-4 sm:grid-cols-2">
            {m.shopping.map((g) => (
              <section key={g.aisle} className="card tone-courses flex flex-col gap-2">
                <h3 className="t-ui">{g.label}</h3>
                <ul>
                  {g.items.map((it) => (
                    <li key={it.label} className="row !min-h-11">
                      <span className="row-main">{it.label.toLowerCase()}</span>
                      {it.qty && <span className="mono font-bold">{it.qty}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {m.pantry.length > 0 && <p>À vérifier dans ton placard : {m.pantry.join(", ").toLowerCase()}.</p>}
        </section>
      </article>

      <Faq items={m.faq} />

      <section aria-label="Exemple de semaine" className="flex flex-col gap-3.5">
        <p className="t-kicker">Un exemple complet, avec l&apos;organisation de la semaine :</p>
        <LinkCard
          href={`${EXAMPLES_BASE}/${m.combo.constraint === "vegetarien" ? "vegetarien" : "avec-liste-de-courses"}`}
          kicker="Exemple de semaine"
          tone="tone-menu"
          title={m.combo.constraint === "vegetarien" ? "Menu de la semaine végétarien" : "Menu de la semaine avec liste de courses"}
        />
      </section>

      {hub && (
        <section aria-label="Pour aller plus loin" className="flex flex-col gap-3.5">
          <p className="t-kicker">Pour aller plus loin :</p>
          <LinkCard href={`/batch-cooking/${hub.slug}`} kicker="Batch cooking" tone="tone-session" title={hub.label} />
        </section>
      )}
    </PageFrame>
  );
}
