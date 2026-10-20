import { requireAdmin } from "@/server/admin";

/** Journal des actions du back-office (200 dernières). */
export default async function AdminAuditPage() {
  const { db } = await requireAdmin();
  const { data } = await db
    .from("admin_audit")
    .select("id, admin_id, action, target, props, created_at")
    .order("id", { ascending: false })
    .limit(200);
  return (
    <>
      <h1 className="text-4xl font-black">Journal</h1>
      <ul className="flex flex-col divide-y divide-line rounded-card bg-surface p-5 text-sm">
        {(data ?? []).map((a) => (
          <li key={a.id} className="py-2">
            <b>{a.action}</b> · {a.target ?? "—"} ·{" "}
            <span className="text-muted">
              {new Date(a.created_at).toLocaleString("fr-FR")} · {a.admin_id?.slice(0, 8)}
            </span>
          </li>
        ))}
        {!data?.length && <li className="text-muted">Aucune action.</li>}
      </ul>
    </>
  );
}
