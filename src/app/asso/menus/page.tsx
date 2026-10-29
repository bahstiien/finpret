import type { Metadata } from "next";
import Link from "next/link";
import { MenusEditor, type MenuRow } from "@/components/asso/MenusEditor";
import { StatusBanner } from "@/components/asso/StatusBanner";
import { fr } from "@/i18n/fr";
import { addDays, formatLong, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { importsThisMonth, MAX_IMPORTS_PER_MONTH } from "@/server/asso-quota";
import { requireAssociation } from "@/server/asso-session";
import { PageHeader } from "@/components/ui/Layout";

const t = fr.asso.menus;

export const metadata: Metadata = { title: t.title };

/** Calendrier des menus de cantine : import, saisie, validation et publication. */
export default async function AssoMenusPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const association = await requireAssociation();
  const params = await searchParams;
  const school = association.schools.find((s) => s.id === params.school) ?? association.schools[0];
  let rows: MenuRow[] = [];
  if (school) {
    const today = todayIn("Europe/Paris");
    const supabase = await createClient();
    const { data } = await supabase
      .from("school_menus")
      .select("date, starter, main, side, dairy, dessert, note, status, edited_after_publish, association_id")
      .eq("school_id", school.id)
      .gte("date", addDays(today, -14))
      .order("date");
    rows = (data ?? []).map((m) => ({
      date: m.date,
      starter: m.starter,
      main: m.main,
      side: m.side,
      dairy: m.dairy,
      dessert: m.dessert,
      note: m.note,
      status: m.status,
      edited: m.edited_after_publish,
      readOnly: m.association_id !== association.id,
      label: formatLong(m.date),
    }));
  }
  const used = await importsThisMonth(association.id);
  return (
    <>
      <PageHeader title={t.title} />
      <p className="muted">{t.lead}</p>
      <StatusBanner association={association} />
      {association.schools.length > 1 && (
        <nav aria-label={t.school} className="flex flex-wrap gap-2">
          {association.schools.map((s) => (
            <Link
              key={s.id}
              href={`/asso/menus?school=${s.id}`}
              aria-current={s.id === school?.id ? "page" : undefined}
              className={`btn btn--sm ${s.id === school?.id ? "btn--dark" : "btn--outline"}`}
            >
              {s.name}
            </Link>
          ))}
        </nav>
      )}
      {school && (
        <>
          <h2 className="t-2">
            {school.name} ({school.city})
          </h2>
          <MenusEditor
            key={school.id}
            schoolId={school.id}
            rows={rows}
            importsUsed={used}
            importsMax={MAX_IMPORTS_PER_MONTH}
            active={association.status === "approved"}
          />
        </>
      )}
    </>
  );
}
