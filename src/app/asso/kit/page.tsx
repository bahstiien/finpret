import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "@/components/asso/CopyBlock";
import { StatusBanner } from "@/components/asso/StatusBanner";
import { fr } from "@/i18n/fr";
import { requireAssociation } from "@/server/asso-session";

const t = fr.asso.kit;

export const metadata: Metadata = { title: t.title };

/** Kit de communication : fiche tuto (PDF et version web), e-mail type, message pour les groupes de parents. */
export default async function KitPage() {
  const association = await requireAssociation();
  const ready = association.status === "approved";
  return (
    <>
      <h1 className="text-4xl font-black">{t.title}</h1>
      <p className="text-muted">{t.lead}</p>
      <StatusBanner association={association} />
      {ready ? (
        <>
          <section className="flex flex-col gap-3 rounded-card bg-surface p-5">
            <h2 className="text-lg font-extrabold">{t.tuto}</h2>
            <p className="text-sm text-muted">{t.tutoHint}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/asso/kit/tuto"
                className="inline-flex min-h-11 items-center rounded-pill bg-banana px-6 font-bold text-[#17151F]"
              >
                {t.tutoDownload}
              </a>
              <Link
                href={`/ecole/${association.code}/comment-ca-marche`}
                className="inline-flex min-h-11 items-center rounded-pill border-2 border-ink px-6 font-bold"
              >
                {t.tutoWeb}
              </Link>
            </div>
          </section>
          <CopyBlock
            title={`${t.emailTitle} : ${t.emailSubject(association.name)}`}
            text={t.emailBody(association.name, association.code)}
          />
          <CopyBlock title={t.groupTitle} text={t.groupBody(association.name, association.code)} />
          <p className="text-sm text-muted">{t.rules}</p>
        </>
      ) : (
        <p className="text-muted">{t.pending}</p>
      )}
    </>
  );
}
