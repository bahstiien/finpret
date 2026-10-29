import { createSchool } from "@/server/actions/admin";
import { requireAdmin } from "@/server/admin";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

/** Écoles : liste, création, nombre d'associations rattachées. */
export default async function AdminSchoolsPage() {
  const { db } = await requireAdmin();
  const [{ data: schools }, { data: links }] = await Promise.all([
    db.from("schools").select("id, name, city, uai").order("name"),
    db.from("association_schools").select("school_id"),
  ]);
  const count = new Map<string, number>();
  for (const l of links ?? []) count.set(l.school_id, (count.get(l.school_id) ?? 0) + 1);
  async function add(formData: FormData) {
    "use server";
    await createSchool(formData);
  }
  return (
    <>
      <PageHeader title="Écoles" />
      <form action={add} className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 border-[length:var(--bw)] border-line">
        <TextField id="s-name" name="name" label="Nom" required className="min-w-48 flex-1" />
        <TextField id="s-city" name="city" label="Commune" required className="min-w-40 flex-1" />
        <TextField id="s-uai" name="uai" label="UAI (facultatif)" maxLength={8} className="w-40" />
        <Button type="submit">Ajouter</Button>
      </form>
      <Card as="ul" padding="cozy" className="flex flex-col divide-y divide-line">
        {(schools ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap justify-between gap-2 py-3">
            <span>
              <b>{s.name}</b> · {s.city}
              {s.uai ? ` · ${s.uai}` : ""}
            </span>
            <span className="text-sm text-muted">{count.get(s.id) ?? 0} association(s)</span>
          </li>
        ))}
        {!schools?.length && <li className="text-muted">Aucune école.</li>}
      </Card>
    </>
  );
}
