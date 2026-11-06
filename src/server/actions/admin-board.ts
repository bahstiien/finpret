"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import {
  CONTACT_STATUSES,
  LEAD_STAGES,
  TASK_CATEGORIES,
  TASK_STATUSES,
  tagSchema,
  taskSchema,
} from "@/lib/admin-board";
import { audit, requireOwner } from "@/server/admin";
import { withAdmin } from "@/server/db";
import type { ActionResult } from "@/server/errors";
import { applyRoadmap, fetchRoadmap, notionAvailable, pushRoadmapStatus } from "@/server/notion";

const id = z.coerce.number().int().positive();
const fail = (error: string = fr.errors.generic): ActionResult => ({ ok: false, error });
const ok = (...paths: string[]): ActionResult => {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin", "layout");
  return { ok: true, data: undefined };
};

// ---------------------------------------------------------------------------
// Demandes de contact
// ---------------------------------------------------------------------------

/** Change l'état d'une demande (nouvelle, en cours, traitée, indésirable). */
export async function setContactStatus(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const msg = id.safeParse(formData.get("id"));
  const status = z.enum(CONTACT_STATUSES).safeParse(formData.get("status"));
  if (!msg.success || !status.success) return fail();
  const open = status.data === "new";
  await withAdmin((db) =>
    db
      .updateTable("contact_messages")
      .set({
        status: status.data,
        handled_by: open ? null : user.id,
        handled_at: open ? null : new Date().toISOString(),
      })
      .where("id", "=", msg.data)
      .execute(),
  );
  await audit(user.id, "contact.status", String(msg.data), { status: status.data });
  return ok("/admin/demandes");
}

/** Note interne sur une demande (ce qui a été répondu, la suite à donner). */
export async function setContactNote(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const msg = id.safeParse(formData.get("id"));
  const note = z
    .string()
    .trim()
    .max(2000)
    .safeParse(formData.get("note") ?? "");
  if (!msg.success || !note.success) return fail("Note trop longue (2000 caractères au plus).");
  await withAdmin((db) =>
    db
      .updateTable("contact_messages")
      .set({ note: note.data || null })
      .where("id", "=", msg.data)
      .execute(),
  );
  await audit(user.id, "contact.note", String(msg.data));
  return ok("/admin/demandes");
}

// ---------------------------------------------------------------------------
// Actions à mener
// ---------------------------------------------------------------------------

export async function createTask(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Donne un titre (160 caractères au plus) et une catégorie.");
  const row = await withAdmin((db) =>
    db
      .insertInto("admin_tasks")
      .values({ ...parsed.data, created_by: user.id })
      .returning("id")
      .executeTakeFirstOrThrow(),
  );
  await audit(user.id, "task.create", String(row.id), { title: parsed.data.title });
  return ok("/admin/actions");
}

export async function updateTask(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const task = id.safeParse(formData.get("id"));
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!task.success || !parsed.success)
    return fail("Donne un titre (160 caractères au plus) et une catégorie.");
  await withAdmin((db) =>
    db.updateTable("admin_tasks").set(parsed.data).where("id", "=", task.data).execute(),
  );
  await audit(user.id, "task.update", String(task.data));
  return ok("/admin/actions");
}

/** Fait avancer une action d'une colonne à l'autre (à faire, en cours, fait). */
export async function setTaskStatus(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const task = id.safeParse(formData.get("id"));
  const status = z.enum(TASK_STATUSES).safeParse(formData.get("status"));
  if (!task.success || !status.success) return fail();
  const row = await withAdmin((db) =>
    db
      .updateTable("admin_tasks")
      .set({ status: status.data, done_at: status.data === "done" ? new Date().toISOString() : null })
      .where("id", "=", task.data)
      .returning("notion_page_id")
      .executeTakeFirst(),
  );
  await audit(user.id, "task.status", String(task.data), { status: status.data });
  // Action importée de la roadmap : le statut repart dans Notion (le déplacement local reste acquis sinon).
  if (row?.notion_page_id && notionAvailable()) {
    try {
      await pushRoadmapStatus(row.notion_page_id, status.data);
    } catch (error) {
      console.error("[notion] statut non renvoyé", error);
      revalidatePath("/admin/actions");
      return fail("Déplacée ici, mais le statut n'a pas pu être renvoyé dans Notion.");
    }
  }
  return ok("/admin/actions");
}

export async function deleteTask(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const task = id.safeParse(formData.get("id"));
  if (!task.success) return fail();
  await withAdmin((db) => db.deleteFrom("admin_tasks").where("id", "=", task.data).execute());
  await audit(user.id, "task.delete", String(task.data));
  return ok("/admin/actions");
}

