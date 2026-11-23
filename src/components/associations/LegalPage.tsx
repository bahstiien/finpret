import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { Container } from "@/components/landing/Section";
import { legalFr, type LegalSlug, SITE_URL } from "@/i18n/associations";
import { type LegalBlock, type LegalDoc, legalDocs, hasPending } from "@/i18n/legal";
import { PublicFooter, PublicHeader } from "./PublicShell";
import { Card } from "@/components/ui/Card";
import ingredientLabels from "../../../seed/ingredients.json";
import prices from "../../../seed/prices.json";

export function legalMetadata(slug: LegalSlug): Metadata {
  const page = legalFr.pages[slug];
  return { title: page.title, alternates: { canonical: `${SITE_URL}/${slug}` } };
}

const docOf = (slug: LegalSlug): LegalDoc | null =>
  slug in legalDocs ? legalDocs[slug as keyof typeof legalDocs] : null;

/**
 * Page légale : texte de `src/i18n/legal.ts` (mentions légales, CGU, CGV). Les pages encore sans texte
 * (confidentialité, partenariat) gardent leur plan et le marqueur TODO(juriste).
 */
export function LegalPage({ slug }: { slug: LegalSlug }) {
  const page = legalFr.pages[slug];
  if (!page) notFound();
  const doc = docOf(slug);
  return (
    <>
      <PublicHeader signup={false} />
      <main id="contenu">
        <Container narrow className="flex flex-col gap-8 py-12 min-[900px]:py-16">
          <header className="flex flex-col gap-2">
            <h1 className="t-1">{page.title}</h1>
            {doc && <p className="t-small muted">Version du {doc.version}</p>}
          </header>
          {doc ? (
            <>
              {hasPending(doc) && (
                <Card as="p" tone="banane" className="t-ui" data-testid="legal-pending">
                  {legalFr.pending}
                </Card>
              )}
              {doc.sections.map((s) => (
                <section key={s.title} className="flex flex-col gap-3">
                  <h2 className="t-2">{s.title}</h2>
                  <Blocks blocks={s.blocks} />
                </section>
              ))}
            </>
          ) : (
            <>
              <Card as="p" tone="banane" className="t-ui" data-testid="legal-todo">
                {legalFr.todo}
              </Card>
              {page.sections.map((s) => (
                <section key={s} className="flex flex-col gap-2">
                  <h2 className="t-2">{s}</h2>
                  <p className="mono muted">TODO(juriste)</p>
                </section>
              ))}
            </>
          )}
          {slug === "cgv" && <PriceSources />}
        </Container>
      </main>
      <PublicFooter />
    </>
  );
}

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if ("p" in b) return <p key={i}>{rich(b.p)}</p>;
        if ("h3" in b) return <h3 key={i} className="t-3 mt-2">{b.h3}</h3>;
        if ("ul" in b)
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {b.ul.map((li, j) => <li key={j}>{rich(li)}</li>)}
            </ul>
          );
        if ("ol" in b)
          return (
            <ol key={i} className="flex list-decimal flex-col gap-1 pl-5">
              {b.ol.map((li, j) => <li key={j}>{rich(li)}</li>)}
            </ol>
          );
        if ("table" in b)
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {b.table.head.map((h) => (
                      <th key={h} scope="col" className="t-label border-2 border-[var(--ink)] p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, j) => (
                        <td key={j} className="border-2 border-[var(--ink)] p-2">
                          {rich(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return (
          <Card key={i} as="div" className="flex flex-col gap-3">
            {b.box.title && <p className="t-ui">{b.box.title}</p>}
            <Blocks blocks={b.box.blocks} />
          </Card>
        );
      })}
    </>
  );
}

const TOKEN = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)|\{\{(.+?)\}\}/g;

/** `**gras**`, `[libellé](lien)` (interne : Link ; externe ou mailto : a) et `{{à confirmer}}` (surligné). */
function rich(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = m.index;
    if (m[1] !== undefined) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2] !== undefined && m[3] !== undefined)
      out.push(
        m[3].startsWith("/") ? (
          <Link key={k} href={m[3]} className="lnk">
            {m[2]}
          </Link>
        ) : (
          <a key={k} href={m[3]} className="lnk" {...(m[3].startsWith("http") ? { rel: "noopener noreferrer" } : {})}>
            {m[2]}
          </a>
        ),
      );
    else
      out.push(
        <mark key={k} className="tone-banane px-1" data-testid="legal-todo-item">
          {m[4]}
        </mark>,
      );
    last = k + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}

/** Annexe des CGV : provenance des prix de référence (seed/prices.json), magasin, date du relevé et sources des estimations. */
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
