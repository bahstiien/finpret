"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fr } from "@/i18n/fr";
import { FEATURES } from "@/lib/features";
import { rpc } from "@/server/db";
import { can } from "@/server/entitlements";
import { sendHouseholdInvitation } from "@/server/emails";
import { loadOffer } from "@/server/entitlements-load";
import { type ActionResult, toUserMessage } from "@/server/errors";
import { ACTIVE_HOUSEHOLD_COOKIE, getHouseholds, requireUser, withSession } from "@/server/session";

const ONE_YEAR = 60 * 60 * 24 * 365;
const uuid = z.uuid();
const role = z.enum(["admin", "member", "viewer"]).refine((r) => FEATURES.viewerRole || r !== "viewer");

async function rememberOnDevice(householdId: string) {
  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  await requireUser(`/join/${token}`);
  const parsed = z
    .string()
    .regex(/^[0-9a-f]{48}$/)
    .safeParse(token);
  if (!parsed.success) return { ok: false, error: fr.errors.invitation_not_found };

  let householdId: string;
  try {
    householdId = await withSession((db) => rpc<string>(db, "accept_invitation", { p_token: parsed.data }));
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  await rememberOnDevice(householdId);
  redirect("/app");
}

export async function switchHousehold(formData: FormData) {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("householdId"));
  if (!id.success) return;
  const households = await getHouseholds();
  if (!households.some((h) => h.id === id.data)) return;
  await rememberOnDevice(id.data);
  await withSession((db) =>
    db.updateTable("profiles").set({ active_household: id.data }).where("user_id", "=", user.id).execute(),
  );
  revalidatePath("/", "layout");
}

const inviteSchema = z.object({
  householdId: uuid,
  role,
  email: z.union([z.literal(""), z.email().max(254)]).transform((v) => v || null),
});

export type InviteState = { error?: string; token?: string };

export async function createInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireUser("/settings/household");
  const parsed = inviteSchema.safeParse({
    householdId: formData.get("householdId"),
    role: formData.get("role"),
    email: String(formData.get("email") ?? "").trim(),
  });
  if (!parsed.success) return { error: fr.errors.generic };

  const { householdId } = parsed.data;
  let token: string;
  let householdName: string | undefined;
  try {
    // Comptes du foyer : 2 en gratuit, 8 en essai ou abonné (les invitations en attente comptent).
    const used = await withSession(async (db) => {
      const [members, pending] = await Promise.all([
        db
          .selectFrom("memberships")
          .select((eb) => eb.fn.countAll<number>().as("n"))
          .where("household_id", "=", householdId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("invitations")
          .select((eb) => eb.fn.countAll<number>().as("n"))
          .where("household_id", "=", householdId)
          .where("accepted_at", "is", null)
          .where("expires_at", ">", new Date().toISOString())
          .executeTakeFirstOrThrow(),
      ]);
      return Number(members.n) + Number(pending.n);
    });
    if (!can(await loadOffer(householdId), "household.members", { used })) {
      return { error: fr.errors.members_limit };
    }
    ({ token, householdName } = await withSession(async (db) => {
      const row = await db
        .insertInto("invitations")
        .values({ household_id: householdId, role: parsed.data.role, email: parsed.data.email })
        .returning("token")
        .executeTakeFirstOrThrow();
      const h = parsed.data.email
        ? await db.selectFrom("households").select("name").where("id", "=", householdId).executeTakeFirst()
        : undefined;
      return { token: row.token, householdName: h?.name };
    }));
  } catch (e) {
    return { error: toUserMessage(e) };
  }
  if (parsed.data.email) {
    await sendHouseholdInvitation(parsed.data.email, householdName ?? "ton foyer", token).catch(() => null);
  }
  revalidatePath("/settings/household");
  return { token };
}

export async function revokeInvitation(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const id = uuid.safeParse(formData.get("invitationId"));
  if (!id.success) return { ok: false, error: fr.errors.generic };
  try {
    await withSession((db) => db.deleteFrom("invitations").where("id", "=", id.data).execute());
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/settings/household");
  return { ok: true, data: undefined };
}

const memberSchema = z.object({ householdId: uuid, userId: uuid });

export async function changeRole(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const parsed = memberSchema.extend({ role }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  try {
    const updated = await withSession((db) =>
      db
        .updateTable("memberships")
        .set({ role: parsed.data.role })
        .where("household_id", "=", parsed.data.householdId)
        .where("user_id", "=", parsed.data.userId)
        .returning("role")
        .execute(),
    );
    if (!updated.length) return { ok: false, error: fr.errors.forbidden };
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/settings/household");
  return { ok: true, data: undefined };
}

export async function removeAccount(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: fr.errors.generic };
  try {
    const removed = await withSession((db) =>
      db
        .deleteFrom("memberships")
        .where("household_id", "=", parsed.data.householdId)
        .where("user_id", "=", parsed.data.userId)
        .returning("user_id")
        .execute(),
    );
    if (!removed.length) return { ok: false, error: fr.errors.forbidden };
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  revalidatePath("/settings/household");
  return { ok: true, data: undefined };
}

export async function leaveHousehold(formData: FormData): Promise<ActionResult> {
  await requireUser("/settings/household");
  const id = uuid.safeParse(formData.get("householdId"));
  if (!id.success) return { ok: false, error: fr.errors.generic };
  try {
    await withSession((db) => rpc(db, "leave_household", { p_household: id.data }));
  } catch (e) {
    return { ok: false, error: toUserMessage(e) };
  }
  (await cookies()).delete(ACTIVE_HOUSEHOLD_COOKIE);
  redirect("/app");
}
