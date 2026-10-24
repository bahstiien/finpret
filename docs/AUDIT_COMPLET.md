# Audit complet de Fin Prêt

Mis à jour le 24 octobre 2026, branche `design-system-ui` @ `4b0fc1d` (poussée sur `origin`).
Remplace `AUDIT_ECART_JANVIER.md` (photo du 20 octobre, périmée : tous les jalons J0 à J8 sont livrés).

**Vérifié** : `pnpm lint`, `pnpm typecheck`, `pnpm test` (509 tests, 45 fichiers), `pnpm build` (hook pre-push), `pnpm db:push:dry` (base distante à jour, 20 migrations).
**Non vérifié** : Playwright, pgTAP, interface dans un navigateur, Stripe en réel.

## 1. Fonctionnalités non terminées ou inactives

| Sujet | État | Reste à faire |
| --- | --- | --- |
| Courses réelles (`FEATURES.realPurchases = false`) | Lots L1 à L4 codés. **Nouveau** : panneau « Où j'en suis » (`WeekOpsPanel` : déjà commencé / préparé, réaffectation d'achats). `markPreparation` accepte les identifiants dérivés. | Écrans jamais vérifiés dans un navigateur. Pas d'action « retirer le repas non commencé » quand aucune adaptation n'est trouvée. L5 (temps réel de bout en bout, mesures) et L6 (pilote) non traités. Décision : pilote ou report. |
| Série et passeport | Migrations appliquées (base à jour). **Nouveau** : lien « Nos progrès » en fin de session, donc `progress_viewed` émis (`from=session`). | Types Supabase écrits à la main : lancer `pnpm db:types` (`SUPABASE_ACCESS_TOKEN`). Parcours Playwright `progress.spec.ts` jamais joués. |
| Fonctions REPORTÉES | 11 drapeaux à `false` dans `src/lib/features.ts`. | Code mort à maintenir ; `ANTHROPIC_API_KEY` ne sert qu'à l'import de recettes (éteint). |
| Cantine | Cantine par enfant (`householdCanteen: true`) coexiste avec les menus d'école. | Décider du retrait (casserait `canteen.spec.ts`). |
| Import PDF des menus d'école | Route Next, pas d'Edge Function. | Tout arrive dans « Plat » (pas de découpage entrée/plat/accompagnement sans modèle de langage). PDF source non conservé. |
| Polices PDF | Helvetica. | Fournir ou télécharger Gabarito et Figtree. |
| Allergènes | Table `allergens.ts` avec 5 `TODO(spec)` (saucisse, galette, chocolat, bouillon, curry). | Validation éditoriale (sécurité alimentaire). `seed/allergens.json` prévu en J2 inexistant. |

## 2. Risques et bugs probables (non corrigés)

