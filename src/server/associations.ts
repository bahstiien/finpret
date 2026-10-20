import "server-only";
import { normalizeCode } from "@/lib/association-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackEvent } from "@/server/events";

export type PublicAssociation = {
  id: string;
  name: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  schools: { id: string; name: string; city: string }[];
};

/** Association d'un code (page publique) : nom et écoles seulement, jamais de contact ni de membre. */
export async function associationByCode(rawCode: string): Promise<PublicAssociation | null> {
  const code = normalizeCode(rawCode);
  if (code.length < 4) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("associations")
    .select("id, name, code, status, association_schools(schools(id, name, city))")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  const links = data.association_schools as unknown as { schools: { id: string; name: string; city: string } | null }[];
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    status: data.status,
    schools: links.flatMap((l) => (l.schools ? [l.schools] : [])),
  };
}

/** Association approuvée d'un code, ou null (un code non validé n'ouvre aucun avantage). */
export async function approvedAssociation(rawCode: string | undefined | null): Promise<PublicAssociation | null> {
  if (!rawCode) return null;
  const association = await associationByCode(rawCode);
  return association?.status === "approved" ? association : null;
}

const TRIAL_DAYS = 30;
const PAID = new Set(["active", "trialing", "past_due"]);

export type AttachResult = { ok: true; changed: boolean } | { ok: false; reason: "locked" };

/**
 * Rattache un foyer à une association approuvée (D11) : définitif tant que le foyer est abonné ; s'il a résilié, le
 * nouveau code s'applique. L'essai passe à 30 jours depuis l'inscription du foyer. Écriture avec la clé de service
 * (un compte ne peut pas modifier son rattachement lui-même).
 */
export async function attachHousehold(householdId: string, associationId: string, userId?: string): Promise<AttachResult> {
  const db = createAdminClient();
  const [{ data: household }, { data: sub }] = await Promise.all([
    db.from("households").select("association_id, created_at").eq("id", householdId).single(),
    db.from("subscriptions").select("plan, status, trial_ends_at").eq("household_id", householdId).maybeSingle(),
  ]);
  if (!household) return { ok: false, reason: "locked" };
  if (household.association_id === associationId) return { ok: true, changed: false };
  const subscribed = !!sub && (sub.plan === "monthly" || sub.plan === "yearly") && PAID.has(sub.status);
  if (household.association_id && subscribed) return { ok: false, reason: "locked" };

  await db
    .from("households")
    .update({ association_id: associationId, association_joined_at: new Date().toISOString() })
    .eq("id", householdId);
  if (sub?.plan === "trial") {
    const trialEnd = new Date(Date.parse(household.created_at) + TRIAL_DAYS * 86_400_000).toISOString();
    if (!sub.trial_ends_at || trialEnd > sub.trial_ends_at) {
      await db
        .from("subscriptions")
        .update({ trial_ends_at: trialEnd, updated_at: new Date().toISOString() })
        .eq("household_id", householdId);
    }
  }
  await trackEvent("association_joined", { userId, householdId, props: { association: associationId } });
  return { ok: true, changed: true };
}
