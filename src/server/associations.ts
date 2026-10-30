import "server-only";
import { normalizeCode } from "@/lib/association-code";
import { withAdmin } from "@/server/db";
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
  return withAdmin(async (db) => {
    const data = await db
      .selectFrom("associations")
      .select(["id", "name", "code", "status"])
      .where("code", "=", code)
      .executeTakeFirst();
    if (!data) return null;
    const schools = await db
      .selectFrom("association_schools")
      .innerJoin("schools", "schools.id", "association_schools.school_id")
      .select(["schools.id", "schools.name", "schools.city"])
      .where("association_schools.association_id", "=", data.id)
      .execute();
    return { id: data.id, name: data.name, code: data.code, status: data.status, schools };
  });
}

/** Association approuvée d'un code, ou null (un code non validé n'ouvre aucun avantage). */
export async function approvedAssociation(
  rawCode: string | undefined | null,
): Promise<PublicAssociation | null> {
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
export async function attachHousehold(
  householdId: string,
  associationId: string,
  userId?: string,
): Promise<AttachResult> {
  const result = await withAdmin(async (db): Promise<AttachResult> => {
    const household = await db
      .selectFrom("households")
      .select(["association_id", "created_at"])
      .where("id", "=", householdId)
      .executeTakeFirst();
    const sub = await db
      .selectFrom("subscriptions")
      .select(["plan", "status", "trial_ends_at"])
      .where("household_id", "=", householdId)
      .executeTakeFirst();
    if (!household) return { ok: false, reason: "locked" };
    if (household.association_id === associationId) return { ok: true, changed: false };
    const subscribed = !!sub && (sub.plan === "monthly" || sub.plan === "yearly") && PAID.has(sub.status);
    if (household.association_id && subscribed) return { ok: false, reason: "locked" };

    await db
      .updateTable("households")
      .set({ association_id: associationId, association_joined_at: new Date().toISOString() })
      .where("id", "=", householdId)
      .execute();
    if (sub?.plan === "trial") {
      const trialEnd = new Date(Date.parse(household.created_at) + TRIAL_DAYS * 86_400_000).toISOString();
      if (!sub.trial_ends_at || trialEnd > sub.trial_ends_at) {
        await db
          .updateTable("subscriptions")
          .set({ trial_ends_at: trialEnd, updated_at: new Date().toISOString() })
          .where("household_id", "=", householdId)
          .execute();
      }
    }
    return { ok: true, changed: true };
  });
  if (result.ok && result.changed)
    await trackEvent("association_joined", { userId, householdId, props: { association: associationId } });
  return result;
}
