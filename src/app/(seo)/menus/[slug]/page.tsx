import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/associations/JsonLd";
import { Breadcrumbs, Cta, Faq, PageFrame } from "@/components/seo/Shell";
import { displayName } from "@/seo/catalog";
import { getHub, INDEXABLE_HUBS } from "@/seo/hubs";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd, type Crumb } from "@/seo/jsonld";
import { getMenu, MENUS } from "@/seo/menus";
import { menuDescription, menuTitle, pageMetadata } from "@/seo/meta";

export const dynamicParams = false;

export const generateStaticParams = () => MENUS.map((m) => ({ slug: m.slug }));

const minutes = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")}` : `${n} min`);

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

  const hub = INDEXABLE_HUBS.find((h) => h.menu(m)) ?? (m.combo.format === "batch" ? getHub("pour-debutant") : null);
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
      <article className="mt-4">
        <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">{m.h1}</h1>
        <div className="mt-3 flex flex-col gap-3 text-lg text-muted">
          {m.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <section aria-labelledby="repas" className="mt-8">
          <h2 id="repas" className="text-2xl font-extrabold">
            Les {m.recipes.length} repas de la semaine
          </h2>
          <ol className="mt-3 flex flex-col gap-3">
            {m.recipes.map((r, i) => (
              <li key={r.id} className="rounded-card bg-surface p-4">
                <p className="text-sm text-muted">Repas {i + 1}</p>
                <h3 className="text-lg font-bold">
                  <Link href={`/recettes/${r.slug}`} className="underline underline-offset-4">
                    {displayName(r)}
                  </Link>
                </h3>
                {r.description && <p className="mt-1 text-muted">{r.description}</p>}
              </li>
            ))}
          </ol>
        </section>

        {m.plan && m.sessionMin && (
          <section aria-labelledby="planning" className="mt-8">
            <h2 id="planning" className="text-2xl font-extrabold">
              Planning de batch cooking du dimanche
            </h2>
            <p className="mt-2 text-muted">
              Durée estimée : environ {minutes(m.sessionMin)} pour une personne en cuisine. Lance les plats au four et les
              attentes longues en premier, puis enchaîne.
            </p>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-6">
              {m.plan.map((s) => (
                <li key={s.slug}>
                  <Link href={`/recettes/${s.slug}`} className="font-bold underline underline-offset-4">
                    {s.name}
                  </Link>
                  : {s.activeMin} min de travail actif{s.passiveMin ? `, ${s.passiveMin} min d'attente` : ""}
                  {s.oven ? ", au four" : ""}.
                </li>
              ))}
            </ol>
          </section>
        )}

        <section aria-labelledby="courses" className="mt-8">
          <h2 id="courses" className="text-2xl font-extrabold">
            Liste de courses pour {m.combo.persons} personnes
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {m.shopping.map((g) => (
              <div key={g.aisle}>
                <h3 className="font-bold">{g.label}</h3>
                <ul className="mt-1">
                  {g.items.map((it) => (
                    <li key={it.label} className="border-b border-line py-1.5">
                      {it.qty && <span className="font-bold">{it.qty} </span>}
                      {it.label.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {m.pantry.length > 0 && (
            <p className="mt-4 text-muted">À vérifier dans ton placard : {m.pantry.join(", ").toLowerCase()}.</p>
          )}
        </section>
      </article>

      <Faq items={m.faq} />

      {hub && (
        <p className="mt-8">
          Pour aller plus loin :{" "}
          <Link href={`/batch-cooking/${hub.slug}`} className="font-bold underline underline-offset-4">
            {hub.label}
          </Link>
          .
        </p>
      )}
      <Cta />
    </PageFrame>
  );
}
