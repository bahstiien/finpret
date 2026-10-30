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
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}
