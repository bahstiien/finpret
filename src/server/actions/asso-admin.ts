"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codeFromName, isValidCode, normalizeCode } from "@/lib/association-code";
import { fr } from "@/i18n/fr";
import { audit, requireOwner } from "@/server/admin";
import { attachHousehold } from "@/server/associations";
import { auth } from "@/server/auth";
import { withAdmin } from "@/server/db";
import { sendAssociationApproved } from "@/server/emails";
import type { ActionResult } from "@/server/errors";
import { findUserByEmail } from "@/server/users";

const uuid = z.uuid();
const fail = (error: string = fr.errors.generic): ActionResult => ({ ok: false, error });
const ok = (path: string): ActionResult => {
  revalidatePath(path);
  return { ok: true, data: undefined };
};

const email = z.email().max(254);
const euros = z
  .union([z.literal(""), z.coerce.number().min(0).max(100)])
  .transform((v) => (v === "" ? null : Math.round(v * 100)));

/** Compte retrouvé par e-mail, ou créé (sans mot de passe : la personne se connecte par lien magique). */
async function ensureUser(address: string, name: string): Promise<string> {
  const existing = await findUserByEmail(address);
  if (existing) return existing.id;
  const row = await withAdmin((db) =>
    db
      .insertInto("auth.users")
      .values({ email: address.toLowerCase(), name, email_verified: false })
      .returning("id")
      .executeTakeFirstOrThrow(),
  );
  return row.id;
}

/** Envoie un lien de connexion (échec silencieux : l'administrateur peut le renvoyer depuis la fiche du compte). */
async function sendLogin(address: string): Promise<boolean> {
  try {
    await auth().api.signInMagicLink({ body: { email: address }, headers: await headers() });
    return true;
  } catch {
    return false;
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rna: z.string().trim().min(9).max(14),
  managerName: z.string().trim().min(1).max(80),
  managerEmail: email,
  code: z.string().trim().max(30),
  schoolName: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
  uai: z.string().trim().max(20),
  yearly: euros,
  monthly: euros,
});

/**
 * Création d'une association par un administrateur : association validée d'emblée, école (réutilisée si elle existe),
 * compte du responsable (créé si besoin) qui devient administrateur de l'association et de son école, rétribution
 * propre. Le responsable reçoit l'e-mail de validation avec le code et un lien de connexion.
 */
export async function createAssociationAsAdmin(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Formulaire incomplet ou invalide (e-mail, numéro RNA/SIREN, montants).");
  const p = parsed.data;
  const code = p.code ? normalizeCode(p.code) : codeFromName(p.name);
  if (!isValidCode(code)) return fail("Code invalide : 4 à 20 caractères, lettres, chiffres et tirets.");
  const taken = await withAdmin((db) =>
    db.selectFrom("associations").select("id").where("code", "=", code).executeTakeFirst(),
  );
  if (taken) return fail(`Le code ${code} existe déjà.`);

  let associationId: string;
  try {
    const managerId = await ensureUser(p.managerEmail, p.managerName);
    associationId = await withAdmin(async (db) => {
      const a = await db
        .insertInto("associations")
        .values({
          name: p.name,
          rna_or_siren: p.rna,
          email: p.managerEmail,
          manager_name: p.managerName,
          code,
          status: "approved",
          approved_at: new Date().toISOString(),
          created_by: user.id,
          retribution_yearly_cents: p.yearly,
          retribution_monthly_cents: p.monthly,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db
        .insertInto("association_members")
        .values({ association_id: a.id, user_id: managerId, role: "manager" })
        .execute();
      const uai = p.uai || null;
      let school = uai
        ? await db.selectFrom("schools").select("id").where("uai", "=", uai).executeTakeFirst()
        : undefined;
      school ??= await db
        .selectFrom("schools")
        .select("id")
        .where((eb) => eb(eb.fn("lower", ["name"]), "=", p.schoolName.toLowerCase()))
        .where((eb) => eb(eb.fn("lower", ["city"]), "=", p.city.toLowerCase()))
        .executeTakeFirst();
      school ??= await db
        .insertInto("schools")
        .values({ name: p.schoolName, city: p.city, uai })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db
        .insertInto("association_schools")
        .values({ association_id: a.id, school_id: school.id })
        .onConflict((oc) => oc.doNothing())
        .execute();
      return a.id;
    });
  } catch (error) {
    console.error("Création d'association :", error instanceof Error ? error.message : error);
    return fail("Création impossible (adresse ou numéro déjà utilisés ?).");
  }
  await audit(user.id, "association.create", associationId, { code, manager: p.managerEmail });
  await sendAssociationApproved(p.managerEmail, p.name, code).catch(() => null);
  await sendLogin(p.managerEmail);
  return ok("/admin/associations");
}

const updateSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  email,
  managerName: z.string().trim().min(1).max(80),
  rna: z.string().trim().min(9).max(14),
  yearly: euros,
  monthly: euros,
});