1. ~~**Suppression de compte sans annulation Stripe**~~ **Corrigé le 24/10** (`subscription-cleanup.ts`, résiliation immédiate avant suppression, suppression interrompue si Stripe échoue, 5 tests). Description initiale : **Suppression de compte sans annulation Stripe** (`src/server/actions/settings.ts`, `deleteAccount`) : le foyer est supprimé, la ligne `subscriptions` part en cascade, mais l'abonnement Stripe reste actif. Risque de facturation après suppression. **Priorité 1.**
2. **Limitation de débit en mémoire** (`src/server/rate-limit.ts`) : inefficace en serverless (compteur par instance). Protège lien magique, `/ecole/[code]`, prospects, création d'association.
3. ~~**Buckets Storage**~~ **Corrigé le 24/10** (migration `20261106000000_storage_buckets`, appliquée, buckets `asso-kits` et `asso-statements` privés vérifiés ; `canteen-pdfs` abandonné car le PDF n'est pas conservé). Description initiale : seul `asso-kits` est créé à la volée (`kit.ts`). `asso-statements` (relevés PDF) et `canteen-pdfs` ne sont créés nulle part. À vérifier sur le projet distant.
4. **`current_quarter_cents` non masqué sous 5 foyers** : écart avec D13.
5. **E-mail de connexion Supabase** : gabarit par défaut (anglais, hors charte), ni gabarit ni SMTP configurés.
6. **Page `/design-system`** : protégée par `notFound` (non vérifié en production), absente de `robots.ts`.

## 3. Exploitation et tests

- Aucune configuration de déploiement dans le dépôt. Trois crons à définir : `notify` (15 min), `streak-close` (horaire), `payouts` (trimestriel).
- CI : secrets `SUPABASE_DEV_*` non créés, donc build et Playwright sautés sur GitHub.
- Hook pre-push : lint, typecheck, tests et build (plusieurs minutes par push).
- Pas de tests e2e pour Stripe Checkout, `/admin`, `/asso` (hors inscription), import PDF. TOTP non automatisé. `subscription.spec.ts` ajouté, non joué.
- Premier administrateur : insertion SQL manuelle dans `public.admins` puis TOTP.
- Test de restauration (`RESTAURATION.md`) à jouer avant le 18 décembre.

## 4. Documentation et processus

| Élément | État |
| --- | --- |
| `RECAP_COURSES_REELLES.md` | Corrigé le 24 octobre (titre, migrations, panneau « Où j'en suis »). |
| `README.md` | À corriger : décrit une CI Docker/Mailpit, cite Apple et l'import comme actifs, n'explique ni `/api/cron/payouts`, ni Stripe, ni `IBAN_ENCRYPTION_KEY`, ni le hook pre-push. |
| `CLAUDE.md` | « Structure cible » obsolète (`supabase/functions/` vide, pas de `/asso`, `/admin`, Stripe). |
| `SPEC_PROGRES.md` | Introuvable dans le dépôt. |
| `brand/charte-fin-pret.md` | Toujours absente. |
| Pages légales | Cinq gabarits `TODO(juriste)` ; bloquant pour la production. Statut de l'éditeur (`COMPANY_*`) non renseigné. |
| Processus métier non écrits | Validation d'une association (délai, motifs), support, échec de webhook Stripe, reversements et remboursements, demandes RGPD (suppression immédiate, la spec prévoit 30 jours). |

## 5. Ordre de priorité

1. Annuler l'abonnement Stripe à la suppression de compte.
2. Créer les buckets par migration ; `pnpm db:types`.
3. Définir hébergement et crons ; magasin partagé pour la limitation de débit.
4. Textes juridiques, charte, gabarit d'e-mail de connexion.
5. Jouer Playwright (série, courses réelles, abonnement) ; ajouter Stripe et `/asso`.
6. Mettre à jour README et CLAUDE.md ; versionner `SPEC_PROGRES.md`.
7. Trancher le sort des courses réelles, de la cantine par enfant et des allergènes.

## Plan d'action

Gel des fonctionnalités le 18 décembre 2026, lancement le 4 janvier 2027. Estimations en jours de travail d'une personne ; « Qui » : **Code** = développement (Claude Code), **Toi** = décision ou action hors code.

### Phase 0 : cette semaine (bloquants financiers et techniques)

| # | Action | Qui | Effort | Critère de terminé |
| --- | --- | --- | --- | --- |
| 0.1 ✅ 24/10 | Annuler l'abonnement Stripe (`subscriptions.cancel`) avant la suppression du foyer dans `deleteAccount` et `deleteHousehold` ; conserver les lignes comptables | Code | 0,5 | Test unitaire avec Stripe simulé ; aucun abonnement actif après suppression |
| 0.2 ✅ 24/10 | Migration créant les buckets privés `asso-kits`, `asso-statements`, `canteen-pdfs` avec leurs règles d'accès ; retirer la création à la volée | Code | 0,5 | Relevé PDF et fiche tuto générés sur le projet de développement |
| 0.3 ⏳ | `pnpm db:types` (token Supabase dans `.env.local`) ; retirer le `TODO(M1)` | Toi (token) puis Code | 0,25 | `database.types.ts` généré, typecheck vert |
| 0.4 ⏳ | Créer les secrets GitHub `SUPABASE_DEV_*` | Toi | 0,25 | CI : build et Playwright exécutés |

### Phase 1 : avant le 20 novembre (exploitation)

| # | Action | Qui | Effort | Critère de terminé |
| --- | --- | --- | --- | --- |
| 1.1 | Choisir l'hébergement ; versionner la configuration de déploiement et des trois crons (`notify`, `streak-close`, `payouts`) | Toi (choix) puis Code | 1 | Crons déclenchés en préproduction, `CRON_SECRET` vérifié |
| 1.2 | Remplacer la limitation de débit en mémoire par un magasin partagé (ou table Postgres) | Code | 1 | Test : la limite tient sur deux instances |
| 1.3 | Gabarit d'e-mail de connexion en français aux couleurs de la charte ; SMTP Resend pour l'authentification | Code | 0,5 | Lien magique reçu en français, expéditeur Fin Prêt |
| 1.4 | Masquer `current_quarter_cents` sous 5 foyers (D13) + test pgTAP | Code | 0,5 | Test pgTAP vert |
| 1.5 | Premier administrateur et TOTP ; procédure écrite | Toi | 0,25 | Accès `/admin` avec second facteur |
| 1.6 | Jouer Playwright complet (dont `progress.spec.ts`, `subscription.spec.ts`) et corriger | Code | 1,5 | Suite verte sur le projet de développement |
| 1.7 | Ajouter des tests e2e : `/asso` (tableau de bord, menus, équipe), `/admin`, import PDF ; webhooks Stripe en mode test | Code | 2 | Parcours B et C de la spec rejoués automatiquement |

### Phase 2 : avant le gel du 18 décembre (contenu, conformité, décisions)

| # | Action | Qui | Effort | Critère de terminé |
| --- | --- | --- | --- | --- |
| 2.1 | Textes juridiques (mentions, CGU, CGV avec rétractation, confidentialité, partenariat) et `COMPANY_*` | Toi (juriste) | externe | Plus aucun `TODO(juriste)` |
| 2.2 | Charte `brand/charte-fin-pret.md` (sections 8 et 9) | Toi | externe | Fichier versionné, textes alignés |
| 2.3 | Polices Gabarito et Figtree dans les PDF | Toi (fichiers ou accord de téléchargement) puis Code | 0,5 | PDF sans Helvetica |
| 2.4 | Valider la table d'allergènes (5 `TODO(spec)`) ; créer `seed/allergens.json` | Toi (validation) puis Code | 1 | Plus de `TODO(spec)` dans `allergens.ts` |
| 2.5 | Décider : cantine par enfant (retrait ou maintien), courses réelles (pilote ou report) | Toi | 0 | Décisions notées dans `RECAP_JANVIER.md` |
| 2.6 | Si courses réelles retenues : vérifier les écrans dans un navigateur, « retirer le repas non commencé », puis activer pour un foyer pilote | Code | 3 | Parcours L1 à L4 joués, drapeau activé par foyer |
| 2.7 | Si cantine par enfant retirée : `householdCanteen = false` et adapter `canteen.spec.ts` | Code | 0,5 | Suite verte |
| 2.8 | Test de restauration (`RESTAURATION.md`) | Toi | 0,5 | Compte rendu daté |
| 2.9 | Audit Lighthouse et axe sur parcours A et B ; vérifier `/design-system` en production | Code | 0,5 | SEO ≥ 95, accessibilité ≥ 90 |

### Phase 3 : documentation (en continu, 1 jour au total)

- Réécrire `README.md` (CI sans Docker, crons, Stripe, `IBAN_ENCRYPTION_KEY`, hook pre-push).
- Mettre à jour la « Structure cible » de `CLAUDE.md`.
- Versionner `SPEC_PROGRES.md` dans `docs/`.
- Écrire les processus métier : validation d'une association (délai, motifs de refus), support, échec de webhook Stripe, reversements et remboursements, demandes RGPD (aligner la suppression sur les 30 jours de la spec ou documenter l'immédiat).

### Phase 4 : bêta et lancement

| Date | Jalon |
| --- | --- |
| 18 décembre | Gel : seules des corrections ensuite |
| Mi-décembre | Bêta fermée de 20 foyers (J9), nom de l'école pilote fourni |
| 2 janvier 2027 | Stripe en mode réel (`pnpm stripe:setup` avec clés réelles, webhook de production) |
| 4 janvier 2027 | Lancement |

### Risques du plan

- **Dépendances externes** (juriste, charte, polices, choix d'hébergement) : les lancer cette semaine, elles ne se compressent pas.
- **Décision courses réelles** : sans verdict d'ici début décembre, la reporter après le lancement.
- **Hook pre-push lent** : prévoir 5 à 10 minutes par push.

## Journal des changements depuis l'audit initial

- Panneau `WeekOpsPanel` (déjà commencé / préparé, réaffectation) branché sur l'écran Courses.
- Correctif `markPreparation` sur semaine sans identifiants persistés.
- `progress_viewed` émis depuis la fin de session.
- Constat : toutes les migrations étaient déjà appliquées à la base de développement.
- Commit `4b0fc1d` poussé (74 fichiers).
- 24/10 : phase 0.1 et 0.2 faites. 0.3 bloquée : `SUPABASE_ACCESS_TOKEN` vide dans `.env.local`. 0.4 : secrets GitHub à créer par toi.
