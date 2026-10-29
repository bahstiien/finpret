import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertWebhookFailure } from "@/server/alerts";
import { sendPaymentFailed } from "@/server/emails";
import { stripeClient, stripeConfig } from "@/server/stripe";
import { handleStripeEvent, type StripeEventLike } from "@/server/stripe-webhook";
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
    // Litige : la facture se retrouve par le paiement (le litige ne la porte pas).
    if (event.type === "charge.dispute.created") {
      const charge = (event.data.object as { charge?: string }).charge;
      if (charge) {
        const full = (await stripe.charges.retrieve(charge)) as unknown as {
          invoice?: string | { id: string } | null;
        };
        const invoice = typeof full.invoice === "string" ? full.invoice : full.invoice?.id;
        (like.data.object as Record<string, unknown>).charge_invoice = invoice ?? null;
      }
    }
    const result = await handleStripeEvent(createAdminClient(), like, cfg, {
      // E-mail aux administrateurs du foyer : leur carte a été refusée.
      paymentFailed: async (householdId) => {
        const db = createAdminClient();
        const { data: admins } = await db
          .from("memberships")
          .select("user_id")
          .eq("household_id", householdId)
          .eq("role", "admin");
        for (const a of admins ?? []) {
          const email = await emailOf(a.user_id);
          if (email) await sendPaymentFailed(email);
        }
      },
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    Sentry.captureException(error);
    await alertWebhookFailure(event.id, event.type, error);
    // Réponse 500 : Stripe renvoie l'événement (3 jours de relances).
    return NextResponse.json({ error: "handler" }, { status: 500 });
  }
}
