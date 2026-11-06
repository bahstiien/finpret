import Link from "next/link";
import { NoteForm, QuickAction } from "@/components/admin/BoardForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { LEAD_FLOW, LEAD_STAGE_LABEL, type LeadStage } from "@/lib/admin-board";
import { formatShort } from "@/lib/dates";
import { setLeadNote, setLeadStage } from "@/server/actions/admin-board";
import { requireAdmin } from "@/server/admin";
import { listLeads } from "@/server/admin-board";

const COLUMN_TONE: Record<LeadStage, "surface" | "yellow" | "blue" | "violet" | "green" | "pink"> = {
  to_contact: "yellow",
  contacted: "surface",
  presented: "blue",
  kit_sent: "violet",
  partner: "green",
  lost: "pink",
};

/** Pipeline des demandes de présentation reçues depuis la landing /associations. */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ perdues?: string }>;
}) {
  const { role } = await requireAdmin();
  const canWrite = role === "owner";
  const showLost = (await searchParams).perdues === "1";
  const leads = await listLeads();
  const columns: readonly LeadStage[] = showLost ? [...LEAD_FLOW, "lost"] : LEAD_FLOW;
  const lost = leads.filter((l) => l.stage === "lost").length;
  const partners = leads.filter((l) => l.stage === "partner").length;

  return (
    <>
      <PageHeader
        title="Prospects associations"
        description={`${leads.length} demande${leads.length > 1 ? "s" : ""} de présentation · ${partners} partenaire${
          partners > 1 ? "s" : ""
        } · ${lost} perdue${lost > 1 ? "s" : ""}`}
        actions={
          <Link
            href={showLost ? "/admin/prospects" : "/admin/prospects?perdues=1"}
            className="btn btn--outline btn--sm"
          >
            {showLost ? "Masquer les perdues" : "Voir les perdues"}
          </Link>
        }
      />
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div
          className="grid min-w-[1100px] gap-3"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((stage) => {
            const column = leads.filter((l) => l.stage === stage);
            const i = (LEAD_FLOW as readonly LeadStage[]).indexOf(stage);
            const prev = i > 0 ? LEAD_FLOW[i - 1] : undefined;
            const next = i >= 0 ? LEAD_FLOW[i + 1] : undefined;
            return (
              <section key={stage} aria-labelledby={`stage-${stage}`} className="flex flex-col gap-3">
                <Card
                  tone={COLUMN_TONE[stage]}
                  padding="sm"
                  className="flex items-center justify-between !shadow-none"
                >
                  <h2 id={`stage-${stage}`} className="t-label">
                    {LEAD_STAGE_LABEL[stage]}
                  </h2>
                  <span className="mono font-bold">{column.length}</span>
                </Card>
                <ul className="flex flex-col gap-3">
                  {column.map((l) => (
                    <Card
                      as="li"
                      key={l.id}
                      padding="sm"
                      className="t-small flex flex-col gap-2 !shadow-none"
                      data-testid="lead"
                    >
                      <h3 className="font-bold [overflow-wrap:anywhere]">{l.association_name}</h3>
                      <p className="[overflow-wrap:anywhere]">
                        {l.name} ·{" "}
                        <Link
                          href={`/admin/fiche?email=${encodeURIComponent(l.email)}`}
                          className="underline"
                        >
                          {l.email}
                        </Link>
                      </p>
                      <p className="muted">
                        {[l.school, l.city].filter(Boolean).join(", ")}
                        {l.families_estimate ? ` · ~${l.families_estimate} familles` : ""}
                        <br />
                        reçue le {formatShort(l.created_at.slice(0, 10))}
                        {l.stage_changed_at
                          ? ` · étape du ${formatShort(l.stage_changed_at.slice(0, 10))}`
                          : ""}
                      </p>
                      {canWrite ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {stage === "lost" ? (
                              <QuickAction
                                action={setLeadStage}
                                fields={{ id: l.id, stage: "to_contact" }}
                                label="Rouvrir"
                              />
                            ) : (
                              <>
                                {prev && (
                                  <QuickAction
                                    action={setLeadStage}
                                    fields={{ id: l.id, stage: prev }}
                                    label="←"
                                    ariaLabel={`Remettre ${l.association_name} à l'étape ${LEAD_STAGE_LABEL[prev]}`}
                                  />
                                )}
                                {next && (
                                  <QuickAction
                                    action={setLeadStage}
                                    fields={{ id: l.id, stage: next }}
                                    label={`${LEAD_STAGE_LABEL[next]} →`}
                                    variant="dark"
                                  />
                                )}
                                <QuickAction
                                  action={setLeadStage}
                                  fields={{ id: l.id, stage: "lost" }}
                                  label="Perdue"
                                  variant="ghost"
                                  ariaLabel={`Marquer ${l.association_name} comme perdue`}
                                />
                              </>
                            )}
                          </div>
                          <details>
                            <summary className="cursor-pointer underline">
                              {l.note ? "Note" : "Ajouter une note"}
                            </summary>
                            <div className="mt-2">
                              <NoteForm id={l.id} note={l.note} action={setLeadNote} />
                            </div>
                          </details>
                        </>
                      ) : (
                        l.note && <p>Note : {l.note}</p>
                      )}
                    </Card>
                  ))}
                  {!column.length && <li className="t-small muted px-1">Aucune.</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
