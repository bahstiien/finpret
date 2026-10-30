import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, PageFrame, SectionHead } from "@/components/seo/Shell";
import { displayName, RECIPES, type RecipeKind } from "@/seo/catalog";
import { breadcrumbJsonLd, type Crumb } from "@/seo/jsonld";
import { pageMetadata } from "@/seo/meta";

const DESCRIPTION = `${RECIPES.length} recettes familiales : batch cooking, soupes, dîners express et goûters, avec conservation et congélation.`;

export const metadata = pageMetadata({
  title: "Recettes de batch cooking et dîners | Fin Prêt",
  description: DESCRIPTION,
  path: "/recettes",
  indexable: true,
  image: "/og/recettes/index",
  imageAlt: "Recettes Fin Prêt",
});

const KINDS: RecipeKind[] = ["plat", "soupe", "simple", "gouter"];
const PLURAL: Record<RecipeKind, string> = {
  plat: "Plats de batch cooking",
  soupe: "Soupes",
  simple: "Dîners express",
  gouter: "Goûters",
};

export default function RecipesIndex() {
  const crumbs: Crumb[] = [
    { name: "Accueil", path: "/" },
    { name: "Recettes", path: "/recettes" },
  ];
  return (
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="flex flex-col gap-4">
        <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
          Recettes de batch cooking et dîners de la semaine
        </h1>
        <p className="t-body max-w-[640px] text-[19px]">
          {DESCRIPTION} Chaque recette indique ses quantités pour 4 personnes, sa conservation et ce qui se congèle.
        </p>
      </header>
      {KINDS.map((k) => {
        const list = RECIPES.filter((r) => r.kind === k);
        return (
          <section key={k} aria-labelledby={`k-${k}`} className="flex flex-col gap-3.5">
            <SectionHead id={`k-${k}`} title={PLURAL[k]} tag={`(${list.length})`} />
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/recettes/${r.slug}`} className="lnk inline-flex min-h-11 items-center">
                    {displayName(r)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </PageFrame>
  );
}
