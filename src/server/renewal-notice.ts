import "server-only";
import { renewalNoticeDue, YEARLY_PRICE_CENTS } from "@/engine/renewal";
import { withAdmin } from "@/server/db";
import { sendRenewalNotice } from "@/server/emails";
import type { Payload } from "@/server/notify";
import { createNotifyDeps } from "@/server/notify-deps";

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Information de reconduction de l'abonnement annuel (art. L215-1 du Code de la consommation), entre J-60 et J-31,
 * aux administrateurs du foyer, par e-mail (transactionnel : envoyé même après désinscription des e-mails facultatifs).
 * Rien pour un abonnement dont la résiliation est programmée. Idempotent par (compte, échéance) grâce à
 * `claim_notification`, la clé « jour » étant la date de reconduction. Appelé par le planificateur toutes les 15 minutes.
 */
export async function runRenewalNotices(
  baseUrl: string,
  now = new Date(),
): Promise<{ due: number; sent: number }> {
  const deps = createNotifyDeps(baseUrl);
  const summary = { due: 0, sent: 0 };

  const subs = await withAdmin((db) =>
    db
      .selectFrom("subscriptions as s")
      .innerJoin("households as h", "h.id", "s.household_id")
      .select(["s.household_id", "s.current_period_end", "h.timezone"])
      .where("s.plan", "=", "yearly")
      .where("s.status", "in", ["active", "past_due"])
      .where("s.cancel_at_period_end", "=", false)
      .where("s.current_period_end", "is not", null)
      .execute(),
  );

  for (const sub of subs) {
    const due = renewalNoticeDue(sub.current_period_end!, sub.timezone, now);
    if (!due) continue;
    const admins = await withAdmin((db) =>
      db
        .selectFrom("memberships")
        .select("user_id")
        .where("household_id", "=", sub.household_id)
        .where("role", "=", "admin")
        .execute(),
    );
    for (const { user_id: userId } of admins) {
      summary.due++;
      const payload: Payload = {
        kind: "renewal_notice",
        title: "Reconduction de l'abonnement annuel",
        body: `Reconduction le ${longDate(due.renewalDay)}`,
        url: "/settings/subscription",
        day: due.renewalDay,
      };
      if (!(await deps.claim(userId, "renewal_notice", due.renewalDay, payload))) continue;
      const email = await deps.emailOf(userId);
      if (email) await sendRenewalNotice(email, longDate(due.renewalDay), YEARLY_PRICE_CENTS);
      summary.sent++;
    }
  }
  return summary;
}
