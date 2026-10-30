import { NextResponse } from "next/server";
import { notificationsSchema } from "@/lib/settings";
import { json, withAdmin } from "@/server/db";
import { verifyUnsubscribeToken } from "@/server/emails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Désinscription en un clic (POST, `List-Unsubscribe-Post`) ou depuis le lien de l'e-mail (GET). */
async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(userId) || !token || !verifyUnsubscribeToken(userId, token)) {
    return NextResponse.json({ error: "token" }, { status: 400 });
  }
  await withAdmin(async (db) => {
    const data = await db
      .selectFrom("user_settings")
      .select("notifications")
      .where("user_id", "=", userId)
      .executeTakeFirst();
    const prefs = notificationsSchema.parse(data?.notifications ?? {});
    await db
      .updateTable("user_settings")
      .set({ notifications: json({ ...prefs, marketingEmails: false }) })
      .where("user_id", "=", userId)
      .execute();
  });
  return null;
}

export async function POST(request: Request) {
  const error = await unsubscribe(request);
  return error ?? NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const error = await unsubscribe(request);
  if (error) return error;
  return new NextResponse(
    '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Désinscription</title><body style="font-family:sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>C\'est fait</h1><p>Tu ne recevras plus d\'e-mails d\'information de Fin Prêt. Les e-mails indispensables (paiement, invitations) continuent.</p></body></html>',
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
