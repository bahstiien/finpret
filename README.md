# Menu de la semaine

PWA multi-foyers de planification de repas et de batch cooking. Spécification : [`docs/SPEC.md`](docs/SPEC.md) ; règles de travail : [`CLAUDE.md`](CLAUDE.md).

## Prérequis

- Node.js 20.18 ou plus (24 recommandé) et pnpm 11
- Docker Desktop, pour Supabase en local (la CLI Supabase est une dépendance du projet : `pnpm exec supabase …`)

## Démarrage

```bash
pnpm install
cp .env.example .env.local        # puis complète avec les clés de `pnpm exec supabase status`
pnpm exec supabase start          # Supabase local (Docker)
pnpm exec supabase db reset       # migrations + seed.sql
pnpm dev                          # http://localhost:3000
```

## Vérifications

```bash
pnpm lint && pnpm typecheck
pnpm test                         # Vitest
pnpm exec playwright install chromium
pnpm test:e2e                     # Playwright, sur un build de production (port 3100)
```

Le service worker (Serwist) n'est actif qu'en production (`pnpm build && pnpm start`).

## Icônes

Les icônes PWA provisoires sont générées par `node scripts/generate-icons.mjs`.
