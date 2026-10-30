import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Sonde de santé du conteneur (Docker, déploiement). Ne touche ni la base ni Stripe : elle dit seulement que le serveur répond. */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
