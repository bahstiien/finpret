import type { Metadata } from "next";
import Link from "next/link";
import { CopyBlock } from "@/components/asso/CopyBlock";
import { StatusBanner } from "@/components/asso/StatusBanner";
import { fr } from "@/i18n/fr";
import { requireAssociation } from "@/server/asso-session";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.asso.kit;

export const metadata: Metadata = { title: t.title };

/** Kit de communication : fiche tuto (PDF et version web), e-mail type, message pour les groupes de parents. */
export default async function KitPage() {
  const association = await requireAssociation();
  const ready = association.status === "approved";
  return (
    <>
      <PageHeader title={t.title} />
      <p className="text-muted">{t.lead}</p>
      <StatusBanner association={association} />
      {ready ? (
        <>
          <Card padding="cozy" className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">{t.tuto}</h2>
            <p className="text-sm text-muted">{t.tutoHint}</p>
            <div className="flex flex-wrap gap-2">
              <a href="/asso/kit/tuto" className={buttonClass()}>
                {t.tutoDownload}
              </a>
              <Link
                href={`/ecole/${association.code}/comment-ca-marche`}
                className={buttonClass({ variant: "outline" })}
              >
                {t.tutoWeb}
              </Link>
            </div>
          </Card>
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
