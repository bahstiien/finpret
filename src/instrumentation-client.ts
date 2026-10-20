import * as Sentry from "@sentry/nextjs";

/** Erreurs du navigateur : active seulement si NEXT_PUBLIC_SENTRY_DSN est renseigné (même projet que SENTRY_DSN). */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0 });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
