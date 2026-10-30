import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/associations/JsonLd";
import { Flag } from "@/components/menu/Flag";
import { Breadcrumbs, LinkCard, PageFrame, SectionHead } from "@/components/seo/Shell";
import { Difficulty } from "@/components/ui/Extras";
import { Icon } from "@/components/ui/Icon";
import { ORIGINS } from "@/engine/origins";
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
  facts.push(["Portions", r.yieldText]);
  const level = Math.min(4, Math.max(1, r.difficulty)) as 1 | 2 | 3 | 4;
  const origin = Object.entries(ORIGINS).find(([, o]) => o.name === r.country);
  const flag = origin ? { code: origin[0], emoji: origin[1].flag, name: origin[1].name } : null;

  return (
    <PageFrame>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={recipeJsonLd(r, image, recipeDescription(r), CONTENT_LASTMOD)} />
      <Breadcrumbs crumbs={crumbs} />
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {flag && (
              <span className="inline-flex items-center gap-2">
                <Flag flag={flag} />
                <span className="t-label">{flag.name}</span>
              </span>
            )}
            <span className="pill tone-chip">{KIND_LABEL[r.kind]}</span>
            {r.vegetarian && <span className="pill">Végétarien</span>}
            {r.freezable && (
              <span className="pill tone-stock">
                <Icon name="snow" className="ic" />
                Se congèle
              </span>
            )}
          </div>
          <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
            {r.name}
          </h1>
          {r.description && <p className="t-body max-w-[640px] text-[19px]">{r.description}</p>}

          {r.photo && (
            <Image
              src={r.photo.src}
              alt={r.photo.alt}
              width={r.photo.width}
              height={r.photo.height}
              priority
              className="nb h-auto w-full max-w-[860px]"
            />
          )}

          <dl
            className="bento max-w-[860px] grid-cols-2 min-[700px]:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]"
            style={{ boxShadow: "var(--sh)" }}
          >
            {facts.map(([k, v]) => (
              <div key={k} className="px-3 py-2.5">
                <dt className="t-kicker">{k}</dt>
                <dd className="mono text-[22px] font-bold">{v}</dd>
              </div>
            ))}
            <div className="px-3 py-2.5">
              <dt className="t-kicker">Difficulté</dt>
              <dd className="mt-1 flex items-center gap-2">
                <Difficulty level={level} />
                <span className="mono font-bold">{DIFFICULTY[r.difficulty] ?? ""}</span>
              </dd>
            </div>
          </dl>
        </header>

        <div className="grid items-start gap-8 min-[900px]:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <section aria-labelledby="ingredients" className="card flex flex-col gap-3">
            <h2 id="ingredients" className="t-2">
              Ingrédients pour 4 personnes
            </h2>
            <ul>
              {r.ingredients.map((i) => (
                <li key={i.key} className="row !min-h-12">
                  <span className="row-main">{i.label.toLowerCase()}</span>
                  <span className="mono font-bold">{i.qty}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex min-w-0 flex-col gap-8">
            <section aria-labelledby="etapes" className="flex flex-col gap-3.5">
              <SectionHead id="etapes" title="Préparation" tag={r.totalMin ? minutes(r.totalMin) : undefined} />
              <ol className="flex flex-col gap-3.5">
                {r.steps.map((s, i) => (
                  <li key={i} className="card flex items-start gap-4">
                    <span className="t-hero w-16 flex-none text-[56px] leading-[.8]" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="t-3 !font-medium">{s}</p>
                  </li>
                ))}
              </ol>
            </section>

            {r.variants.length > 0 && (
              <section aria-labelledby="saison" className="flex flex-col gap-3">
                <SectionHead id="saison" title="Variantes de saison" />
                <ul className="flex flex-col gap-2">
                  {r.variants.map((v) => (
                    <li key={v.label} className="card">
                      <span className="font-bold">{v.label}</span> ({monthRange(v.months)}) :{" "}
                      {v.ingredients.map((i) => `${i.qty} ${i.label.toLowerCase()}`).join(", ")}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(r.fridgeDays !== null || r.freezable || r.storage) && (
              <section aria-labelledby="conservation" className="card tone-stock flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <Icon name="snow" className="ic" />
                  <h2 id="conservation" className="t-2">
                    Conservation et congélation
                  </h2>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {r.fridgeDays !== null && <li>Se conserve {r.fridgeDays} jours au frigo après la session de batch cooking.</li>}
                  <li>{r.freezable ? "Se congèle : décongèle-le la veille au frigo." : "Ne se congèle pas : prévois-le dans les premiers jours."}</li>
                  {r.storage && <li>Conditionnement : {r.storage}.</li>}
                  {r.reheat && <li>Le jour du repas : {r.reheat}</li>}
                </ul>
              </section>
            )}

            {r.kidTip && (
              <section aria-labelledby="enfants" className="card tone-banane flex flex-col gap-1.5">
                <h2 id="enfants" className="t-ui">
                  Astuce pour les enfants
                </h2>
                <p>{r.kidTip}</p>
              </section>
            )}

            {r.nutrition && (
              <section aria-labelledby="nutrition" className="card flex flex-col gap-2.5">
                <h2 id="nutrition" className="t-2">
                  Valeurs nutritionnelles
                </h2>
                <p>
                  Estimation par portion adulte : <span className="mono font-bold">{r.nutrition.kcal} kcal</span>,{" "}
                  <span className="mono font-bold">{r.nutrition.protein} g</span> de protéines,{" "}
                  <span className="mono font-bold">{r.nutrition.carbs} g</span> de glucides,{" "}
                  <span className="mono font-bold">{r.nutrition.fat} g</span> de lipides.
                </p>
              </section>
            )}
          </div>
        </div>
      </article>

      {(menus.length > 0 || hub) && (
        <aside aria-labelledby="liens" className="flex flex-col gap-3.5">
          <SectionHead id="liens" title="À découvrir aussi" />
          <ul className="grid gap-4 min-[900px]:grid-cols-3">
            {menus.slice(0, 4).map((m) => (
              <li key={m.slug} className="flex">
                <LinkCard href={`/menus/${m.slug}`} kicker="Menu de la semaine" tone="tone-menu" title={m.h1} />
              </li>
            ))}
            {hub && (
              <li className="flex">
                <LinkCard href={`/batch-cooking/${hub.slug}`} kicker="Batch cooking" tone="tone-session" title={hub.label} />
              </li>
            )}
          </ul>
        </aside>
      )}
    </PageFrame>
  );
}
