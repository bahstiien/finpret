import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Pill } from "@/components/ui/Pill";
import { EDITABLE_KIND_LABEL, EDITABLE_KINDS, type EditableKind } from "@/engine/catalog/admin-recipe";
import { requireAdmin } from "@/server/admin";
import { searchCatalog } from "@/server/recipe-suggestions";

/** Bibliothèque de recettes (catalogue global) : recherche, correction et ajout depuis le back-office. */
export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; edited?: string }>;
}) {
  const { role } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const kind = EDITABLE_KINDS.find((k) => k === sp.kind);
  const edited = sp.edited === "1";
  const rows = await searchCatalog({ q: q || undefined, kind, edited });
  const canWrite = role === "owner";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Bibliothèque de recettes"
          description="Catalogue commun à tous les foyers. Les recettes modifiées ici sont conservées par pnpm seed jusqu'à leur report dans seed/*.json."
        />
        {canWrite && (
          <Link
            href={`/admin/recettes/appliquer?new=${kind ?? "main"}`}
            className={buttonClass({ size: "sm" })}
          >
            Ajouter une recette
          </Link>
        )}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="field-label flex flex-1 flex-col gap-1">
          Recherche
          <input
            name="q"
            defaultValue={q}
            placeholder="nom ou identifiant"
            maxLength={80}
            className="input"
          />
        </label>
        <label className="field-label flex flex-col gap-1">
          Type
          <select name="kind" defaultValue={kind ?? ""} className="input">
            <option value="">Tous</option>
            {EDITABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {EDITABLE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 font-bold">
          <input
            type="checkbox"
            name="edited"
            value="1"
            defaultChecked={edited}
            className="size-5 accent-ink"
          />
          Modifiées ici
        </label>
        <button type="submit" className="btn btn--outline">
          Chercher
        </button>
      </form>
      <Card as="ul" className="!shadow-none">
        {rows.map((r) => (
          <li key={r.id} className="row flex-wrap justify-between">
            <span className="min-w-0">
              <b>{r.name}</b>{" "}
              <span className="t-small muted">
                <code className="mono">{r.id}</code> · {EDITABLE_KIND_LABEL[r.kind as EditableKind]}
              </span>{" "}
              {!r.is_active && <Pill tone="chip">désactivée</Pill>}{" "}
              {r.edited_in_admin_at && <Pill tone="yellow">modifiée ici</Pill>}
            </span>
            {canWrite && (
              <Link
                href={`/admin/recettes/appliquer?recipe=${encodeURIComponent(r.id)}`}
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                Modifier
              </Link>
            )}
          </li>
        ))}
        {!rows.length && <li className="muted">Aucune recette.</li>}
        {rows.length === 100 && (
          <li className="t-small muted">100 premiers résultats : affine la recherche.</li>
        )}
      </Card>
    </>
  );
}
