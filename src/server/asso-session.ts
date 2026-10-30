import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withUser } from "@/server/db";
import type { AssociationRole } from "@/server/db.types";
import { requireUser } from "@/server/session";

export type { AssociationRole };

export type MyAssociation = {
  id: string;
  name: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejectReason: string | null;
  codeChanged: boolean;
  email: string;
  managerName: string;
  ibanLast4: string | null;
  role: AssociationRole;
  schools: { id: string; name: string; city: string }[];
};

/** Association du compte (la première s'il y en a plusieurs), lue sous la RLS. `null` : aucune. */
export const getMyAssociation = cache(async (): Promise<MyAssociation | null> => {
  const user = await requireUser("/asso");
  return withUser(user.id, async (db) => {
    const member = await db
      .selectFrom("association_members")
      .select(["association_id", "role"])
      .where("user_id", "=", user.id)
      .limit(1)
      .executeTakeFirst();
    if (!member) return null;
    const a = await db
      .selectFrom("associations")
      .select([
        "id",
        "name",
        "code",
        "status",
        "reject_reason",
        "code_changed",
        "email",
        "manager_name",
        "iban_last4",
      ])
      .where("id", "=", member.association_id)
      .executeTakeFirst();
    if (!a) return null;
    const links = await db
      .selectFrom("association_schools")
      .select("school_id")
      .where("association_id", "=", member.association_id)
      .execute();
    const ids = links.map((l) => l.school_id);
    const schools = ids.length
      ? await db
          .selectFrom("schools")
          .select(["id", "name", "city"])
          .where("id", "in", ids)
          .orderBy("name")
          .execute()
      : [];
    return {
      id: a.id,
      name: a.name,
      code: a.code,
      status: a.status,
      rejectReason: a.reject_reason,
      codeChanged: a.code_changed,
      email: a.email,
      managerName: a.manager_name,
      ibanLast4: a.iban_last4,
      role: member.role,
      schools,
    };
  });
});

/** Page de l'espace association : sans association, direction l'inscription. */
export async function requireAssociation(): Promise<MyAssociation> {
  const association = await getMyAssociation();
  if (!association) redirect("/asso/inscription");
  return association;
}

/** Réservé au responsable (chiffres, équipe, relevés). */
export async function requireManager(): Promise<MyAssociation> {
  const association = await requireAssociation();
  if (association.role !== "manager") redirect("/asso/menus");
  return association;
}
