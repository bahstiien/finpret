import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/landing/Section";
import { legalFr, type LegalSlug, SITE_URL } from "@/i18n/associations";
import { PublicFooter, PublicHeader } from "./PublicShell";
import { Card } from "@/components/ui/Card";

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
        <Container className="flex max-w-3xl flex-col gap-8 py-12 sm:py-20">
          <h1 className="text-4xl font-black">{page.title}</h1>
          <Card as="p" tone="yellow" padding="cozy" className="font-semibold" data-testid="legal-todo">
            {legalFr.todo}
          </Card>
          {slug === "mentions-legales" && (
            <Card as="dl" padding="cozy" data-testid="company">
              <dt className="font-bold">Éditeur</dt>
              <dd>{c.name}</dd>
              <dt className="mt-2 font-bold">Immatriculation</dt>
              <dd>{c.id}</dd>
              <dt className="mt-2 font-bold">TVA</dt>
              <dd>{c.vat}</dd>
            </Card>
          )}
          {page.sections.map((s) => (
            <section key={s} className="flex flex-col gap-2">
              <h2 className="text-2xl font-extrabold">{s}</h2>
              <p className="text-muted">TODO(juriste)</p>
            </section>
          ))}
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
