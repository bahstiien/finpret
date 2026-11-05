import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Faq, LinkCard, PageFrame, SectionHead } from "@/components/seo/Shell";
import { RecipeImage } from "@/components/ui/RecipeImage";
import { displayName } from "@/seo/catalog";
import { SIGNUP_PATH } from "@/seo/config";
import { dayOffset, EXAMPLES, getExample, portionLabel } from "@/seo/exemples";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd, type Crumb } from "@/seo/jsonld";
import { clamp, DESCRIPTION_MAX, fitTitle, pageMetadata } from "@/seo/meta";

export const dynamicParams = false;

export const generateStaticParams = () => EXAMPLES.map((e) => ({ slug: e.slug }));

const PERSONALISE = "Personnaliser ce menu dans Fin Prêt";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = getExample(slug);
  if (!e) return {};
  return pageMetadata({
    title: fitTitle(e.h1),
    description: clamp(
      `${e.slots.map((s) => displayName(s.recipe)).join(", ")}. Portions pour ${portionLabel(e.portions)} adultes, quantités à acheter et organisation de la semaine.`,
      DESCRIPTION_MAX,
    ),
    path: e.path,
    indexable: true,
    image: `/og/menu-de-la-semaine/${e.slug}`,
    imageAlt: e.h1,
  });
}

