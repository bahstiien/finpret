import { JsonLd } from "@/components/associations/JsonLd";
import { RecipeBrowser } from "@/components/seo/RecipeBrowser";
import { Breadcrumbs, PageFrame } from "@/components/seo/Shell";
import { displayName, RECIPES } from "@/seo/catalog";
import { breadcrumbJsonLd, type Crumb } from "@/seo/jsonld";
import { pageMetadata } from "@/seo/meta";
import { toCard } from "@/seo/recipe-filter";

const DESCRIPTION = `${RECIPES.length} recettes familiales : batch cooking, soupes, dîners express et goûters, avec conservation et congélation.`;

export const metadata = pageMetadata({
  title: "Recettes de batch cooking et dîners | Fin Prêt",
  description: DESCRIPTION,
  path: "/recettes",
  indexable: true,
  image: "/og/recettes/index",
  imageAlt: "Recettes Fin Prêt",
});

const CARDS = RECIPES.map((r) => toCard(r, displayName(r)));

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
      <RecipeBrowser recipes={CARDS} />
    </PageFrame>
  );
}
