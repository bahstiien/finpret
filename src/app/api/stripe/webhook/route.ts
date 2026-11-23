import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { alertWebhookFailure } from "@/server/alerts";
import { withAdmin } from "@/server/db";
import { sendPaymentFailed } from "@/server/emails";
import { stripeClient, stripeConfig } from "@/server/stripe";
import { chargeInvoiceId, handleStripeEvent, type StripeEventLike } from "@/server/stripe-webhook";
import { emailOf } from "@/server/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Webhook Stripe : corps brut, signature vérifiée avec STRIPE_WEBHOOK_SECRET (SPEC_JANVIER §6). */
export async function POST(request: Request) {
  const cfg = stripeConfig();
  const signature = request.headers.get("stripe-signature");
  if (!cfg.webhookSecret || !signature) return NextResponse.json({ error: "signature" }, { status: 400 });
  const body = await request.text();

  let stripe;
  let event;
  try {
    stripe = stripeClient();
    event = stripe.webhooks.constructEvent(body, signature, cfg.webhookSecret);
  } catch {
    return NextResponse.json({ error: "signature" }, { status: 400 });
  }

  const like = event as unknown as StripeEventLike;
  try {
    // Remboursement ou litige : la facture n'est plus sur le charge, elle se retrouve par le paiement.
    if (
      event.type === "charge.refunded" ||
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.closed"
    ) {
      (like.data.object as Record<string, unknown>).charge_invoice = await chargeInvoiceId(
        stripe,
        event.data.object,
      );
    }
    const result = await withAdmin((db) =>
      handleStripeEvent(db, like, cfg, {
        // E-mail aux administrateurs du foyer : leur carte a été refusée.
        paymentFailed: async (householdId) => {
          const admins = await db
            .selectFrom("memberships")
            .select("user_id")
            .where("household_id", "=", householdId)
            .where("role", "=", "admin")
            .execute();
          for (const a of admins) {
            const email = await emailOf(a.user_id);
            if (email) await sendPaymentFailed(email);
          }
        },
      }),
    );
    return NextResponse.json({ received: true, result });
  } catch (error) {
    Sentry.captureException(error);
    await alertWebhookFailure(event.id, event.type, error);
    // Réponse 500 : Stripe renvoie l'événement (3 jours de relances).
    return NextResponse.json({ error: "handler" }, { status: 500 });
  }
}
