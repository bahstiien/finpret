import Link from "next/link";
import { QuickAction, TaskForm } from "@/components/admin/BoardForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill, type PillTone } from "@/components/ui/Pill";
import {
  isOverdue,
  sortTasks,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  type TaskCategory,
} from "@/lib/admin-board";
import { formatShort, todayIn } from "@/lib/dates";
import {
  createTask,
  deleteTask,
  setTaskStatus,
  syncNotionRoadmap,
  updateTask,
} from "@/server/actions/admin-board";
import { notionAvailable } from "@/server/notion";
import { requireAdmin } from "@/server/admin";
import { listTasks } from "@/server/admin-board";

const CATEGORY_TONE: Record<TaskCategory, PillTone> = { dev: "violet", marketing: "peach", social: "blue" };
const COLUMN_TONE = { todo: "surface", doing: "yellow", done: "green" } as const;

/** Todolist du back-office : actions de dev, de marketing et de réseaux sociaux, en trois colonnes. */
export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { role } = await requireAdmin();
  const { cat } = await searchParams;
  const category = TASK_CATEGORIES.find((c) => c === cat);
  const all = await listTasks();
  const tasks = sortTasks(category ? all.filter((t) => t.category === category) : all);
  const today = todayIn("Europe/Paris");
  const canWrite = role === "owner";
  const lastSync = all.reduce<string | null>(
    (max, t) => (t.synced_at && (!max || t.synced_at > max) ? t.synced_at : max),
    null,
  );
  const openCount = (c?: TaskCategory) =>
    all.filter((t) => t.status !== "done" && (!c || t.category === c)).length;

  return (
    <>
      <PageHeader
        title="Actions à mener"
        description="Dev, marketing et réseaux sociaux : ce qui reste à faire pour le lancement et après."
        actions={
          canWrite && notionAvailable() ? (
            <QuickAction
              action={syncNotionRoadmap}
              fields={{}}
              label="Synchroniser avec Notion"
              variant="dark"
            />
          ) : undefined
        }
      />
      <p className="t-small muted">
        {notionAvailable()
          ? lastSync
            ? `Roadmap Notion synchronisée le ${formatShort(lastSync.slice(0, 10))} à ${lastSync.slice(11, 16)} (UTC). Déplacer une action importée met à jour son statut dans Notion.`
            : "Roadmap Notion pas encore importée : clique sur « Synchroniser avec Notion »."
          : "Roadmap Notion non reliée : ajoute NOTION_TOKEN (intégration interne ayant accès à la base Roadmap) pour l'importer ici."}
      </p>
      <nav aria-label="Filtrer par catégorie" className="flex flex-wrap gap-2">
        <Link
          href="/admin/actions"
          className={`btn btn--sm ${category ? "btn--outline" : "btn--dark"}`}
          aria-current={!category ? "page" : undefined}
        >
          Tout <span className="mono">{openCount()}</span>
        </Link>
        {TASK_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/admin/actions?cat=${c}`}
            className={`btn btn--sm ${category === c ? "btn--dark" : "btn--outline"}`}
            aria-current={category === c ? "page" : undefined}
          >
            {TASK_CATEGORY_LABEL[c]} <span className="mono">{openCount(c)}</span>
          </Link>
        ))}
      </nav>

      {canWrite && (
        <details className="card !shadow-none" open={!all.length}>
          <summary className="t-label cursor-pointer">Ajouter une action</summary>
          <div className="mt-4">
            <TaskForm action={createTask} submitLabel="Ajouter" />
          </div>
        </details>
      )}

      <div className="grid gap-4 min-[1100px]:grid-cols-3">
        {TASK_STATUSES.map((status, col) => {
          const column = tasks.filter((t) => t.status === status);
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="flex flex-col gap-3">
              <Card
                tone={COLUMN_TONE[status]}
                padding="sm"
                className="flex items-center justify-between !shadow-none"
              >
                <h2 id={`col-${status}`} className="t-label">
                  {TASK_STATUS_LABEL[status]}
                </h2>
                <span className="mono font-bold">{column.length}</span>
              </Card>
              <ul className="flex flex-col gap-3">
                {column.map((t) => {
                  const late = isOverdue(t, today);
                  const prev = TASK_STATUSES[col - 1];
                  const next = TASK_STATUSES[col + 1];
                  return (
                    <Card
                      as="li"
                      key={t.id}
                      padding="sm"
                      className={`flex flex-col gap-2 !shadow-none ${status === "done" ? "opacity-70" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={CATEGORY_TONE[t.category]}>{TASK_CATEGORY_LABEL[t.category]}</Pill>
                        {t.priority === "high" && <Pill tone="pink">Priorité haute</Pill>}
                        {late && <Pill tone="dark">En retard</Pill>}
                      </div>
                      <h3
                        className={`font-bold [overflow-wrap:anywhere] ${status === "done" ? "line-through" : ""}`}
                      >
                        {t.title}
                      </h3>
                      {t.details && (
                        <p className="t-small whitespace-pre-line [overflow-wrap:anywhere]">{t.details}</p>
                      )}
                      {(t.notion_url || t.contact_message_id) && (
                        <p className="t-small flex flex-wrap gap-3">
                          {t.notion_url && (
                            <a href={t.notion_url} target="_blank" rel="noreferrer" className="lnk">
                              Ouvrir dans Notion ↗
                            </a>
                          )}
                          {t.contact_message_id && (
                            <Link href={`/admin/demandes#demande-${t.contact_message_id}`} className="lnk">
                              Voir la demande
                            </Link>
                          )}
                        </p>
                      )}
                      <p className="t-small muted">
                        {t.due_on ? `Pour le ${formatShort(t.due_on)}` : "Sans échéance"}
                        {t.priority !== "high"
                          ? ` · priorité ${TASK_PRIORITY_LABEL[t.priority].toLowerCase()}`
                          : ""}
                        {t.done_at && status === "done"
                          ? ` · faite le ${formatShort(t.done_at.slice(0, 10))}`
                          : ""}
                      </p>
                      {canWrite && (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {prev && (
                              <QuickAction
                                action={setTaskStatus}
                                fields={{ id: t.id, status: prev }}
                                label={`← ${TASK_STATUS_LABEL[prev]}`}
                                ariaLabel={`Remettre « ${t.title} » dans ${TASK_STATUS_LABEL[prev]}`}
                              />
                            )}
                            {next && (
                              <QuickAction
                                action={setTaskStatus}
                                fields={{ id: t.id, status: next }}
                                label={`${TASK_STATUS_LABEL[next]} →`}
                                variant="dark"
                                ariaLabel={`Passer « ${t.title} » dans ${TASK_STATUS_LABEL[next]}`}
                              />
                            )}
                            {!t.notion_url && (
                              <QuickAction
                                action={deleteTask}
                                fields={{ id: t.id }}
                                label="Supprimer"
                                variant="ghost"
                                confirm={`Supprimer « ${t.title} » ?`}
                                ariaLabel={`Supprimer « ${t.title} »`}
                              />
                            )}
                          </div>
                          <details>
                            <summary className="t-small cursor-pointer underline">Modifier</summary>
                            <div className="mt-3 flex flex-col gap-2">
                              {t.notion_url && (
                                <p className="t-small muted">
                                  Action importée de Notion : seule la catégorie est conservée à la prochaine
                                  synchronisation, le reste se modifie dans Notion.
                                </p>
                              )}
                              <TaskForm action={updateTask} task={t} submitLabel="Enregistrer" />
                            </div>
                          </details>
                        </>
                      )}
                    </Card>
                  );
                })}
                {!column.length && <li className="t-small muted px-1">Rien ici.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
