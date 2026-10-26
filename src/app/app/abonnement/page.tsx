import { redirect } from "next/navigation";

/** L'abonnement vit dans Réglages ; l'ancienne adresse (e-mails, Stripe, cartes « offre payante ») y renvoie. */
export default async function LegacySubscriptionRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  redirect(`/settings/subscription${qs ? `?${qs}` : ""}`);
}
