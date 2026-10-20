import * as Sentry from "@sentry/nextjs";

/**
 * Surveillance des erreurs (SPEC_JANVIER §8) : active seulement si SENTRY_DSN est renseigné.
 * Pas de traces de performance.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
