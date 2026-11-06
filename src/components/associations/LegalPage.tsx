import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/landing/Section";
import { legalFr, type LegalSlug, SITE_URL } from "@/i18n/associations";
import { PublicFooter, PublicHeader } from "./PublicShell";
import { Card } from "@/components/ui/Card";
import ingredientLabels from "../../../seed/ingredients.json";
import prices from "../../../seed/prices.json";

export function legalMetadata(slug: LegalSlug): Metadata {
  const page = legalFr.pages[slug];
  return { title: page.title, alternates: { canonical: `${SITE_URL}/${slug}` } };
}

/** Informations de l'éditeur : paramétrables (COMPANY_NAME, COMPANY_ID, COMPANY_VAT), `TODO(juriste)` tant qu'elles manquent. */
function company() {
  const todo = "TODO(juriste)";
  return {
    name: process.env.COMPANY_NAME || todo,
    id: process.env.COMPANY_ID || todo,
    vat: process.env.COMPANY_VAT || todo,
  };
}

/** Gabarit de page légale : plan de la page et marqueur TODO(juriste), sans aucun contenu juridique inventé. */
export function LegalPage({ slug }: { slug: LegalSlug }) {
  const page = legalFr.pages[slug];
  if (!page) notFound();
  const c = company();
  return (
    <>
      <PublicHeader signup={false} />
      <main id="contenu">
        <Container narrow className="flex flex-col gap-8 py-12 min-[900px]:py-16">
          <h1 className="t-1">{page.title}</h1>
          <Card as="p" tone="banane" className="t-ui" data-testid="legal-todo">
            {legalFr.todo}
          </Card>
          {slug === "mentions-legales" && (
            <Card as="dl" data-testid="company">
              <dt className="t-label">Éditeur</dt>
              <dd className="mono">{c.name}</dd>
              <dt className="t-label mt-3">Immatriculation</dt>
              <dd className="mono">{c.id}</dd>
              <dt className="t-label mt-3">TVA</dt>
              <dd className="mono">{c.vat}</dd>
            </Card>
          )}
          {page.sections.map((s) => (
            <section key={s} className="flex flex-col gap-2">
              <h2 className="t-2">{s}</h2>
              <p className="mono muted">TODO(juriste)</p>
            </section>
          ))}
          {slug === "cgv" && <PriceSources />}
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}

/** Provenance des prix de référence (seed/prices.json) : magasin, date du relevé et sources des estimations. */
function PriceSources() {
  const t = legalFr.prices;
  const { store, observedAt } = prices._meta;
  const date = new Date(`${observedAt}T12:00:00`).toLocaleDateString("fr-FR", { dateStyle: "long" });
  const ingredients = ingredientLabels as Record<string, { l: string }>;
  const sourced = Object.entries(prices.prices as Record<string, { product: string; source?: string }>).filter(
    ([, p]) => p.source,
  );
  return (
    <section className="flex flex-col gap-2" data-testid="price-sources">
      <h2 className="t-2">{t.title}</h2>
      <p>{t.intro(store, date)}</p>
      <p>{t.estimates}</p>
      <ul className="list-disc pl-4">
        {sourced.map(([key, p]) => (
          <li key={key}>
            {ingredients[key]?.l ?? key} :{" "}
            <a href={p.source} rel="noopener noreferrer nofollow" target="_blank" className="break-all underline">
              {new URL(p.source!).hostname.replace(/^www./, "")}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