/** Profil et rétribution : la nouvelle rétribution ne s'applique qu'aux factures payées après la modification. */
export async function updateAssociationAsAdmin(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Champs invalides (e-mail, numéro RNA/SIREN, montants entre 0 et 100 €).");
  const p = parsed.data;
  try {
    await withAdmin((db) =>
      db
        .updateTable("associations")
        .set({
          name: p.name,
          email: p.email,
          manager_name: p.managerName,
          rna_or_siren: p.rna,
          retribution_yearly_cents: p.yearly,
          retribution_monthly_cents: p.monthly,
        })
        .where("id", "=", p.id)
        .execute(),
    );
  } catch {
    return fail();
  }
  await audit(user.id, "association.update", p.id, { yearly: p.yearly, monthly: p.monthly });
  return ok(`/admin/associations/${p.id}`);
}

/** Change le code (l'administrateur n'est pas limité à une modification) ; l'ancien code cesse de fonctionner. */
export async function changeAssociationCode(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail();
  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!isValidCode(code)) return fail("Code invalide : 4 à 20 caractères, lettres, chiffres et tirets.");
  const taken = await withAdmin((db) =>
    db.selectFrom("associations").select("id").where("code", "=", code).where("id", "!=", id.data).executeTakeFirst(),
  );
  if (taken) return fail(`Le code ${code} existe déjà.`);
  await withAdmin((db) =>
    db.updateTable("associations").set({ code, code_changed: true }).where("id", "=", id.data).execute(),
  );
  await audit(user.id, "association.code", id.data, { code });
  return ok(`/admin/associations/${id.data}`);
}

const schoolSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
  uai: z.string().trim().max(20),
});

export async function addAssociationSchool(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Nom et ville de l'école obligatoires.");
  const p = parsed.data;
  const uai = p.uai || null;
  try {
    await withAdmin(async (db) => {
      let school = uai
        ? await db.selectFrom("schools").select("id").where("uai", "=", uai).executeTakeFirst()
        : undefined;
      school ??= await db
        .selectFrom("schools")
        .select("id")
        .where((eb) => eb(eb.fn("lower", ["name"]), "=", p.name.toLowerCase()))
        .where((eb) => eb(eb.fn("lower", ["city"]), "=", p.city.toLowerCase()))
        .executeTakeFirst();
      school ??= await db
        .insertInto("schools")
        .values({ name: p.name, city: p.city, uai })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db
        .insertInto("association_schools")
        .values({ association_id: p.id, school_id: school.id })
        .onConflict((oc) => oc.doNothing())
        .execute();
    });
  } catch {
    return fail();
  }
  await audit(user.id, "association.school_add", p.id, { school: p.name });
  return ok(`/admin/associations/${p.id}`);
}

export async function removeAssociationSchool(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const schoolId = uuid.safeParse(formData.get("schoolId"));
  if (!id.success || !schoolId.success) return fail();
  const count = await withAdmin((db) =>
    db.selectFrom("association_schools").select("school_id").where("association_id", "=", id.data).execute(),
  );
  if (count.length <= 1) return fail("Une association garde au moins une école.");
  await withAdmin((db) =>
    db
      .deleteFrom("association_schools")
      .where("association_id", "=", id.data)
      .where("school_id", "=", schoolId.data)
      .execute(),
  );
  await audit(user.id, "association.school_remove", id.data, { school: schoolId.data });
  return ok(`/admin/associations/${id.data}`);
}

