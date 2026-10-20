/** Secret du planificateur des notifications pour les tests (si .env.local n'en définit pas). */
export const cronSecret = () => process.env.CRON_SECRET || "e2e-cron-secret-0123456789abcdef";
