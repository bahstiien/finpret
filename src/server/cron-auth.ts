import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Appel du planificateur (deploy/cron.sh) : `Authorization: Bearer <CRON_SECRET>`, comparé en temps constant. */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return (
    !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret))
  );
}
