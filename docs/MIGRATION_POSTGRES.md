# Migration Supabase → PostgreSQL (VPS)

Branche `postgres`, partie de `main` (8c2a795). Décisions : Postgres sur le VPS Hostinger, Better Auth à la place de Supabase Auth.

## Inventaire de départ

| Brique Supabase | Usage dans le code | Remplacement |
| --- | --- | --- |
| Auth | OTP e-mail, Google OAuth, MFA TOTP, admin (lister, supprimer) | Better Auth : plugins `emailOTP`, `twoFactor`, `admin`, fournisseur Google ; e-mails envoyés par Resend (déjà configuré) |
| Postgres + RLS | 21 migrations, 113 politiques, `auth.uid()` ×46, `auth.users` ×25, rôles `authenticated` ×146 / `anon` ×2 / `service_role` ×1 | Même Postgres. RLS conservée grâce à une couche de compatibilité (voir plus bas) |
| PostgREST (`supabase-js`) | ~330 appels `.from()`, 20 `.rpc()`, dans ~77 fichiers | Kysely sur `pg`, types générés depuis la base (`kysely-codegen`) |
| Realtime | courses et session (`ShoppingScreen`, `SessionProvider`), 5 tables publiées | Triggers `NOTIFY` + route SSE `/api/realtime` |
| Storage | 2 buckets privés de PDF, lus et écrits seulement par le serveur | Volume Docker monté sur le VPS (`/data/files`), sauvegardé avec la base |
| CLI (`db push`, `db:types`, `test db`) | scripts `supabase-remote.mjs`, `env:supabase` | `scripts/migrate.mjs` (table `schema_migrations`), `kysely-codegen`, tests PGlite existants |

## Principe : garder la RLS telle quelle

Plutôt que réécrire 113 politiques, la migration de compatibilité `20261018000000_compat.sql`, jouée en premier, recrée ce que Supabase fournissait :

- le schéma `extensions` (pgcrypto) et le `search_path` de la base ;
- les rôles `anon`, `authenticated`, `service_role` (NOLOGIN, `service_role` avec `BYPASSRLS`) et leurs droits par défaut ;
- le schéma `auth` : table `auth.users` (colonnes Better Auth + colonnes héritées de Supabase), et `auth.uid()` qui lit `request.jwt.claims`, comme sous Supabase : les tests pgTAP n'ont pas changé.

L'app se connecte avec un rôle de connexion sans privilège, membre des trois rôles (`grant anon, authenticated, service_role to <rôle>`). Chaque connexion du pool démarre en `anon`. `src/server/db.ts` ouvre une transaction et pose `request.jwt.claims` + `role` en local :

- `withUser(userId, db => …)` : rôle `authenticated`, la RLS s'applique ;
- `withAnon(db => …)` : rôle `anon` ;
- `withAdmin(db => …)` : rôle `service_role` (remplace la clé de service).

Les tables de sessions, de comptes OAuth et de TOTP de Better Auth arrivent en phase 2.

## Phases

Chaque phase laisse l'app fonctionnelle et testée (`pnpm test`, `pnpm test:db:lite`, `pnpm typecheck`).

1. **Socle base** ✅ — migration de compatibilité, `pnpm db:migrate` (table `schema_migrations`), `pnpm db:local start|stop|status|reset` (cluster dans `.pgdata/`, port 54329, binaires PostgreSQL pour Windows, sans Docker), `pnpm db:types:pg` (génère `src/server/db.types.ts`), `src/server/db.ts`. Vérifié : 21 migrations sur PostgreSQL 18 (rejouables), `test:db:lite` vert, typecheck et lint propres ; RLS contrôlée sur PG 18 avec un rôle de connexion non superutilisateur (A voit son foyer, B rien, `anon` refusé, `service_role` voit tout, connexion hors transaction refusée).
2. **Auth** — Better Auth monté sur `/api/auth/[...all]`, écrans de connexion (OTP, Google), MFA, middleware, actions admin. Remplace `src/lib/supabase/*` côté session.
3. **Accès aux données** — réécriture des `.from()` / `.rpc()` en Kysely, fichier par fichier (en commençant par `household-context`, `weeks`, `shopping`), tests à chaque lot.
4. **Realtime** — triggers `pg_notify` sur les 5 tables, un `LISTEN` partagé côté serveur, route SSE filtrée par foyer, hooks client mis à jour.
5. **Fichiers** — `src/server/files.ts` (lecture/écriture sur le volume) pour les kits et relevés d'associations.
6. **Prod VPS** — service `postgres:17` dans `deploy/docker-compose.yml` (réseau interne, non exposé), volume `pgdata`, `pg_dump` quotidien chiffré vers un stockage externe, mise à jour de `RESTAURATION.md` et du workflow de déploiement (migrations jouées avant le démarrage de l'app).
7. **Bascule des données** — export depuis Supabase (`public` + id/e-mail de `auth.users`), import, vérification des comptes. Les sessions en cours sont perdues (reconnexion par OTP) ; les secrets TOTP sont repris depuis `auth.mfa_factors` si l'export le permet, sinon réenrôlement.
8. **Nettoyage** — suppression de `@supabase/*`, `supabase/`, variables `SUPABASE_*`, mise à jour de `CLAUDE.md`, `SPEC.md` (stack), `README.md`.

## Points ouverts

- Les branches `design-v2-1`, `prise-en-main`, `progres` touchent les mêmes fichiers : à fusionner dans `main` avant la phase 3 pour limiter les conflits, ou à rebaser après.
- Données de production existantes sur Supabase : volume et comptes réels à confirmer avant la phase 7.
- Hors Docker en local : Postgres 17 installé nativement sur Windows (installateur EDB) pour `pnpm dev` ; PGlite reste l'outil des tests.
