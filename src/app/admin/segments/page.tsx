import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";
import { SEGMENT_KEYS, SEGMENTS } from "@/lib/admin-board";
import { formatShort } from "@/lib/dates";
import { requireAdmin } from "@/server/admin";
import { segmentMembers, tagsFor } from "@/server/admin-board";

const PLAN_LABEL: Record<string, string> = {
  trial: "Essai",
  monthly: "Mensuel",
  yearly: "Annuel",
  free: "Gratuit",
};

/** Segments prêts à l'emploi : qui relancer, avec export CSV à importer dans Brevo. */
export default async function AdminSegmentsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireAdmin();
  const { s } = await searchParams;
  const current = SEGMENT_KEYS.find((k) => k === s) ?? SEGMENT_KEYS[0]!;
  const all = await Promise.all(SEGMENT_KEYS.map(async (k) => [k, await segmentMembers(k)] as const));
  const members = all.find(([k]) => k === current)![1];
  const tags = await tagsFor(members.slice(0, 200).map((m) => m.id));

  return (
    <>
      <PageHeader
        title="Segments"
        description="Les comptes à relancer, prêts à exporter vers Brevo pour une campagne ciblée."
      />
      <div className="grid gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
        {all.map(([k, rows]) => (
          <Link
            key={k}
            href={`/admin/segments?s=${k}`}
            aria-current={k === current ? "page" : undefined}
            className={`card flex flex-col gap-1 !shadow-none ${k === current ? "tone-banane" : ""}`}
          >
            <span className="t-label">{SEGMENTS[k].label}</span>
            <span className="num-l">{rows.length}</span>
            <span className="t-small">{SEGMENTS[k].description}</span>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-3 !shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="t-2">{SEGMENTS[current].label}</h2>
          {members.length > 0 && (
            <a href={`/admin/segments/export?s=${current}`} className="btn btn--dark btn--sm">
              Exporter pour Brevo (CSV)
            </a>
          )}
        </div>
        <ul>
          {members.slice(0, 200).map((m) => (
            <li key={m.id} className="row t-small flex-wrap justify-between gap-2">
              <span>
                <Link href={`/admin/fiche?email=${encodeURIComponent(m.email)}`} className="underline">
                  <b>{m.email}</b>
                </Link>
                {m.name ? ` · ${m.name}` : ""}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {(tags.get(m.id) ?? []).map((t) => (
                  <Pill key={t} tone="violet">
                    {t}
                  </Pill>
                ))}
                {m.plan && (
                  <Pill tone={m.plan === "trial" ? "yellow" : "green"}>{PLAN_LABEL[m.plan] ?? m.plan}</Pill>
                )}
                <span className="mono muted">inscrit le {formatShort(m.created_at.slice(0, 10))}</span>
              </span>
            </li>
          ))}
          {!members.length && <li className="muted t-small">Personne dans ce segment pour le moment.</li>}
        </ul>
        {members.length > 200 && (
          <p className="t-small muted">
            200 premiers affichés sur {members.length} ; l&apos;export contient tout le segment.
          </p>
        )}
      </Card>
    </>
  );
}
