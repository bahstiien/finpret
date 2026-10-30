# Fin Prêt

PWA multi-foyers de planification de repas et de batch cooking. Spécification : [`docs/SPEC.md`](docs/SPEC.md) ; règles de travail : [`CLAUDE.md`](CLAUDE.md).

## Prérequis

- Node.js 20.18 ou plus (24 recommandé) et pnpm 11
- PostgreSQL 18 installé sur le poste (installateur Windows de postgresql.org, ou `PG_BIN` vers ses binaires), sans Docker : la base de développement tourne dans un cluster à part (`.pgdata/`)

## Démarrage

```bash
pnpm install
cp .env.example .env.local        # puis complète-le (au minimum DATABASE_URL, BETTER_AUTH_SECRET, APP_URL=http://localhost:3000)
pnpm db:local start               # base PostgreSQL locale sur le port 54329 (stop | status | reset)
pnpm db:migrate                   # applique db/migrations
pnpm seed                         # importe seed/*.json (catalogue) ; --dry-run pour valider sans écrire
pnpm dev                          # http://localhost:3000
```

Connexion en local : sans `BREVO_API_KEY`, le lien de connexion s'affiche dans le terminal de `pnpm dev`.
Google se configure dans Google Cloud (URI de redirection `<APP_URL>/api/auth/callback/google`), voir `.env.example`.

En CI (GitHub Actions), une base `postgres:18` jetable reçoit les migrations et le catalogue, puis les tests de bout en bout tournent sur un build de production.

## Vérifications

```bash
pnpm lint && pnpm typecheck
pnpm test                         # Vitest (moteur, et serveur sur une vraie base PGlite)
pnpm test:db:lite                 # tests RLS pgTAP sur PGlite, sans Docker
pnpm exec playwright install chromium
pnpm test:e2e                     # Playwright, sur un build de production (port 3300) ;
                                  # liens de connexion lus dans test-results/magic-links ;
                                  # les comptes de test e2e-…@example.com sont supprimés à la fin
```

Le service worker (Serwist) n'est actif qu'en production (`pnpm build && pnpm start`).

## Base de données

- Migrations SQL dans `db/migrations` (`pnpm db:migrate`), tests RLS dans `db/tests`.
- Après chaque migration : `pnpm db:types` régénère `src/server/db.types.ts` (types Kysely) depuis la base locale.
- Accès depuis le code : `withSession`, `withUser`, `withAdmin` (`src/server/db.ts`, `src/server/session.ts`) ; la RLS s'applique sauf en `withAdmin`.

## Production

VPS avec Docker Compose (Postgres, migrations, app, Caddy) : [`deploy/README.md`](deploy/README.md).
Mise en service : [`docs/MISE_EN_SERVICE.md`](docs/MISE_EN_SERVICE.md) ; sauvegarde et restauration : [`docs/RESTAURATION.md`](docs/RESTAURATION.md).

## Icônes

Les icônes PWA provisoires sont générées par `node scripts/generate-icons.mjs`.

## Notifications (M9)

1. Clés VAPID : `pnpm dlx web-push generate-vapid-keys`, puis `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans `.env.local` (et dans `.env.production` sur le VPS).
2. `CRON_SECRET` : `openssl rand -hex 32`.
3. Planificateur : `GET /api/cron/notify` toutes les 15 minutes, `GET /api/cron/streak-close` toutes les heures, avec l'en-tête `Authorization: Bearer <CRON_SECRET>`. Sur le VPS, la crontab appelle `deploy/cron.sh` (lignes dans `docs/MISE_EN_SERVICE.md`).
   Les envois sont idempotents (une ligne par compte, type et jour dans `notification_log`) : un double passage n'envoie rien de plus. `?at=<date ISO>` rejoue un passage à une heure donnée.
   Après le déploiement initial, jouer une fois `pnpm backfill:progress` (`--dry-run` pour essayer sur une copie).
4. E-mail de repli (facultatif) : `BREVO_API_KEY` et `EMAIL_FROM`. Sans clé, seuls les envois push partent.
