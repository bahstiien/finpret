import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { qrDataUrl } from "@/server/pdf/tuto-pdf";
import { formatLong } from "@/lib/dates";
import { tutoContent } from "@/lib/tuto";
import { fr } from "@/i18n/fr";
import { associationByCode } from "@/server/associations";
import { allow, clientIp } from "@/server/rate-limit";
import { headers } from "next/headers";
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
      <p className="text-sm font-bold tracking-wide text-violet uppercase">Fin Prêt</p>
      <PageHeader title={c.title} />
      <p className="text-lg text-muted">{c.hook}</p>
      <section>
        <h2 className="mb-2 text-xl font-extrabold">{c.stepsTitle}</h2>
        <ol className="list-decimal pl-5">
          {c.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-extrabold">{c.featuresTitle}</h2>
        <ul className="list-disc pl-5">
          {c.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <Card as="p" tone="yellow" padding="cozy" className="font-bold">
        {c.benefit}
      </Card>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR code généré à la volée (data URL) */}
        <img src={qr} alt={`QR code vers ${c.address}`} width={130} height={130} />
        <p className="font-bold">{c.address}</p>
      </div>
    </main>
  );
}
