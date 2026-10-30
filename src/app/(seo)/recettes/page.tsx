import Link from "next/link";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Cta } from "@/components/seo/Shell";
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
    <main className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Recettes de batch cooking et dîners de la semaine</h1>
      <p className="mt-3 text-lg text-muted">
        {DESCRIPTION} Chaque recette indique ses quantités pour 4 personnes, sa conservation et ce qui se congèle.
      </p>
      {KINDS.map((k) => {
        const list = RECIPES.filter((r) => r.kind === k);
        return (
          <section key={k} aria-labelledby={`k-${k}`} className="mt-8">
            <h2 id={`k-${k}`} className="text-2xl font-extrabold">
              {PLURAL[k]} <span className="text-base font-normal text-muted">({list.length})</span>
            </h2>
            <ul className="mt-2 grid gap-x-8 sm:grid-cols-2">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/recettes/${r.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                    {displayName(r)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Cta />
    </main>
  );
}
