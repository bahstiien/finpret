# Menu de la semaine

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