/** Transforme une demande de contact en action (bug, suggestion…) ; la demande passe « en cours ». */
export async function createTaskFromContact(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const msg = id.safeParse(formData.get("id"));
  const category = z.enum(TASK_CATEGORIES).safeParse(formData.get("category"));
  if (!msg.success || !category.success) return fail();
  const taskId = await withAdmin(async (db) => {
    const c = await db
      .selectFrom("contact_messages")
      .select(["name", "email", "subject", "message", "status"])
      .where("id", "=", msg.data)
      .executeTakeFirst();
    if (!c) return null;
    const row = await db
      .insertInto("admin_tasks")
      .values({
        title: `${c.subject} (${c.name})`.slice(0, 160),
        details: `Demande de ${c.name} <${c.email}> :\n\n${c.message}`.slice(0, 2000),
        category: category.data,
        contact_message_id: msg.data,
        created_by: user.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (c.status === "new")
      await db
        .updateTable("contact_messages")
        .set({ status: "in_progress", handled_by: user.id, handled_at: new Date().toISOString() })
        .where("id", "=", msg.data)
        .execute();
    return row.id;
  });
  if (!taskId) return fail();
  await audit(user.id, "task.from_contact", String(taskId), { contact: msg.data });
  return ok("/admin/demandes", "/admin/actions");
}

/** Importe la roadmap Notion dans la todolist (création, mise à jour, retrait des lignes abandonnées). */
export async function syncNotionRoadmap(): Promise<ActionResult> {
  const { user } = await requireOwner();
  if (!notionAvailable()) return fail("Notion n'est pas configuré (NOTION_TOKEN).");
  let stats;
  try {
    const items = await fetchRoadmap();
    stats = await withAdmin((db) => applyRoadmap(db, items, user.id));
  } catch (error) {
    console.error("[notion] synchronisation impossible", error);
    return fail("Notion ne répond pas ou la base Roadmap n'est pas partagée avec l'intégration.");
  }
  await audit(user.id, "task.notion_sync", null, stats);
  return ok("/admin/actions");
}

// ---------------------------------------------------------------------------
// Prospects associations
// ---------------------------------------------------------------------------

/** Déplace un prospect dans le pipeline ; « contactée » et au-delà renseignent aussi `contacted_at`. */
export async function setLeadStage(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const lead = z.uuid().safeParse(formData.get("id"));
  const stage = z.enum(LEAD_STAGES).safeParse(formData.get("stage"));
  if (!lead.success || !stage.success) return fail();
  const now = new Date().toISOString();
  await withAdmin(async (db) => {
    await db
      .updateTable("association_leads")
      .set({ stage: stage.data, stage_changed_at: now })
      .where("id", "=", lead.data)
      .execute();
    if (stage.data !== "to_contact")
      await db
        .updateTable("association_leads")
        .set({ contacted_at: now })
        .where("id", "=", lead.data)
        .where("contacted_at", "is", null)
        .execute();
  });
  await audit(user.id, "lead.stage", lead.data, { stage: stage.data });
  return ok("/admin/prospects");
}

export async function setLeadNote(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const lead = z.uuid().safeParse(formData.get("id"));
  const note = z
    .string()
    .trim()
    .max(2000)
    .safeParse(formData.get("note") ?? "");
  if (!lead.success || !note.success) return fail("Note trop longue (2000 caractères au plus).");
  await withAdmin((db) =>
    db
      .updateTable("association_leads")
      .set({ note: note.data || null })
      .where("id", "=", lead.data)
      .execute(),
  );
  await audit(user.id, "lead.note", lead.data);
  return ok("/admin/prospects");
}

// ---------------------------------------------------------------------------
// Étiquettes des comptes
// ---------------------------------------------------------------------------

export async function addAccountTag(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const account = z.uuid().safeParse(formData.get("userId"));
  const tag = tagSchema.safeParse(formData.get("tag"));
  if (!account.success || !tag.success) return fail("Une étiquette fait 30 caractères au plus.");
  await withAdmin((db) =>
    db
      .insertInto("account_tags")
      .values({ user_id: account.data, tag: tag.data })
      .onConflict((oc) => oc.doNothing())
      .execute(),
  );
  await audit(user.id, "account.tag", account.data, { tag: tag.data });
  return ok(`/admin/comptes/${account.data}`, "/admin/comptes", "/admin/fiche");
}

export async function removeAccountTag(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const account = z.uuid().safeParse(formData.get("userId"));
  const tag = z.string().max(30).safeParse(formData.get("tag"));
  if (!account.success || !tag.success) return fail();
  await withAdmin((db) =>
    db.deleteFrom("account_tags").where("user_id", "=", account.data).where("tag", "=", tag.data).execute(),
  );
  await audit(user.id, "account.untag", account.data, { tag: tag.data });
  return ok(`/admin/comptes/${account.data}`, "/admin/comptes", "/admin/fiche");
}
