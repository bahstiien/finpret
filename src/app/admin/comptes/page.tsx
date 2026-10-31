import Link from "next/link";
import { formatShort } from "@/lib/dates";
import { requireAdmin } from "@/server/admin";
import { listAccounts, PAGE_SIZE } from "@/server/crm";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const PLANS = [
  ["", "Toutes les offres"],
  ["trial", "Essai"],
  ["monthly", "Mensuel"],
  ["yearly", "Annuel"],
  ["free", "Gratuit"],
  ["none", "Sans foyer"],
] as const;

const PLAN_LABEL: Record<string, string> = { trial: "Essai", monthly: "Mensuel", yearly: "Annuel", free: "Gratuit" };

/** CRM : tous les comptes créés, avec recherche, filtre par offre et pagination. */
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const plan = PLANS.some(([v]) => v === sp.plan) ? (sp.plan ?? "") : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { rows, total } = await listAccounts({ q: q || undefined, plan: plan || undefined, page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (plan) u.set("plan", plan);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/comptes${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Comptes" description={`${total} compte${total > 1 ? "s" : ""}`} />
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="field-label flex flex-col gap-1">
          Recherche
          <input name="q" defaultValue={q} placeholder="e-mail ou nom" maxLength={100} className="input" />
        </label>
        <label className="field-label flex flex-col gap-1">
          Offre
          <select name="plan" defaultValue={plan} className="input">
            {PLANS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn--outline">
          Filtrer
        </button>
        <a
          href={`/admin/comptes/export${q || plan ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(plan ? { plan } : {}) })}` : ""}`}
          className="btn btn--outline"
        >
          Exporter en CSV
        </a>
      </form>
      <Card as="ul" className="!shadow-none">
        {rows.map((a) => (
          <li key={a.id} className="row t-small flex-wrap justify-between gap-2">
            <span>
              <Link href={`/admin/comptes/${a.id}`} className="underline">
                <b>{a.email ?? a.id.slice(0, 8)}</b>
              </Link>
              {a.name ? ` · ${a.name}` : ""}
              {!a.email_verified && " · e-mail non vérifié"}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {a.plan ? <Pill tone={a.plan === "trial" ? "yellow" : "green"}>{PLAN_LABEL[a.plan] ?? a.plan}</Pill> : <Pill>Sans foyer</Pill>}
              <span className="mono muted">
                {a.households} foyer{a.households > 1 ? "s" : ""} · inscrit le {formatShort(a.created_at.slice(0, 10))}
                {a.last_seen ? ` · vu le ${formatShort(a.last_seen.slice(0, 10))}` : ""}
              </span>
            </span>
          </li>
        ))}
        {!rows.length && <li className="muted">Aucun compte.</li>}
      </Card>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-3 t-small">
          {page > 1 && (
            <Link href={href(page - 1)} className="btn btn--outline btn--sm">
              Précédent
            </Link>
          )}
          <span className="mono muted">
            Page {page} / {pages}
          </span>
          {page < pages && (
            <Link href={href(page + 1)} className="btn btn--outline btn--sm">
              Suivant
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