export default async function ExamplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getExample(slug);
  if (!e) notFound();

  const crumbs: Crumb[] = [
    { name: "Accueil", path: "/" },
    { name: "Menus de la semaine", path: "/menus" },
    { name: e.h1, path: e.path },
  ];
  const others = EXAMPLES.filter((x) => x.slug !== e.slug);

  return (
    <PageFrame cta={{ label: PERSONALISE, lead: "Fin Prêt part de ton foyer, de tes goûts et du mois en cours pour composer ton menu et ta liste de courses." }}>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={itemListJsonLd(e.h1, e.slots.map((s) => ({ name: s.recipe.name, path: `/recettes/${s.recipe.slug}` })))} />
      <JsonLd data={faqJsonLd(e.faq)} />
      <Breadcrumbs crumbs={crumbs} />
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <h1 className="t-hero" style={{ fontSize: "clamp(40px, 7vw, 88px)" }}>
            {e.h1}
          </h1>
          <div className="t-body flex max-w-[640px] flex-col gap-3 text-[19px]">
            {e.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div>
            <Link href={SIGNUP_PATH} className="btn btn--primary btn--lg">
              {PERSONALISE}
            </Link>
          </div>
        </header>

        <section aria-labelledby="portions" className="flex flex-col gap-3.5">
          <SectionHead id="portions" title="Qui mange, combien de portions" />
          <ul className="card flex flex-col">
            {e.members.map((m) => (
              <li key={m.label} className="row !min-h-11">
                <span className="row-main">{m.label}</span>
                <span className="mono font-bold">{portionLabel(m.portion)} portion</span>
              </li>
            ))}
            <li className="row !min-h-11">
              <span className="row-main font-bold">Total par repas</span>
              <span className="mono font-bold">{portionLabel(e.portions)} portions</span>
            </li>
          </ul>
          <p>
            Les recettes sont écrites pour 4 portions adultes : les quantités sont multipliées par{" "}
            <span className="mono font-bold">{portionLabel(e.scale)}</span> ({portionLabel(e.portions)} ÷ 4).
          </p>
        </section>

        <section aria-labelledby="repas" className="flex flex-col gap-3.5">
          <SectionHead id="repas" title="Les 5 dîners de la semaine" />
          <ol className="grid gap-4 min-[900px]:grid-cols-2">
            {e.slots.map((s) => {
              const passive = s.recipe.blocks.reduce((t, b) => t + b.passive, 0);
              return (
                <li key={s.recipe.id} className="card recipe-zoom flex flex-col gap-1.5">
                  {s.recipe.photo && (
                    <RecipeImage
                      photo={s.recipe.photo}
                      sizes="(min-width: 900px) 560px, 100vw"
                      decorative
                      className="card-photo mb-2"
                    />
                  )}
                  <p className="t-kicker">{s.day}</p>
                  <h3 className="t-3">
                    <Link href={`/recettes/${s.recipe.slug}`} className="lnk">
                      {displayName(s.recipe)}
                    </Link>
                  </h3>
                  {s.recipe.description && <p className="t-small">{s.recipe.description}</p>}
                  <p className="t-small">
                    {s.from === "frigo"
                      ? `Au frigo : la recette se garde ${s.recipe.fridgeDays} jours après la session ; le ${s.day} est le jour ${dayOffset(s.day)}.`
                      : `Sorti du congélateur : la recette se garde ${s.recipe.fridgeDays} jours au frigo et se congèle.`}
                  </p>
                  <p className="t-small">
                    Le dimanche : <span className="mono font-bold">{s.recipe.activeMin} min</span> de travail actif
                    {passive ? `, ${passive} min d'attente` : ""}.
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="organisation" className="flex flex-col gap-3.5">
          <SectionHead id="organisation" title="Organisation de la semaine" />
          <p>
            Les cinq plats se préparent le dimanche. Le dimanche compte comme le jour 0 : un plat conservé 3 jours au
            frigo se mange au plus tard le mercredi. Le travail actif cumulé des cinq recettes est de{" "}
            <span className="mono font-bold">{e.activeTotal} min</span> ; c&apos;est une somme, pas la durée d&apos;une session,
            car des cuissons se chevauchent. La session guidée de Fin Prêt les enchaîne pour toi.
          </p>
          {e.equipment.length > 0 && <p>Matériel utilisé par ces recettes : {e.equipment.join(", ")}.</p>}
          {e.vegetarianProteins && (
            <p>
              Protéines estimées par portion adulte (valeurs du catalogue) :{" "}
              {e.vegetarianProteins.map((p) => `${p.name}, ${p.protein} g`).join(" ; ")}.
            </p>
          )}
        </section>

        <section aria-labelledby="courses" className="flex flex-col gap-3.5">
          <SectionHead id="courses" title={`Liste de courses pour ${portionLabel(e.portions)} portions`} />
          <div className="grid gap-4 sm:grid-cols-2">
            {e.shopping.map((g) => (
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
          {e.pantry.length > 0 && <p>À vérifier dans ton placard : {e.pantry.join(", ").toLowerCase()}.</p>}
        </section>

        {e.snack && (
          <section aria-labelledby="gouter" className="flex flex-col gap-3.5">
            <SectionHead id="gouter" title="Un goûter à faire avec les enfants" />
            <div className="card recipe-zoom flex flex-col gap-1.5 min-[900px]:max-w-[560px]">
              {e.snack.photo && (
                <RecipeImage photo={e.snack.photo} sizes="(min-width: 900px) 560px, 100vw" decorative className="card-photo mb-2" />
              )}
              <h3 className="t-3">
                <Link href={`/recettes/${e.snack.slug}`} className="lnk">
                  {e.snack.name}
                </Link>
              </h3>
              <p className="t-small">
                {e.snack.yieldText}, {e.snack.timeText}.
              </p>
              <p>Ce que peut faire un enfant : {e.snack.kidTip}</p>
              <p className="t-small">
                Ingrédients : {e.snack.ingredients.map((i) => `${i.qty} ${i.label}`.trim().toLowerCase()).join(", ")}.
              </p>
            </div>
          </section>
        )}
      </article>

      <Faq items={e.faq} />

      <section aria-label="Autres exemples" className="flex flex-col gap-3.5">
        <p className="t-kicker">Autres exemples de semaine :</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {others.map((o) => (
            <LinkCard key={o.slug} href={o.path} kicker="Exemple" tone="tone-menu" title={o.label}>
              <span className="t-small">{o.teaser}</span>
            </LinkCard>
          ))}
        </div>
      </section>
    </PageFrame>
  );
}
