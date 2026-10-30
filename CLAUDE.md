# CLAUDE.md — Fin Prêt

Application web progressive (PWA) multi-foyers de planification de repas et de batch cooking.
La spécification complète est dans `docs/SPEC.md` : **lis-la en entier avant d'écrire du code**, puis travaille jalon par jalon (section 14 de la spec).

## Sources de vérité
- `docs/RECAP_JANVIER.md` : état des jalons, reste à faire hors code, écarts et questions ouvertes. `docs/RESTAURATION.md` : sauvegarde et test de restauration.
- `docs/SPEC_JANVIER.md` : **prioritaire** pour le lancement du 4 janvier 2027 (périmètre, jalons J0 à J9). En cas de contradiction : SPEC_JANVIER > SPEC > prototype. L'écart avec le code est suivi dans `docs/AUDIT_ECART_JANVIER.md`.
- `src/lib/features.ts` : drapeaux des fonctionnalités REPORTÉES par SPEC_JANVIER (code conservé, masqué).
- `design-system/tokens.json` : couleurs, rôles et domaines, polices, rayons, tactile, durées ; `pnpm tokens` génère `src/styles/tokens.css`. `docs/DESIGN_SYSTEM.md` : règles visuelles du design system « Fin Prêt Néo » (néo-brutalisme, projet Claude Design).
- `docs/SPEC.md` : périmètre, règles métier, modèle de données, écrans, critères d'acceptation.
- `seed/*.json` : données réelles (133 ingrédients, 184 recettes de repas, 35 goûters, 25 petits-déjeuners, contenants). Leur format est décrit dans `seed/README.md`.
- `reference/menu-legacy.html` : prototype mono-utilisateur qui fonctionne en production. **Le moteur de génération, la session et les calculs de quantités doivent reproduire son comportement.** Les fonctions à porter sont listées en section 7 de la spec, avec leur nom dans ce fichier.
- `reference/design/` : maquettes de la refonte v2 (PNG et HTML). Elles font foi pour l'interface.

## Stack (imposée)
- Next.js 15 (App Router), TypeScript strict, React Server Components par défaut.
- Tailwind CSS 4 avec les design tokens de la spec (section 11) ; aucune autre librairie d'interface lourde (icônes : Phosphor, voir docs/DESIGN_SYSTEM.md).
- PostgreSQL 18 avec RLS, accès par Kysely (`src/server/db.ts` : `withSession`, `withUser`, `withAdmin`) ; Better Auth (lien magique, Google) ; temps réel par LISTEN/NOTIFY et SSE ; fichiers privés sur disque (`src/server/files.ts`). Plus de Supabase : historique dans `docs/MIGRATION_POSTGRES.md`.
- Production : VPS (Docker Compose, `deploy/`), sauvegardes `deploy/backup.sh`, mise en service `docs/MISE_EN_SERVICE.md`. Pas de Docker sur le poste de développement.
- Zod pour toute validation d'entrée (formulaires, actions serveur, fonctions).
- Tests : Vitest (unitaires, moteur), Playwright (parcours de bout en bout).
- PWA : manifest, service worker (Serwist), Web Push (VAPID).
- Gestionnaire de paquets : pnpm.

## Commandes
```bash
pnpm install
pnpm dev                 # application sur http://localhost:3000
pnpm test                # Vitest
pnpm test:e2e            # Playwright
pnpm lint && pnpm typecheck
pnpm test:db:lite        # tests RLS pgTAP sur PGlite (sans Docker)
pnpm db:local start      # base PostgreSQL locale sans Docker (port 54329, binaires PostgreSQL pour Windows)
pnpm db:migrate          # applique db/migrations à DATABASE_URL
pnpm db:types            # régénère src/server/db.types.ts depuis la base
pnpm tokens              # régénère src/styles/tokens.css
pnpm seed                # importe seed/*.json dans la base
```

## Règles de travail
1. **Un jalon à la fois.** Ne passe au jalon suivant que lorsque tous ses critères d'acceptation passent, avec les tests correspondants.
2. **Le moteur est du TypeScript pur** dans `src/engine/`, sans import de React ni accès à la base. Il est entièrement couvert par Vitest. Les calculs de quantités, de portions et de session y vivent aussi.
3. **Toute table métier a une RLS** basée sur l'appartenance au foyer (`is_household_member()`). Le navigateur n'accède jamais à la base : il passe par des actions serveur ; `withAdmin` (contourne la RLS) seulement côté serveur, après vérification des droits.
4. **Pas de logique métier dans les composants :** les composants appellent des actions serveur ou des hooks qui délèguent au moteur.
5. **Les textes de l'interface sont en français,** centralisés dans `src/i18n/fr.ts`. Tutoiement, ton chaleureux et direct, pas de jargon. Les montants, unités et dates suivent le format français.
6. **Accessibilité :** zones tactiles d'au moins 44 px, contrastes AA, libellés ARIA sur les boutons-icônes, navigation au clavier.
7. **N'invente aucune donnée nutritionnelle ni recette :** utilise `seed/`. Pour l'import de recettes, ne stocke jamais les photos ni le texte original des étapes d'un site (SPEC §8.8). S'il manque une information, ajoute un `TODO(spec)` et signale-le dans le récapitulatif du jalon.
8. **Migrations SQL versionnées** dans `db/migrations/`, jamais de modification manuelle du schéma. Après une migration : `pnpm db:migrate` puis `pnpm db:types` ; une colonne bornée par `check (… in (…))` s'ajoute à `scripts/db-types-overrides.json`. Une migration reste compatible avec la version précédente de l'app (pas de retour arrière du schéma).
9. **Secrets** uniquement dans `.env.local` (fournir `.env.example`).
10. **À la fin de chaque jalon,** écris un court récapitulatif : ce qui est fait, les tests ajoutés, les écarts avec la spec et les questions ouvertes.

## Structure cible
```
src/
  app/                    # routes (voir SPEC §10)
  components/             # interface (ui/, menu/, shopping/, session/, settings/)
  engine/                 # moteur pur : menu, quantités, session, contenants
  server/                 # actions serveur, accès aux données (db.ts, db.types.ts générés), auth, temps réel, fichiers
  i18n/fr.ts
db/
  migrations/             # SQL versionné (pnpm db:migrate)
  tests/                  # tests RLS pgTAP (pnpm test:db:lite)
deploy/                   # VPS : docker-compose, Caddy, sauvegardes, tâches planifiées
seed/                     # JSON fournis
tests/unit/               # Vitest hors moteur, base réelle PGlite (pglite-db.ts)
tests/e2e/
```