/** Ajoute un responsable (administrateur de l'école) ou un éditeur de menus ; le compte est créé au besoin. */
export async function addAssociationMember(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const address = email.safeParse(String(formData.get("email") ?? "").trim());
  const role = z.enum(["manager", "menu_editor"]).safeParse(formData.get("role"));
  if (!id.success || !address.success || !role.success) return fail("Adresse e-mail ou rôle invalide.");
  try {
    if (role.data === "menu_editor") {
      const editors = await withAdmin((db) =>
        db
          .selectFrom("association_members")
          .select("user_id")
          .where("association_id", "=", id.data)
          .where("role", "=", "menu_editor")
          .execute(),
      );
      if (editors.length >= 3) return fail(fr.errors.too_many_editors);
    }
    const userId = await ensureUser(address.data, address.data.split("@")[0] ?? "");
    await withAdmin((db) =>
      db
        .insertInto("association_members")
        .values({ association_id: id.data, user_id: userId, role: role.data })
        .onConflict((oc) => oc.columns(["association_id", "user_id"]).doUpdateSet({ role: role.data }))
        .execute(),
    );
  } catch {
    return fail();
  }
  await sendLogin(address.data);
  await audit(user.id, "association.member_add", id.data, { email: address.data, role: role.data });
  return ok(`/admin/associations/${id.data}`);
}

export async function removeAssociationMember(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const userId = uuid.safeParse(formData.get("userId"));
  if (!id.success || !userId.success) return fail();
  const members = await withAdmin((db) =>
    db.selectFrom("association_members").select(["user_id", "role"]).where("association_id", "=", id.data).execute(),
  );
  const target = members.find((m) => m.user_id === userId.data);
  if (target?.role === "manager" && members.filter((m) => m.role === "manager").length <= 1)
    return fail("L'association doit garder un responsable.");
  await withAdmin((db) =>
    db
      .deleteFrom("association_members")
      .where("association_id", "=", id.data)
      .where("user_id", "=", userId.data)
      .execute(),
  );
  await audit(user.id, "association.member_remove", id.data, { user: userId.data });
  return ok(`/admin/associations/${id.data}`);
}

/** Rattache à l'association le foyer d'un compte client (foyer actif, sinon celui dont il est administrateur). */
export async function attachMemberHousehold(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const address = email.safeParse(String(formData.get("email") ?? "").trim());
  if (!id.success || !address.success) return fail("Adresse e-mail invalide.");
  const target = await findUserByEmail(address.data);
  if (!target) return fail("Aucun compte avec cette adresse.");
  const household = await withAdmin(async (db) => {
    const profile = await db
      .selectFrom("profiles")
      .select("active_household")
      .where("user_id", "=", target.id)
      .executeTakeFirst();
    if (profile?.active_household) return profile.active_household;
    const m = await db
      .selectFrom("memberships")
      .select("household_id")
      .where("user_id", "=", target.id)
      .where("role", "=", "admin")
      .orderBy("created_at")
      .executeTakeFirst();
    return m?.household_id ?? null;
  });
  if (!household) return fail("Ce compte n'a pas encore de foyer.");
  const res = await attachHousehold(household, id.data, target.id);
  if (!res.ok) return fail("Ce foyer est abonné via une autre association : il ne peut pas en changer.");
  await audit(user.id, "association.household_attach", id.data, { household });
  return ok(`/admin/associations/${id.data}`);
}

/** Détache un foyer : il perd les avantages du code ; les reversements déjà comptés restent acquis. */
export async function detachHousehold(formData: FormData): Promise<ActionResult> {
  const { user } = await requireOwner();
  const id = uuid.safeParse(formData.get("id"));
  const householdId = uuid.safeParse(formData.get("householdId"));
  if (!id.success || !householdId.success) return fail();
  await withAdmin((db) =>
    db
      .updateTable("households")
      .set({ association_id: null, association_joined_at: null })
      .where("id", "=", householdId.data)
      .where("association_id", "=", id.data)
      .execute(),
  );
  await audit(user.id, "association.household_detach", id.data, { household: householdId.data });
  return ok(`/admin/associations/${id.data}`);
}
