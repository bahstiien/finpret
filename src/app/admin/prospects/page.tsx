import { ActionForm } from "@/components/ui/ActionForm";
import { formatShort } from "@/lib/dates";
import { markLeadContacted } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { PageHeader } from "@/components/ui/Layout";

/** Demandes de présentation reçues depuis la landing /associations. */
export default async function AdminLeadsPage() {
  const { db } = await requireAdmin();
  const { data } = await db
    .from("association_leads")
    .select("id, name, email, association_name, school, city, families_estimate, created_at, contacted_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <>
      <PageHeader title="Prospects" />
      <ul className="flex flex-col divide-y divide-line rounded-card bg-surface p-5">
        {(data ?? []).map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
            data-testid="lead"
          >
            <span>
              <b>{l.association_name}</b> · {l.name} ·{" "}
              <a className="underline" href={`mailto:${l.email}`}>
                {l.email}
              </a>
              <br />
              <span className="text-sm text-muted">
                {[l.school, l.city].filter(Boolean).join(", ")}
                {l.families_estimate ? ` · ~${l.families_estimate} familles` : ""} · reçue le{" "}
                {formatShort(l.created_at.slice(0, 10))}
              </span>
            </span>
            {l.contacted_at ? (
              <span className="text-sm font-semibold text-green-ink">
                Contacté le {formatShort(l.contacted_at.slice(0, 10))}
              </span>
            ) : (
              <ActionForm action={markLeadContacted} fields={{ id: l.id }} label="Marquer comme contacté" />
            )}
          </li>
        ))}
        {!data?.length && <li className="text-muted">Aucune demande.</li>}
      </ul>
    </>
  );
}
