import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { qrDataUrl } from "@/server/pdf/tuto-pdf";
import { formatLong } from "@/lib/dates";
import { tutoContent } from "@/lib/tuto";
import { fr } from "@/i18n/fr";
import { associationByCode } from "@/server/associations";
import { allow, clientIp } from "@/server/rate-limit";
import { headers } from "next/headers";
import { Sticker } from "@/components/ui/Extras";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: fr.ecole.metaTitle,
  robots: { index: false, follow: false },
};

/** Version web de la fiche tuto d'une association : mêmes textes que le PDF (page famille uniquement). */
export default async function HowItWorksPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!allow(`ecole-page:${await clientIp()}`, 30, 60_000)) notFound();
  const association = await associationByCode(code);
  if (!association || association.status !== "approved") notFound();
  const h = await headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const c = tutoContent({
    associationName: association.name,
    code: association.code,
    schools: association.schools,
    startDate: "",
    generatedAt: formatLong(new Date().toISOString().slice(0, 10)),
    baseUrl,
  }).family;
  const qr = await qrDataUrl(baseUrl, association.code);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 p-6">
      <Sticker tone="banane" className="self-start">
        Fin Prêt
      </Sticker>
      <PageHeader title={c.title} />
      <p className="t-3 muted">{c.hook}</p>
      <section className="flex flex-col gap-3">
        <h2 className="t-2">{c.stepsTitle}</h2>
        <ol className="flex flex-col gap-3">
          {c.steps.map((s, i) => (
            <li key={s} className="card flex items-start gap-3">
              <span className="avatar tone-violet mono">{i + 1}</span>
              <span className="t-body">{s}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="t-2">{c.featuresTitle}</h2>
        <ul className="flex flex-col gap-3">
          {c.features.map((f) => (
            <li key={f} className="card tone-green flex items-start gap-3">
              <Icon name="check" className="size-5" />
              <span className="t-body">{f}</span>
            </li>
          ))}
        </ul>
      </section>
      <Card as="p" tone="banane" className="t-3">
        {c.benefit}
      </Card>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR code généré à la volée (data URL) */}
        <img
          src={qr}
          alt={`QR code vers ${c.address}`}
          width={130}
          height={130}
          className="border-[length:var(--bw)] border-line"
        />
        <p className="t-ui mono">{c.address}</p>
      </div>
    </main>
  );
}
