# Fin Prêt

PWA multi-foyers de planification de repas et de batch cooking. Spécification : [`docs/SPEC.md`](docs/SPEC.md) ; règles de travail : [`CLAUDE.md`](CLAUDE.md).

## Prérequis

- Node.js 20.18 ou plus (24 recommandé) et pnpm 11
- Un projet Supabase hébergé **de développement** (région UE), sans Docker : voir « Démarrage »
- La CLI Supabase est une dépendance du projet (`pnpm exec supabase …`)

## Démarrage

```bash
pnpm install
cp .env.example .env.local        # puis complète les valeurs du projet Supabase de développement
pnpm db:push                      # applique supabase/migrations au projet hébergé
pnpm seed                         # importe seed/*.json (catalogue) ; --dry-run pour valider sans écrire
pnpm dev                          # http://localhost:3000
```

Dans le tableau de bord Supabase, *Authentication > URL Configuration* : Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**` et `http://localhost:3100/**`.
Apple et Google se configurent dans *Authentication > Sign In / Providers*.

En CI (GitHub Actions), Supabase tourne en local sur le serveur de build (`pnpm test:db:ci`, e-mails lus dans Mailpit).

## Vérifications

```bash
pnpm lint && pnpm typecheck
pnpm test                         # Vitest
pnpm test:db                      # tests RLS pgTAP sur le projet hébergé (SUPABASE_DB_URL)
pnpm test:db:lite                 # mêmes tests sur PGlite, sans Docker (vérification rapide)
pnpm exec playwright install chromium
pnpm test:e2e                     # Playwright, sur un build de production (port 3100) ;
                                  # les parcours connectés sont ignorés sans .env.local ;
                                  # les comptes de test e2e-…@example.com sont supprimés à la fin
```

Le service worker (Serwist) n'est actif qu'en production (`pnpm build && pnpm start`).

## Types de la base

Après chaque migration : `pnpm db:types` régénère `src/lib/supabase/database.types.ts` (demande `SUPABASE_ACCESS_TOKEN`).

## Icônes

Les icônes PWA provisoires sont générées par `node scripts/generate-icons.mjs`.

## Notifications (M9)

1. Clés VAPID : `pnpm dlx web-push generate-vapid-keys`, puis `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans `.env.local` (et dans l'hébergement).
2. `CRON_SECRET` : `openssl rand -hex 32`.
3. Planificateur : appeler `GET https://<app>/api/cron/notify` toutes les 15 minutes avec l'en-tête `Authorization: Bearer <CRON_SECRET>`. Avec Supabase (extensions `pg_cron` et `pg_net` activées), dans l'éditeur SQL :

   ```sql
   select cron.schedule('notify', '*/15 * * * *', $$
     select net.http_get(
       url := 'https://<app>/api/cron/notify',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     );
   $$);
   ```

   Les envois sont idempotents (une ligne par compte, type et jour dans `notification_log`) : un double passage n'envoie rien de plus. `?at=<date ISO>` rejoue un passage à une heure donnée.
   Série de semaines fin prêtes (SPEC_PROGRES) : appeler de la même façon `GET https://<app>/api/cron/streak-close` toutes les heures (`'0 * * * *'`). Idempotent ; `?at=<date ISO>` rejoue un passage. Après le déploiement initial, jouer une fois `pnpm backfill:progress` (`--dry-run` pour essayer sur une copie).
4. E-mail de repli (facultatif) : `RESEND_API_KEY` et `EMAIL_FROM`. Sans clé, seuls les envois push partent.
