"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { todayIn } from "@/lib/dates";
import type { ActionResult } from "@/server/errors";
import { MAX_PDF_BYTES, menusFromText, pdfText } from "@/server/canteen-import";
import { fetchPublic } from "@/server/recipe-fetch";
import { requireHousehold, withSession } from "@/server/session";

/** Menus de la cantine (§13) : saisie, import d'un PDF ou d'un lien, validation. */

const t = fr.settings.canteen;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function editor() {
  const { household } = await requireHousehold("/settings/canteen");
  return household.role === "viewer" ? null : household;
}

/** L'enfant appartient bien au foyer actif (la RLS le garantit aussi). */
async function childOf(householdId: string, memberId: string) {
  const data = await withSession((db) =>
    db
      .selectFrom("members")
      .select(["id", "name"])
      .where("id", "=", memberId)
      .where("household_id", "=", householdId)
      .where("kind", "=", "child")
      .executeTakeFirst(),
  );
  return data ?? null;
}

function done(message: string) {
  revalidatePath("/settings/canteen");
  revalidatePath("/app");
  return { ok: true as const, data: { message } };
}

/** Saisie d'un jour : texte vide = menu supprimé. Une saisie à la main est validée d'office. */
export async function saveCanteenDay(
  memberId: string,
  date: string,
  text: string,
): Promise<ActionResult<{ message: string }>> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  const parsed = z
    .object({ memberId: z.uuid(), date: isoDate, text: z.string().trim().max(300) })
    .safeParse({ memberId, date, text });
  if (!parsed.success || !(await childOf(household.id, parsed.data.memberId)))
    return { ok: false, error: fr.errors.generic };
  try {
    await withSession<unknown>((db) =>
      parsed.data.text
        ? db
            .insertInto("canteen_menus")
            .values({
              member_id: parsed.data.memberId,
              date: parsed.data.date,
              text: parsed.data.text,
              source: "manual",
              validated: true,
            })
            .onConflict((oc) =>
              oc
                .columns(["member_id", "date"])
                .doUpdateSet({ text: parsed.data.text, source: "manual", validated: true }),
            )
            .execute()
        : db
            .deleteFrom("canteen_menus")
            .where("member_id", "=", parsed.data.memberId)
            .where("date", "=", parsed.data.date)
            .execute(),
    );
  } catch {
    return { ok: false, error: fr.errors.generic };
  }
  return done(t.saved);
}

/** Enregistre des menus importés, en attente de validation (ils remplacent ceux non validés des mêmes jours). */
async function storePending(
  memberId: string,
  source: "pdf" | "url",
  menus: { date: string; text: string }[],
) {
  try {
    return await withSession(async (db) => {
      const existing = await db
        .selectFrom("canteen_menus")
        .select(["date", "validated"])
        .where("member_id", "=", memberId)
        .where(
          "date",
          "in",
          menus.map((m) => m.date),
        )
        .execute();
      const validated = new Set(existing.filter((e) => e.validated).map((e) => e.date));
      // Un menu déjà validé n'est pas écrasé par un import.
      const rows = menus
        .filter((m) => !validated.has(m.date))
        .map((m) => ({
          member_id: memberId,
          date: m.date,
          text: m.text.slice(0, 300),
          source,
          validated: false,
        }));
      if (!rows.length) return 0;
      await db
        .insertInto("canteen_menus")
        .values(rows)
        .onConflict((oc) =>
          oc.columns(["member_id", "date"]).doUpdateSet((eb) => ({
            text: eb.ref("excluded.text"),
            source: eb.ref("excluded.source"),
            validated: eb.ref("excluded.validated"),
          })),
        )
        .execute();
      return rows.length;
    });
  } catch {
    return -1;
  }
}

export async function importCanteenPdf(formData: FormData): Promise<ActionResult<{ message: string }>> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  const memberId = String(formData.get("memberId") ?? "");
  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    !z.uuid().safeParse(memberId).success ||
    !(await childOf(household.id, memberId))
  ) {
    return { ok: false, error: fr.errors.generic };
  }
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: t.tooBig };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!Buffer.from(bytes.subarray(0, 5)).toString("latin1").startsWith("%PDF"))
    return { ok: false, error: t.notPdf };
  return importText(household, memberId, "pdf", await pdfText(bytes));
}

export async function importCanteenUrl(
  memberId: string,
  url: string,
): Promise<ActionResult<{ message: string }>> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  if (!z.uuid().safeParse(memberId).success || !(await childOf(household.id, memberId)))
    return { ok: false, error: fr.errors.generic };
  const res = await fetchPublic(url, "pdf");
  if (!res.ok)
    return { ok: false, error: res.error === "blocked" ? fr.recipeImport.errors.blocked : t.unreachable };
  return importText(household, memberId, "url", await pdfText(new Uint8Array(res.bytes)));
}

async function importText(
  household: { id: string },
  memberId: string,
  source: "pdf" | "url",
  text: string | null,
): Promise<ActionResult<{ message: string }>> {
  if (!text?.trim()) return { ok: false, error: t.noText };
  const h = await withSession((db) =>
    db.selectFrom("households").select("timezone").where("id", "=", household.id).executeTakeFirst(),
  );
  const menus = await menusFromText(text, todayIn(h?.timezone ?? "Europe/Paris"));
  if (!menus.length) return { ok: false, error: t.noDates };
  const stored = await storePending(memberId, source, menus);
  if (stored < 0) return { ok: false, error: fr.errors.generic };
  return done(t.imported(stored));
}

const validationSchema = z.object({
  memberId: z.uuid(),
  menus: z.array(z.object({ date: isoDate, text: z.string().trim().max(300), keep: z.boolean() })).max(60),
});

/** Écran de validation : les menus gardés deviennent visibles dans le programme du jour, les autres sont retirés. */
export async function validateCanteenMenus(input: unknown): Promise<ActionResult<{ message: string }>> {
  const household = await editor();
  if (!household) return { ok: false, error: fr.errors.forbidden };
  const parsed = validationSchema.safeParse(input);
  if (!parsed.success || !(await childOf(household.id, parsed.data.memberId)))
    return { ok: false, error: fr.errors.generic };
  const keep = parsed.data.menus.filter((m) => m.keep && m.text);
  const drop = parsed.data.menus.filter((m) => !m.keep || !m.text).map((m) => m.date);
  if (keep.length) {
    try {
      await withSession((db) =>
        db
          .insertInto("canteen_menus")
          .values(
            keep.map((m) => ({
              member_id: parsed.data.memberId,
              date: m.date,
              text: m.text,
              validated: true,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["member_id", "date"]).doUpdateSet((eb) => ({
              text: eb.ref("excluded.text"),
              validated: eb.ref("excluded.validated"),
            })),
          )
          .execute(),
      );
    } catch {
      return { ok: false, error: fr.errors.generic };
    }
  }
  if (drop.length) {
    await withSession((db) =>
      db
        .deleteFrom("canteen_menus")
        .where("member_id", "=", parsed.data.memberId)
        .where("validated", "=", false)
        .where("date", "in", drop)
        .execute(),
    );
  }
  return done(t.validated(keep.length));
}
