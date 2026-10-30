import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

/** Journal des actions du back-office (200 dernières). */
export default async function AdminAuditPage() {
  await requireAdmin();
  const data = await withAdmin((db) =>
    db
      .selectFrom("admin_audit")
      .select(["id", "admin_id", "action", "target", "props", "created_at"])
      .orderBy("id", "desc")
      .limit(200)
      .execute(),
  );
  return (
    <>
      <PageHeader title="Journal" />
      <Card as="ul" className="t-small !shadow-none">
        {data.map((a) => (
          <li key={a.id} className="row">
            <b>{a.action}</b> · {a.target ?? "—"} ·{" "}
            <span className="mono muted">
              {new Date(a.created_at).toLocaleString("fr-FR")} · {a.admin_id?.slice(0, 8)}
            </span>
          </li>
        ))}
        {!data.length && <li className="muted">Aucune action.</li>}
      </Card>
    </>
  );
}
