import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Extras";
import { FormMessage } from "@/components/ui/Field";
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
        <FormMessage tone="error">{t.tooMany}</FormMessage>
      </main>
    );
  }
  const association = await associationByCode(code);
  const active = association?.status === "approved";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      {active && association ? (
        <>
          <Sticker tone="banane" className="self-start">
            {t.eyebrow}
          </Sticker>
          <PageHeader title={t.title(association.name)} />
          {association.schools.length > 0 && (
            <p className="muted">{association.schools.map((s) => `${s.name} (${s.city})`).join(" · ")}</p>
          )}
          <Card tone="banane" aria-label={t.benefitLabel}>
            <p className="t-3">{t.benefit}</p>
            <p className="t-small mt-1">{t.benefitHint(association.name)}</p>
          </Card>
          <form action={startWithCode}>
            <input type="hidden" name="code" value={association.code} />
            <Button type="submit" size="lg" className="btn--block">
              {t.cta}
            </Button>
          </form>
          <Link href={`/ecole/${association.code}/comment-ca-marche`} className="lnk t-small self-start">
            {t.howItWorks}
          </Link>
        </>
      ) : (
        <>
          <h1 className="t-1">{t.inactiveTitle}</h1>
          <p className="muted">{t.inactiveBody}</p>
          <Link href="/login" className="lnk self-start">
            {t.inactiveCta}
          </Link>
        </>
      )}
    </main>
  );
}
