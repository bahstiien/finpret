/** Charge .env.local dans process.env s'il existe. */
export function loadEnvLocal(): void;
/** Valeur d'une variable d'environnement ; arrête le script si elle manque ou reste un modèle. */
export function requireEnv(name: string): string;
/** Options SSL de `pg` selon la base (distante ou locale). */
export function pgSsl(connectionString: string): false | { rejectUnauthorized: boolean };
