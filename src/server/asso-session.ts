import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/session";

export type AssociationRole = "manager" | "menu_editor";

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
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("association_members")
    .select("association_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return null;
  const [{ data: a }, { data: links }] = await Promise.all([
    supabase
      .from("associations")
      .select("id, name, code, status, reject_reason, code_changed, email, manager_name, iban_last4")
      .eq("id", member.association_id)
      .single(),
    supabase.from("association_schools").select("school_id").eq("association_id", member.association_id),
  ]);
  if (!a) return null;
  const ids = (links ?? []).map((l) => l.school_id);
  const { data: schools } = ids.length
    ? await supabase.from("schools").select("id, name, city").in("id", ids).order("name")
    : { data: [] };
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
    schools: schools ?? [],
  };
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
