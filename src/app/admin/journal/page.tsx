import Link from "next/link";
import { requireAdmin } from "@/server/admin";
import { withAdmin } from "@/server/db";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

const PAGE = 100;

/** Journal des actions du back-office : administrateur nommé, filtre par action, recherche sur la cible, pagination. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const action = (sp.action ?? "").trim().slice(0, 60);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { rows, actions, hasMore } = await withAdmin(async (db) => {
    let query = db
      .selectFrom("admin_audit as a")
      .leftJoin("auth.users as u", "u.id", "a.admin_id")
      .select(["a.id", "a.action", "a.target", "a.props", "a.created_at", "u.email as admin_email"]);
    if (action) query = query.where("a.action", "=", action);
    if (q) query = query.where("a.target", "ilike", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const rows = await query
      .orderBy("a.id", "desc")
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE)
      .execute();
    const actions = await db.selectFrom("admin_audit").select("action").distinct().orderBy("action").execute();
    return { rows: rows.slice(0, PAGE), actions: actions.map((a) => a.action), hasMore: rows.length > PAGE };
  });
  const href = (p: number) => {
    const u = new URLSearchParams();
    if (action) u.set("action", action);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    return `/admin/journal${u.size ? `?${u}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Journal" />
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="field-label flex flex-col gap-1">
          Action
          <select name="action" defaultValue={action} className="input">
            <option value="">Toutes</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label flex flex-col gap-1">
          Cible
          <input name="q" defaultValue={q} maxLength={100} className="input" />
        </label>
        <button type="submit" className="btn btn--outline">
          Filtrer
        </button>
      </form>
      <Card as="ul" className="t-small !shadow-none">
        {rows.map((a) => (
          <li key={a.id} className="row flex-wrap gap-x-2">
            <b>{a.action}</b> · {a.target ?? "—"} ·{" "}
            <span className="mono muted">
              {new Date(a.created_at).toLocaleString("fr-FR")} · {a.admin_email ?? "admin supprimé"}
            </span>
          </li>
        ))}
        {!rows.length && <li className="muted">Aucune action.</li>}
      </Card>
      {(page > 1 || hasMore) && (
        <nav aria-label="Pagination" className="flex items-center gap-3 t-small">
          {page > 1 && (
            <Link href={href(page - 1)} className="btn btn--outline btn--sm">
              Plus récentes
            </Link>
          )}
          <span className="mono muted">Page {page}</span>
          {hasMore && (
            <Link href={href(page + 1)} className="btn btn--outline btn--sm">
              Plus anciennes
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
