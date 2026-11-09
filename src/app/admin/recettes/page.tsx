import Link from "next/link";
import { NoteForm, QuickAction } from "@/components/admin/BoardForms";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { EDITABLE_KIND_LABEL } from "@/engine/catalog/admin-recipe";
import { formatShort } from "@/lib/dates";
import {
  SUGGESTION_STATUS_LABEL,
  SUGGESTION_STATUSES,
  type SuggestionStatus,
} from "@/lib/recipe-suggestions";
import { setSuggestionNote, setSuggestionStatus } from "@/server/actions/admin-recipes";
import { requireAdmin } from "@/server/admin";
import { listSuggestions } from "@/server/recipe-suggestions";

const STATUS_TONE: Record<SuggestionStatus, PillTone> = { new: "pink", accepted: "green", rejected: "chip" };

/** Catalogue : suggestions des utilisateurs (correction d'une recette, nouvelle recette), à appliquer ou refuser. */
export default async function AdminSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { role } = await requireAdmin();
  const sp = await searchParams;
  // Par défaut, seulement ce qui reste à traiter.
  const status =
    sp.status === "all" ? undefined : (SUGGESTION_STATUSES.find((s) => s === sp.status) ?? "new");
  const { rows, counts } = await listSuggestions({ status });
  const all = SUGGESTION_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const canWrite = role === "owner";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Suggestions de recettes"
          description="Envoyées depuis Découvrir. « Appliquer » ouvre la recette dans l'éditeur : enregistrer met la bibliothèque à jour pour tous les foyers."
        />
        {canWrite && (
          <Link href="/admin/bibliotheque" className={buttonClass({ variant: "outline", size: "sm" })}>
            Bibliothèque
          </Link>
        )}
      </div>
      <nav aria-label="Filtrer par état" className="flex flex-wrap gap-2">
        {SUGGESTION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/recettes?status=${s}`}
            className={`btn btn--sm ${status === s ? "btn--dark" : "btn--outline"}`}
            aria-current={status === s ? "page" : undefined}
          >
            {SUGGESTION_STATUS_LABEL[s]} <span className="mono">{counts[s] ?? 0}</span>
          </Link>
        ))}
        <Link
          href="/admin/recettes?status=all"
          className={`btn btn--sm ${status ? "btn--outline" : "btn--dark"}`}
          aria-current={!status ? "page" : undefined}
        >
          Toutes <span className="mono">{all}</span>
        </Link>
      </nav>

      <ul className="flex flex-col gap-3">
        {rows.map((s) => {
          const applyHref =
            s.kind === "edit"
              ? `/admin/recettes/appliquer?suggestion=${s.id}&recipe=${encodeURIComponent(s.recipe_id ?? "")}`
              : `/admin/recettes/appliquer?suggestion=${s.id}`;
          return (
            <Card
              as="li"
              key={s.id}
              id={`suggestion-${s.id}`}
              className="flex flex-col gap-3 !shadow-none"
              data-testid="recipe-suggestion"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="t-small muted">
                    {formatShort(s.created_at.slice(0, 10))} ·{" "}
                    {s.kind === "edit"
                      ? "Modification"
                      : `Nouvelle recette · ${s.recipe_kind ? EDITABLE_KIND_LABEL[s.recipe_kind] : ""}`}
                  </p>
                  <h2 className="t-3 [overflow-wrap:anywhere]">{s.title}</h2>
                  <p className="t-small">
                    {s.email ? (
                      <>
                        <a
                          className="lnk"
                          href={`mailto:${s.email}?subject=${encodeURIComponent(`Ta suggestion : ${s.title}`)}`}
                        >
                          {s.email}
                        </a>{" "}
                        ·{" "}
                        <Link
                          href={`/admin/fiche?email=${encodeURIComponent(s.email)}`}
                          className="underline"
                        >
                          fiche contact
                        </Link>
                      </>
                    ) : (
                      <span className="muted">compte supprimé</span>
                    )}
                    {s.kind === "edit" && s.recipe_id && (
                      <>
                        {" "}
                        · recette <code className="mono">{s.recipe_id}</code>
                        {!s.recipe_name && <span className="muted"> (introuvable)</span>}
                      </>
                    )}
                  </p>
                  {s.source_url && (
                    <p className="t-small">
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="lnk"
                      >
                        {s.source_url}
                      </a>
                    </p>
                  )}
                </div>
                <Pill tone={STATUS_TONE[s.status]}>{SUGGESTION_STATUS_LABEL[s.status]}</Pill>
              </div>
              <p className="whitespace-pre-line border-l-[length:var(--bw)] border-line pl-3 [overflow-wrap:anywhere]">
                {s.message}
              </p>
              {s.handled_at && s.status !== "new" && (
                <p className="t-small muted">
                  {SUGGESTION_STATUS_LABEL[s.status]} le {formatShort(s.handled_at.slice(0, 10))}
                  {s.handler ? ` par ${s.handler}` : ""}
                  {s.applied_recipe_id && (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        href={`/admin/recettes/appliquer?recipe=${encodeURIComponent(s.applied_recipe_id)}`}
                        className="underline"
                      >
                        {s.applied_recipe_id}
                      </Link>
                    </>
                  )}
                </p>
              )}
              {canWrite ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {s.status === "new" && (
                      <Link href={applyHref} className={buttonClass({ size: "sm" })}>
                        {s.kind === "edit" ? "Appliquer la modification" : "Ajouter à la bibliothèque"}
                      </Link>
                    )}
                    {s.status === "new" && (
                      <QuickAction
                        action={setSuggestionStatus}
                        fields={{ id: String(s.id), status: "rejected" }}
                        label="Refuser"
                        variant="outline"
                      />
                    )}
                    {s.status !== "new" && (
                      <QuickAction
                        action={setSuggestionStatus}
                        fields={{ id: String(s.id), status: "new" }}
                        label="Remettre à traiter"
                        variant="outline"
                      />
                    )}
                  </div>
                  <NoteForm id={s.id} note={s.note} action={setSuggestionNote} />
                </>
              ) : (
                s.note && <p className="t-small">Note : {s.note}</p>
              )}
            </Card>
          );
        })}
        {!rows.length && (
          <Card as="li" className="muted !shadow-none">
            {status === "new" ? "Aucune suggestion à traiter." : "Aucune suggestion."}
          </Card>
        )}
      </ul>
    </>
  );
}
