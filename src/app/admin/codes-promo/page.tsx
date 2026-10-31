import Link from "next/link";
import { formatShort } from "@/lib/dates";
import { requireAdmin } from "@/server/admin";
import { stripeAvailable, stripeClient } from "@/server/stripe";
import { PromoForm, PromoToggle } from "@/components/admin/PromoForm";
import { PageHeader } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

const DURATION: Record<string, string> = { once: "1er paiement", repeating: "plusieurs mois", forever: "à vie" };

/** Codes promo : création et suivi des utilisations (Stripe fait foi ; le code se saisit sur la page de paiement). */
export default async function AdminPromoPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const { role } = await requireAdmin();
  const canWrite = role === "owner";
  const after = (await searchParams).after;
  const available = stripeAvailable();
  const list = available
    ? await stripeClient()
        .promotionCodes.list({
          limit: 25,
          expand: ["data.promotion.coupon"],
          ...(after && /^promo_[A-Za-z0-9]+$/.test(after) ? { starting_after: after } : {}),
        })
        .catch(() => null)
    : { data: [], has_more: false };
  const codes = list?.data ?? (list === null ? null : []);
  // Dernières utilisations : sessions de paiement terminées avec un code promo (foyer et e-mail du payeur).
  const redemptions = available
    ? await stripeClient()
        .checkout.sessions.list({ limit: 50, status: "complete", expand: ["data.discounts.promotion_code"] })
        .then((r) =>
          r.data.flatMap((s) =>
            (s.discounts ?? []).flatMap((d) =>
              d.promotion_code && typeof d.promotion_code === "object"
                ? [{ id: s.id, code: d.promotion_code.code, email: s.customer_details?.email ?? s.customer_email, household: s.client_reference_id, at: s.created }]
                : [],
            ),
          ),
        )
        .catch(() => [])
    : [];
  return (
    <>
      <PageHeader title="Codes promo" />
      {!available && <p className="t-small muted">Stripe n&apos;est pas configuré sur ce serveur (STRIPE_SECRET_KEY).</p>}
      {available && canWrite && (
        <Card>
          <PromoForm />
        </Card>
      )}
      <Card as="ul" className="!shadow-none">
        {codes?.map((c) => {
          const coupon = typeof c.promotion.coupon === "object" ? c.promotion.coupon : null;
          return (
            <li key={c.id} className="row t-small flex-wrap items-center justify-between gap-2">
              <span>
                <b className="mono">{c.code}</b>
                {coupon?.percent_off ? ` · −${coupon.percent_off} %` : ""}
                {coupon ? ` · ${DURATION[coupon.duration] ?? coupon.duration}` : ""}
                {c.restrictions.first_time_transaction ? " · 1er achat" : ""}
                {c.restrictions.minimum_amount ? ` · dès ${c.restrictions.minimum_amount / 100} €` : ""}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone={c.active ? "green" : "chip"}>{c.active ? "actif" : "inactif"}</Pill>
                <span className="mono muted">
                  {c.times_redeemed}
                  {c.max_redemptions ? ` / ${c.max_redemptions}` : ""} utilisation(s)
                  {c.expires_at ? ` · expire le ${formatShort(new Date(c.expires_at * 1000).toISOString().slice(0, 10))}` : ""}
                </span>
                {canWrite && <PromoToggle id={c.id} active={c.active} />}
              </span>
            </li>
          );
        })}
        {codes === null && <li className="muted">Impossible de lire les codes depuis Stripe.</li>}
        {codes?.length === 0 && <li className="muted">Aucun code promo.</li>}
      </Card>
      {list?.has_more && codes && codes.length > 0 && (
        <Link href={`/admin/codes-promo?after=${codes[codes.length - 1]!.id}`} className="btn btn--outline btn--sm self-start">
          Codes suivants
        </Link>
      )}
      <h2 className="t-label">Dernières utilisations</h2>
      <Card as="ul" className="t-small !shadow-none">
        {redemptions.map((r) => (
          <li key={`${r.id}-${r.code}`} className="row flex-wrap justify-between gap-2">
            <span>
              <b className="mono">{r.code}</b> · {r.email ?? "?"}
            </span>
            <span className="mono muted">
              {new Date(r.at * 1000).toLocaleDateString("fr-FR")}
              {r.household ? ` · foyer ${r.household.slice(0, 8)}` : ""}
            </span>
          </li>
        ))}
        {!redemptions.length && <li className="muted">Aucune utilisation récente.</li>}
      </Card>
    </>
  );
}
