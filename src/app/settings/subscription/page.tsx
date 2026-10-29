import type { Metadata } from "next";
import Link from "next/link";
import { AssociationCodeForm } from "@/components/billing/CodeForm";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { fr } from "@/i18n/fr";
import { brandLabel, cardExpired } from "@/lib/billing";
import { formatLong } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  cancelSubscription,
  changePlan,
  createCheckoutSession,
  createPortalSession,
  resumeSubscription,
  updatePaymentMethod,
} from "@/server/actions/billing";
import { getBillingDetails } from "@/server/billing-details";
import { tierOf } from "@/server/entitlements";
import { loadOffer } from "@/server/entitlements-load";
import { listInvoices } from "@/server/invoices";
import { requireHousehold } from "@/server/session";

const t = fr.subscription;

export const metadata: Metadata = { title: t.title };

const pill = "inline-flex min-h-11 items-center rounded-r2 px-4 font-bold";

/** Offre du foyer : essai, abonnement, carte, résiliation, factures, code d'association (admin) ; lecture seule sinon. */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; code?: string }>;
}) {
  const params = await searchParams;
  const { household } = await requireHousehold("/settings/subscription");
  const isAdmin = household.role === "admin";
  const offer = await loadOffer(household.id);
  const tier = tierOf(offer);
  const supabase = await createClient();
  const [{ data: sub }, { data: h }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("current_period_end, stripe_customer_id, stripe_subscription_id, status")
      .eq("household_id", household.id)
      .maybeSingle(),
    supabase.from("households").select("association_id").eq("id", household.id).single(),
  ]);
  const subscribed = tier === "subscribed" && (offer.plan === "monthly" || offer.plan === "yearly");
  const [invoices, details] = await Promise.all([
    isAdmin && sub?.stripe_customer_id ? listInvoices(sub.stripe_customer_id) : undefined,
    isAdmin && subscribed && sub?.stripe_subscription_id
      ? getBillingDetails(sub.stripe_subscription_id)
      : undefined,
  ]);
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  const day = (iso: string) => formatLong(iso.slice(0, 10));
  const hasAssociation = !!h?.association_id;
  const errorText =
    params.error && params.error in t.errors
      ? t.errors[params.error as keyof typeof t.errors]
      : params.error
        ? t.errors.generic
        : null;
  const okText = !params.ok
    ? null
    : params.ok in t.confirmations
      ? t.confirmations[params.ok as keyof typeof t.confirmations]
      : t.success;

  const renewal = details?.periodEnd ?? sub?.current_period_end ?? new Date().toISOString();
  const status = subscribed
    ? details?.cancelsOn
      ? t.subscribedEnding(t.plans[offer.plan as "monthly" | "yearly"], day(details.cancelsOn))
      : t.subscribed(t.plans[offer.plan as "monthly" | "yearly"], day(renewal))
    : tier === "trial" && offer.trialEndsAt
      ? t.trial(day(new Date(offer.trialEndsAt).toISOString()))
      : offer.plan === "trial"
        ? t.trialExpired
        : t.free;

  return (
    <div className="flex flex-col gap-4">
      {okText && <FormMessage tone="success">{okText}</FormMessage>}
      {params.code === "ok" && <FormMessage tone="success">{t.codeOk}</FormMessage>}
      {params.code === "locked" && <FormMessage tone="error">{t.codeLocked}</FormMessage>}
      {errorText && <FormMessage tone="error">{errorText}</FormMessage>}
      <Card as="p" padding="cozy" className="font-bold" data-testid="offer-status">
        {status}
      </Card>

      {!isAdmin && <p className="text-sm text-muted">{t.memberNote}</p>}
      {sub?.status === "past_due" && isAdmin && <FormMessage tone="error">{t.pastDue}</FormMessage>}

      {tier !== "subscribed" && isAdmin && (
        <>
          <section className="grid gap-3 min-[600px]:grid-cols-2" aria-label={t.title}>
            {(["monthly", "yearly"] as const).map((plan) => (
              <form
                key={plan}
                action={createCheckoutSession}
                className="flex flex-col gap-3 rounded-card bg-surface p-4 border-[length:var(--bw)] border-line"
              >
                <input type="hidden" name="plan" value={plan} />
                <h2 className="text-xl font-bold">{plan === "monthly" ? t.monthly : t.yearly}</h2>
                <p className="font-display text-2xl font-bold">
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
          <p className="text-sm text-muted" data-testid="legal-links">
            {t.legal.secure}{" "}
            <Link href="/cgv" className="underline">
              {t.legal.cgv}
            </Link>{" "}
            ·{" "}
            <Link href="/confidentialite" className="underline">
              {t.legal.privacy}
            </Link>
          </p>
        </>
      )}

      {isAdmin && subscribed && (
        <Card padding="cozy" className="flex flex-col gap-3" aria-label={t.card.title}>
          <h2 className="text-lg font-bold">{t.card.title}</h2>
          {details === null ? (
            <p className="text-sm text-muted">{t.detailsUnavailable}</p>
          ) : details?.card ? (
            <div className="flex flex-col gap-1" data-testid="payment-card">
              <p className="font-semibold">
                {t.card.line(brandLabel(details.card.brand), details.card.last4)}
              </p>
              <p className="text-sm text-muted">
                {t.card.expires(details.card.expMonth, details.card.expYear)}
              </p>
              {cardExpired(details.card) && <FormMessage tone="error">{t.card.expired}</FormMessage>}
            </div>
          ) : (
            <p className="text-sm text-muted">{t.card.none}</p>
          )}
          <form action={updatePaymentMethod}>
            <Button type="submit" variant="outline">
              {t.card.update}
            </Button>
          </form>
        </Card>
      )}

      {isAdmin && subscribed && details && (
        <Card padding="cozy" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start gap-3">
            <form action={changePlan} className="flex flex-col gap-2">
              <input type="hidden" name="plan" value={offer.plan === "yearly" ? "monthly" : "yearly"} />
              <Button type="submit" variant="outline" data-testid="change-plan">
                {offer.plan === "yearly" ? t.changeToMonthly : t.changeToYearly}
              </Button>
            </form>
            {details.cancelsOn ? (
              <form action={resumeSubscription}>
                <Button type="submit" data-testid="resume">
                  {t.resume}
                </Button>
              </form>
            ) : (
              <ActionForm
                action={cancelSubscription}
                fields={{}}
                label={t.cancel}
                confirm={t.cancelConfirm(day(renewal))}
              />
            )}
          </div>
          <p className="text-sm text-muted">{t.changeHint}</p>
        </Card>
      )}

      {isAdmin && sub?.stripe_customer_id && (
        <form action={createPortalSession} className="flex flex-col gap-2 rounded-card bg-surface p-4 border-[length:var(--bw)] border-line">
          <p className="text-sm text-muted">{t.portalHint}</p>
          <Button type="submit" variant="outline" className="self-start">
            {t.portal}
          </Button>
        </form>
      )}

      {invoices !== undefined && (
        <Card padding="cozy" className="flex flex-col gap-3" aria-label={t.billing.title}>
          <h2 className="text-lg font-bold">{t.billing.title}</h2>
          {invoices === null ? (
            <p className="text-sm text-muted">{t.billing.unavailable}</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted">{t.billing.empty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line" data-testid="invoices">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold">{t.billing.number(inv.number)}</span>
                    <span className="text-sm text-muted">
                      {formatLong(inv.date)} · {money(inv.amount, inv.currency)} ·{" "}
                      {t.billing.statuses[inv.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inv.status === "open" && inv.hostedUrl && (
                      <a href={inv.hostedUrl} className={`${pill} bg-banana text-[#17151F]`}>
                        {t.billing.pay}
                      </a>
                    )}
                    {inv.status !== "open" && inv.hostedUrl && (
                      <a
                        href={inv.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${pill} border-2 border-ink`}
                      >
                        {t.billing.view}
                      </a>
                    )}
                    {inv.pdfUrl && (
                      <a href={inv.pdfUrl} className={`${pill} border-2 border-ink`}>
                        {t.billing.download}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card padding="cozy" aria-label={t.includedTitle}>
        <h2 className="mb-2 text-lg font-bold">{t.includedTitle}</h2>
        <ul className="list-disc pl-4">
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
