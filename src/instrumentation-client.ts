/**
 * Erreurs du navigateur : active seulement si NEXT_PUBLIC_SENTRY_DSN est renseigné (même projet que SENTRY_DSN).
 * Le SDK est chargé après le chargement de la page : importé ici, il pesait sur le premier affichage de chaque page.
 * Pas de suivi des navigations : le traçage est coupé (`tracesSampleRate: 0`).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  const load = () => {
    void import("@sentry/nextjs").then((Sentry) => Sentry.init({ dsn, tracesSampleRate: 0 }));
  };
  if (document.readyState === "complete") load();
  else window.addEventListener("load", load, { once: true });
}
