import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { fr } from "@/i18n/fr";
import { associationByCode } from "@/server/associations";
import { startWithCode } from "@/server/actions/ecole";
import { allow, clientIp } from "@/server/rate-limit";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.ecole;

// Contenu quasi identique d'une école à l'autre et réservé au lien de l'association : jamais indexé (SPEC_JANVIER §8 bis).
export const metadata: Metadata = {
  title: t.metaTitle,
  robots: { index: false, follow: false },
};

/** Page publique d'une association : son nom, l'avantage pour les familles et le bouton d'inscription. */
export default async function EcolePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!allow(`ecole-page:${await clientIp()}`, 30, 60_000)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-6">
        <p role="alert">{t.tooMany}</p>
      </main>
    );
  }
  const association = await associationByCode(code);
  const active = association?.status === "approved";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      {active && association ? (
        <>
          <p className="text-sm font-bold tracking-wide text-violet uppercase">{t.eyebrow}</p>
          <PageHeader title={t.title(association.name)} />
          {association.schools.length > 0 && (
            <p className="text-muted">
              {association.schools.map((s) => `${s.name} (${s.city})`).join(" · ")}
            </p>
          )}
          <Card tone="yellow" padding="cozy" aria-label={t.benefitLabel}>
            <p className="font-bold">{t.benefit}</p>
            <p className="text-sm text-muted">{t.benefitHint(association.name)}</p>
          </Card>
          <form action={startWithCode}>
            <input type="hidden" name="code" value={association.code} />
            <Button type="submit" className="w-full">
              {t.cta}
            </Button>
          </form>
          <Link
            href={`/ecole/${association.code}/comment-ca-marche`}
            className="text-sm font-semibold underline"
          >
            {t.howItWorks}
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">{t.inactiveTitle}</h1>
          <p className="text-muted">{t.inactiveBody}</p>
          <Link href="/login" className="font-semibold underline">
            {t.inactiveCta}
          </Link>
        </>
      )}
    </main>
  );
}
