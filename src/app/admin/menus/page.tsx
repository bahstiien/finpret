import { ActionForm } from "@/components/ui/ActionForm";
import { formatShort } from "@/lib/dates";
import { unpublishMenu } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { menuText } from "@/server/school-canteen";

/** Menus d'école récents : contrôle et dépublication en cas d'erreur. */
export default async function AdminMenusPage() {
  const { db } = await requireAdmin();
  const { data } = await db
    .from("school_menus")
    .select(
      "id, date, starter, main, side, dairy, dessert, status, edited_after_publish, school_id, association_id",
    )
    .order("date", { ascending: false })
    .limit(100);
  const ids = [...new Set((data ?? []).map((m) => m.school_id))];
  const { data: schools } = ids.length
    ? await db.from("schools").select("id, name").in("id", ids)
    : { data: [] };
  const name = new Map((schools ?? []).map((s) => [s.id, s.name]));
  return (
    <>
      <h1 className="text-4xl font-black">Menus d&apos;école</h1>
      <ul className="flex flex-col divide-y divide-line rounded-card bg-surface p-5">
        {(data ?? []).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <b>{formatShort(m.date)}</b> · {name.get(m.school_id) ?? "?"} · {menuText(m)}{" "}
              <span className="text-sm text-muted">
                ({m.status === "published" ? "publié" : "brouillon"}
                {m.edited_after_publish ? ", modifié" : ""})
              </span>
            </span>
            {m.status === "published" && (
              <ActionForm
                action={unpublishMenu}
                fields={{ id: m.id }}
                label="Dépublier"
                confirm="Dépublier ce menu ?"
              />
            )}
          </li>
        ))}
        {!data?.length && <li className="text-muted">Aucun menu.</li>}
      </ul>
    </>
  );
}
