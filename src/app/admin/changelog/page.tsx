import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/server/admin";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import type { buildChangelog } from "../../../../scripts/lib/changelog.mjs";

const REPO = "https://github.com/bahstiien/finpret";

/** Changelog : chaque déploiement en production et les PR qu'il a livrées (changelog.json, écrit au build CI). */
export default async function AdminChangelogPage() {
  await requireAdmin();
  // Absent en local : le fichier n'est généré que par le workflow Deploy.
  const deploys: ReturnType<typeof buildChangelog> = await readFile(
    path.join(process.cwd(), "changelog.json"),
    "utf8",
  )
    .then(JSON.parse)
    .catch(() => []);
  return (
    <>
      <PageHeader title="Changelog" description="Chaque mise en production et ce qu'elle a livré." />
      {deploys.map((d) => (
        <Card as="section" key={`${d.sha}-${d.run}`} className="t-small flex flex-col gap-2 !shadow-none">
          <h2 className="flex flex-wrap items-baseline gap-x-2">
            <b>
              {new Date(d.at).toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
                dateStyle: "long",
                timeStyle: "short",
              })}
            </b>
            <a
              className="mono muted"
              href={d.run ? `${REPO}/actions/runs/${d.run}` : `${REPO}/commit/${d.sha}`}
            >
              {d.sha.slice(0, 7)}
            </a>
          </h2>
          <ul className="flex flex-col gap-1">
            {d.changes?.map((c, i) => (
              <li key={i}>
                {c.pr && (
                  <a className="mono" href={`${REPO}/pull/${c.pr}`}>
                    #{c.pr}
                  </a>
                )}{" "}
                {c.title}
              </li>
            ))}
            {d.changes === null && <li className="muted">Historique introuvable.</li>}
            {d.changes?.length === 0 && (
              <li className="muted">Aucun changement (premier déploiement ou relance).</li>
            )}
          </ul>
        </Card>
      ))}
      {!deploys.length && <p className="muted">Disponible après le prochain déploiement.</p>}
    </>
  );
}
