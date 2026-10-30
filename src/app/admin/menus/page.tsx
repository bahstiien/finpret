import { ActionForm } from "@/components/ui/ActionForm";
import { formatShort } from "@/lib/dates";
import { unpublishMenu } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { menuText } from "@/server/school-canteen";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

/** Menus d'école récents : contrôle et dépublication en cas d'erreur. */
export default async function AdminMenusPage() {
  await requireAdmin();
  const { data, schools } = await withAdmin(async (db) => {
    const data = await db
      .selectFrom("school_menus")
      .select([
        "id",
        "date",
        "starter",
        "main",
        "side",
        "dairy",
        "dessert",
        "status",
        "edited_after_publish",
        "school_id",
        "association_id",
      ])
      .orderBy("date", "desc")
      .limit(100)
      .execute();
    const ids = [...new Set(data.map((m) => m.school_id))];
    const schools = ids.length
      ? await db.selectFrom("schools").select(["id", "name"]).where("id", "in", ids).execute()
      : [];
    return { data, schools };
  });
  const name = new Map(schools.map((s) => [s.id, s.name]));
  return (
    <>
      <PageHeader title="Menus d'école" />
      <Card as="ul" className="!shadow-none">
        {data.map((m) => (
          <li key={m.id} className="row flex-wrap justify-between">
            <span>
              <b className="mono">{formatShort(m.date)}</b> · {name.get(m.school_id) ?? "?"} · {menuText(m)}{" "}
              <span className="t-small muted">
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
        {!data.length && <li className="muted">Aucun menu.</li>}
      </Card>
    </>
  );
}
