# Menu de la semaine

PWA multi-foyers de planification de repas et de batch cooking. Spécification : [`docs/SPEC.md`](docs/SPEC.md) ; règles de travail : [`CLAUDE.md`](CLAUDE.md).

## Prérequis

- Node.js 20.18 ou plus (24 recommandé) et pnpm 11
- Docker Desktop, pour Supabase en local (la CLI Supabase est une dépendance du projet : `pnpm exec supabase …`)

## Démarrage

```bash
pnpm install
pnpm exec supabase start          # Supabase local (Docker) : base, auth, boîte mail Mailpit
pnpm --silent env:supabase > .env.local   # URL et clés locales (complète ensuite avec .env.example)
pnpm exec supabase db reset       # migrations + seed.sql
pnpm dev                          # http://localhost:3000
```

Les e-mails de connexion envoyés en local arrivent dans Mailpit : http://127.0.0.1:54324.
Apple et Google sont désactivés en local ; ils se configurent dans `supabase/config.toml` (`[auth.external.*]`) ou dans le tableau de bord du projet.

## Vérifications

```bash
pnpm lint && pnpm typecheck
pnpm test                         # Vitest
pnpm test:db                      # tests RLS pgTAP sur Supabase local (Docker)
pnpm test:db:lite                 # mêmes tests sur PGlite, sans Docker (vérification rapide)
pnpm exec playwright install chromium
pnpm test:e2e                     # Playwright, sur un build de production (port 3100) ;
                                  # les parcours connectés sont ignorés sans .env.local
```

Le service worker (Serwist) n'est actif qu'en production (`pnpm build && pnpm start`).

## Types de la base

Après chaque migration : `pnpm db:types` (Supabase local démarré) régénère `src/lib/supabase/database.types.ts`.

## Icônes

Les icônes PWA provisoires sont générées par `node scripts/generate-icons.mjs`.
