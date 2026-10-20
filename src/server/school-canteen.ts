import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Texte d'un menu d'école : les plats renseignés, dans l'ordre du repas. */
export function menuText(m: {
  starter: string | null;
  main: string | null;
  side: string | null;
  dairy: string | null;
  dessert: string | null;
}): string {
  return [m.starter, m.main, m.side, m.dairy, m.dessert]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(", ");
}

export type SchoolMenuEntry = {
  memberId: string;
  name: string;
  date: string;
  text: string;
  note: string | null;
  edited: boolean;
};

/**
 * Menus publiés des écoles des enfants du foyer, pour les dates demandées et les jours de cantine de chaque enfant
 * (`member_schools.canteen_days`, 1 = lundi). La RLS ne renvoie que les menus publiés des écoles liées au foyer.
 */
export async function schoolMenusFor(
  kids: { id: string; name: string }[],
  dates: string[],
): Promise<SchoolMenuEntry[]> {
  if (!kids.length) return [];
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("member_schools")
    .select("member_id, school_id, canteen_days")
    .in(
      "member_id",
      kids.map((k) => k.id),
    );
  if (!links?.length) return [];
  const { data: menus } = await supabase
    .from("school_menus")
    .select("school_id, date, starter, main, side, dairy, dessert, note, edited_after_publish")
    .eq("status", "published")
    .in("school_id", [...new Set(links.map((l) => l.school_id))])
    .in("date", dates);
  const entries: SchoolMenuEntry[] = [];
  for (const link of links) {
    const kid = kids.find((k) => k.id === link.member_id);
    if (!kid) continue;
    for (const menu of menus ?? []) {
      if (menu.school_id !== link.school_id) continue;
      const day = dates.indexOf(menu.date) + 1;
      if (!link.canteen_days.includes(day)) continue;
      const text = menuText(menu);
      if (!text) continue;
      entries.push({
        memberId: kid.id,
        name: kid.name,
        date: menu.date,
        text,
        note: menu.note,
        edited: menu.edited_after_publish,
      });
    }
  }
  return entries;
}
