import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/Layout";
import { AssociationCodeForm } from "@/components/billing/CodeForm";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { formatLong } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, createPortalSession } from "@/server/actions/billing";
import { tierOf } from "@/server/entitlements";
import { loadOffer } from "@/server/entitlements-load";
import { requireHousehold } from "@/server/session";
import { Card } from "@/components/ui/Card";

const t = fr.subscription;

export const metadata: Metadata = { title: t.title };

/** Offre du foyer : essai, abonnement (Stripe Checkout), portail client, code d'association. */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; code?: string }>;
}) {
  const params = await searchParams;
  const { household } = await requireHousehold("/app/abonnement");
  const isAdmin = household.role === "admin";
  const offer = await loadOffer(household.id);
  const tier = tierOf(offer);
  const supabase = await createClient();
  const [{ data: sub }, { data: h }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("current_period_end, stripe_customer_id")
      .eq("household_id", household.id)
      .maybeSingle(),
    supabase.from("households").select("association_id").eq("id", household.id).single(),
  ]);
  const day = (iso: string) => formatLong(iso.slice(0, 10));
  const hasAssociation = !!h?.association_id;
  const errorText =
    params.error && params.error in t.errors
      ? t.errors[params.error as keyof typeof t.errors]
      : params.error
        ? t.errors.generic
        : null;

  const status =
    tier === "subscribed" && (offer.plan === "monthly" || offer.plan === "yearly")
      ? t.subscribed(t.plans[offer.plan], day(sub?.current_period_end ?? new Date().toISOString()))
      : tier === "trial" && offer.trialEndsAt
        ? t.trial(day(new Date(offer.trialEndsAt).toISOString()))
        : offer.plan === "trial"
          ? t.trialExpired
          : t.free;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PageHeader title={t.title} />
      {params.ok && <FormMessage tone="success">{t.success}</FormMessage>}
      {params.code === "ok" && <FormMessage tone="success">{t.codeOk}</FormMessage>}
      {params.code === "locked" && <FormMessage tone="error">{t.codeLocked}</FormMessage>}
      {errorText && <FormMessage tone="error">{errorText}</FormMessage>}
      <Card as="p" padding="cozy" className="font-bold" data-testid="offer-status">
        {status}
      </Card>

      {tier !== "subscribed" && isAdmin && (
        <section className="grid gap-3 min-[600px]:grid-cols-2" aria-label={t.title}>
          {(["monthly", "yearly"] as const).map((plan) => (
            <form
              key={plan}
              action={createCheckoutSession}
              className="flex flex-col gap-3 rounded-card bg-surface p-5"
            >
              <input type="hidden" name="plan" value={plan} />
              <h2 className="text-xl font-extrabold">{plan === "monthly" ? t.monthly : t.yearly}</h2>
              <p className="font-display text-2xl font-black">
                {plan === "monthly" ? t.monthlyPrice : hasAssociation ? t.yearlyAssociation : t.yearlyPrice}
              </p>
              {plan === "yearly" && hasAssociation && (
                <p className="text-sm font-semibold text-green-ink">
                  {t.associationBadge("de ton association")}
                </p>
              )}
              <Button type="submit" data-testid={`choose-${plan}`}>
                {t.choose}
              </Button>
            </form>
          ))}
        </section>
      )}

      {tier === "subscribed" && isAdmin && sub?.stripe_customer_id && (
        <form action={createPortalSession} className="flex flex-col gap-2 rounded-card bg-surface p-5">
          <p className="text-sm text-muted">{t.portalHint}</p>
          <Button type="submit" variant="outline" className="self-start">
            {t.portal}
          </Button>
        </form>
      )}

      <Card padding="cozy" aria-label={t.includedTitle}>
        <h2 className="mb-2 text-lg font-extrabold">{t.includedTitle}</h2>
        <ul className="list-disc pl-5">
          {t.included.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Card>

      {isAdmin && !hasAssociation && (
        <Card padding="cozy">
          <AssociationCodeForm />
        </Card>
      )}
    </div>
  );
}
