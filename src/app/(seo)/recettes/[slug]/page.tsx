import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Cta, PageFrame } from "@/components/seo/Shell";
import { displayName, getRecipe, KIND_LABEL, RECIPES } from "@/seo/catalog";
import { CONTENT_LASTMOD } from "@/seo/config";
import { hubFor } from "@/seo/hubs";
import { abs, breadcrumbJsonLd, recipeJsonLd, type Crumb } from "@/seo/jsonld";
import { menusContaining } from "@/seo/menus";
import { pageMetadata, recipeDescription, recipeTitle } from "@/seo/meta";

export const dynamicParams = false;

export const generateStaticParams = () => RECIPES.map((r) => ({ slug: r.slug }));

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const monthRange = (m: number[]) => m.map((x) => MONTHS[x - 1]).join(", ");
const minutes = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")}` : `${n} min`);
const DIFFICULTY = ["", "très facile", "facile", "intermédiaire", "technique"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = getRecipe(slug);
  if (!r) return {};
  return pageMetadata({
    title: recipeTitle(r),
    description: recipeDescription(r),
    path: `/recettes/${r.slug}`,
    indexable: true,
    image: r.photo?.src ?? `/og/recettes/${r.slug}`,
    imageAlt: r.photo?.alt ?? `${r.short} : recette Fin Prêt`,
    type: "article",
  });
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = getRecipe(slug);
  if (!r) notFound();

  const hub = hubFor(r);
  const menus = menusContaining(r.id);
  const crumbs: Crumb[] = [
    { name: "Accueil", path: "/" },
    { name: "Recettes", path: "/recettes" },
    { name: displayName(r), path: `/recettes/${r.slug}` },
  ];
  const image = abs(r.photo?.src ?? `/og/recettes/${r.slug}`);
  const facts: [string, string][] = [];
  if (r.prepMin !== null) facts.push(["Préparation", minutes(r.prepMin)]);
  if (r.cookMin) facts.push(["Cuisson", minutes(r.cookMin)]);
  if (r.totalMin) facts.push(["Total", minutes(r.totalMin)]);
  facts.push(["Portions", r.yieldText], ["Difficulté", DIFFICULTY[r.difficulty] ?? ""]);

  return (
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={recipeJsonLd(r, image, recipeDescription(r), CONTENT_LASTMOD)} />
      <Breadcrumbs crumbs={crumbs} />
      <article className="mt-4">
        <p className="text-sm font-bold text-violet-strong">{KIND_LABEL[r.kind]}</p>
        <h1 className="mt-1 text-3xl leading-tight font-extrabold sm:text-4xl">{r.name}</h1>
        {r.description && <p className="mt-3 text-lg text-muted">{r.description}</p>}

        {r.photo && (
          <Image
            src={r.photo.src}
            alt={r.photo.alt}
            width={r.photo.width}
            height={r.photo.height}
            priority
            className="mt-5 h-auto w-full rounded-card"
          />
        )}

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-card bg-surface p-4">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="ingredients" className="mt-8">
          <h2 id="ingredients" className="text-2xl font-extrabold">
            Ingrédients pour 4 personnes
          </h2>
          <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {r.ingredients.map((i) => (
              <li key={i.key} className="border-b border-line py-2">
                <span className="font-bold">{i.qty}</span> {i.label.toLowerCase()}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="etapes" className="mt-8">
          <h2 id="etapes" className="text-2xl font-extrabold">
            Préparation
          </h2>
          <ol className="mt-3 flex list-decimal flex-col gap-3 pl-6">
            {r.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>

        {r.variants.length > 0 && (
          <section aria-labelledby="saison" className="mt-8">
            <h2 id="saison" className="text-2xl font-extrabold">
              Variantes de saison
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {r.variants.map((v) => (
                <li key={v.label}>
                  <span className="font-bold">{v.label}</span> ({monthRange(v.months)}) :{" "}
                  {v.ingredients.map((i) => `${i.qty} ${i.label.toLowerCase()}`).join(", ")}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(r.fridgeDays !== null || r.freezable || r.storage) && (
          <section aria-labelledby="conservation" className="mt-8">
            <h2 id="conservation" className="text-2xl font-extrabold">
              Conservation et congélation
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-6">
              {r.fridgeDays !== null && <li>Se conserve {r.fridgeDays} jours au frigo après la session de batch cooking.</li>}
              <li>{r.freezable ? "Se congèle : décongèle-le la veille au frigo." : "Ne se congèle pas : prévois-le dans les premiers jours."}</li>
              {r.storage && <li>Conditionnement : {r.storage}.</li>}
              {r.reheat && <li>Le jour du repas : {r.reheat}</li>}
            </ul>
          </section>
        )}

        {r.kidTip && (
          <section aria-labelledby="enfants" className="mt-8 rounded-card bg-surface p-5">
            <h2 id="enfants" className="text-xl font-extrabold">
              Astuce pour les enfants
            </h2>
            <p className="mt-1">{r.kidTip}</p>
          </section>
        )}

        {r.nutrition && (
          <section aria-labelledby="nutrition" className="mt-8">
            <h2 id="nutrition" className="text-2xl font-extrabold">
              Valeurs nutritionnelles
            </h2>
            <p className="mt-2 text-muted">
              Estimation par portion adulte : {r.nutrition.kcal} kcal, {r.nutrition.protein} g de protéines,{" "}
              {r.nutrition.carbs} g de glucides, {r.nutrition.fat} g de lipides.
            </p>
          </section>
        )}
      </article>

      {(menus.length > 0 || hub) && (
        <aside aria-labelledby="liens" className="mt-10">
          <h2 id="liens" className="text-2xl font-extrabold">
            À découvrir aussi
          </h2>
          <ul className="mt-3 flex flex-col">
            {menus.slice(0, 4).map((m) => (
              <li key={m.slug}>
                <Link href={`/menus/${m.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {m.h1}
                </Link>
              </li>
            ))}
            {hub && (
              <li>
                <Link href={`/batch-cooking/${hub.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {hub.label}
                </Link>
              </li>
            )}
          </ul>
        </aside>
      )}

      <Cta />
    </PageFrame>
  );
}
