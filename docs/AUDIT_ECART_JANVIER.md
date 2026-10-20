# Audit d'écart : SPEC_JANVIER vs branche `m2-catalogue`

Date : 20 octobre 2026. Base auditée : `m2-catalogue` @ 6731e3d (M0 à M11 de la SPEC V1, 21 commits).
Vérifié : `pnpm test` → 20 fichiers, 337 tests verts. Non rejoués : lint, typecheck, Playwright, pgTAP.
Aucun code modifié ; seuls `docs/SPEC_JANVIER.md` (copie) et ce fichier sont ajoutés.

## 1. Constat global

La branche a suivi la **SPEC V1 complète (M0 à M11)**, pas SPEC_JANVIER. Elle couvre donc tout le socle « Famille » (J0 à J5 et une grande partie de J6), mais **aucune** des briques de lancement : associations, écoles, Stripe, reversements, back-office, landing associations, fiche tuto, événements d'indicateurs.
Elle contient aussi du code **REPORTÉ** par SPEC_JANVIER (§2 et §0.3), à retirer ou geler.

Écarts de terrain à connaître :
- `design-system/` et `brand/charte-fin-pret.md` n'existent pas dans le dépôt (la spec en fait des sources de vérité). Seuls `public/brand/` (logo, symbole) et un commentaire dans `globals.css` y font référence. Pas de `tokens.json`, pas de script `pnpm tokens`.
- L'application s'appelle encore `menu-de-la-semaine` (package.json, CLAUDE.md) ; `finpret.app` est le domaine cible.
- La CI utilise `supabase start` (Docker), alors que la règle projet est « pas de Docker » (mémoire). À corriger avant J9.
- Pas d'Edge Functions (`supabase/functions/` vide) : notifications via `/api/cron/notify`, import PDF côté serveur Next. La spec demande des Edge Functions `notify` et `extract-canteen-menu`.

## 2. Tableau par jalon

| Jalon | État | Détail |
| --- | --- | --- |
| **J0** socle | **Fait, avec 3 écarts** | Next 15, Tailwind 4, Supabase hébergé, PWA Serwist, CI. Manque : `design-system/tokens.json` + `pnpm tokens`, Sentry, CI sans Docker. |
| **J1** comptes | **Partiel** | Lien magique, Google, foyer, invitations, rôles, RLS + pgTAP OK. Écarts : Apple présent (REPORTÉ), rôle `viewer` présent (REPORTÉ), plafond 8 comptes (D4) et validité 7 j/usage unique à vérifier, table `events` absente. |
| **J2** catalogue | **Fait** | Migration catalogue, `pnpm seed`, `engine/catalog` + tests, `allergens.ts` proposé. Compter 184/35/25 à rejouer avec `pnpm seed`. |
| **J3** moteur | **Fait** | `src/engine/` complet, parité avec le prototype (`parity.test.ts`), grille, quantités, portions. |
| **J4** onboarding, paramétrage, `entitlements.ts` | **Partiel** | Onboarding à **5 étapes** (étape « habitudes » REPORTÉE), garde alternée présente (REPORTÉE). Paramétrage `/settings/*` fait. **`entitlements.ts` / `can()` absent**, aucun garde-fou d'offre. |
| **J5** menu, session, tablette | **Fait** | Menu complet, feuilles modales, préparation anticipée, session guidée, Wake Lock, vue tablette. Écart : session **partagée entre appareils** (M8) alors que REPORTÉ. |
| **J6** courses, garde-manger, hors ligne, **module École** | **Moitié faite** | Courses temps réel, garde-manger, hors ligne (avec file d'attente d'écriture : REPORTÉ, la spec ne veut que la lecture). **Module École absent** : voir §3. La cantine existante est par **enfant** (`canteen_menus.member_id`), pas par école. |
| **J7** Stripe, reversements, `/asso`, kit, fiche tuto, notifications, e-mails, `/admin` | **Presque rien** | Notifications Web Push + e-mail de repli Resend (M9) : faits mais types à ajuster. Tout le reste manque. |
| **J8** landing SEO, légal, impression, a11y, recette | **Partiel** | Impression A4 et a11y (axe, Lighthouse) faits. Landing `/` existe (composants `landing/`), pas `/associations`. Pas de sitemap, robots, JSON-LD, pages légales, leads. |
| **J9** bêta | Non commencé | Dépend de J7 et J8. |

## 3. Manquant (à construire)

Ordre conseillé : J1 compléments → J4 `can()` → J6 École → J7 → J8.

1. **Mesure (J1)** : table `events` + helper d'enregistrement, câblé sur `signup`, `onboarding_done`, `week_generated`, `session_started`, `session_done`, `shopping_checked`, `trial_started`, `subscribed`, `association_joined` (+ 4 événements `asso_*`).
2. **Offre (J4)** : `src/server/entitlements.ts` (`can(household, feature)`), tests, usage dans les actions serveur et l'UI ; compteur `menu.swap` 3 par semaine ; plafond de comptes par offre.
3. **Données (§7 et §8 bis)** : migrations `admins`, `events`, `schools`, `associations`, `association_schools`, `association_members`, `association_invitations`, `households.association_id/association_joined_at`, `member_schools`, `school_menus`, `canteen_notifications`, `subscriptions`, `stripe_events`, `payout_lines`, `payouts`, `admin_audit`, `association_leads`, `association_kits` ; RLS correspondantes ; fonction `association_stats()` avec masquage < 5 ; tests pgTAP pour chaque règle.
4. **École et associations (J6/J7)** : `/ecole/[code]` (cookie `fp_asso`, noindex, limitation 30/min/IP), `/ecole/[code]/comment-ca-marche`, `/asso/inscription|/|menus|kit|releves|equipe`, import PDF avec quota 8/mois, publication avec notification unique par école et semaine ISO, lien enfant ↔ école dans l'onboarding, rattachement du foyer, programme du jour alimenté par `school_menus`.
5. **Stripe (J7)** : `pnpm stripe:setup`, `createCheckoutSession`, `createPortalSession`, webhook idempotent (`stripe_events`), gestion essai 14 / 30 jours (`subscriptions`), reversements (+800, +50, lignes négatives), clôture trimestrielle planifiée (1er jan/avr/juil/oct, 03:00 Europe/Paris), relevé PDF, `/app/abonnement`.
6. **Back-office (J7)** : `/admin/*` (associations, écoles, menus, abonnements, reversements, prospects, support, journal), TOTP obligatoire, `admin_audit`, chiffrement IBAN AES-256-GCM, export CSV.
7. **Fiche tuto (J7)** : `@react-pdf/renderer`, QR code, cache Storage + `association_kits.source_hash`, version web.
8. **E-mails (J7)** : gabarits React Email dans `src/emails/` (lien de connexion, invitation, bienvenue, fin d'essai J-3/J0, paiement échoué, 4 e-mails association), désinscription en un clic.
9. **Notifications** : ajouter `canteen_published` et `trial_ending` ; vérifier idempotence `notification_log` (`user_id`, `type`, `date`) et gratuité par offre.
10. **Landing (J8)** : `/associations` et `/associations/comment-ca-marche` statiques, métadonnées, `opengraph-image`, JSON-LD (Organization, WebPage, FAQPage, BreadcrumbList), simulateur client isolé, formulaire « Recevez la présentation » avec anti-spam, `sitemap.ts`, `robots.ts`, liens internes.
11. **Transverse** : Sentry et alerte webhook, limitation de débit (connexion 5/h/e-mail, création d'asso 3/jour), export JSON et suppression de compte (export présent, suppression à vérifier), pages légales (gabarits `TODO(juriste)`), variables `.env.example` (Stripe, `IBAN_ENCRYPTION_KEY`, `SENTRY_DSN`, `APP_URL`), documentation de la sauvegarde et du test de restauration.
12. **Design system** : récupérer ou créer `design-system/` (tokens) et `brand/charte-fin-pret.md` (sections 8 et 9 : tous les textes). Sans eux, les textes de la landing (donnés tels quels dans la spec) sont réutilisables, mais pas la charte.

## 4. À retirer ou geler (REPORTÉ par SPEC_JANVIER)

Règle spec : « n'est pas développé, même partiellement ; seules les tables sont créées ». Ces éléments sont déjà codés et testés ; je recommande de les **masquer derrière un drapeau** plutôt que de les supprimer (réversible, aucun risque de régression), sauf décision contraire.

| Élément | Où | Recommandation |
| --- | --- | --- |
| M7 réserve congélateur et restes après session | table `freezer`, `engine/stock.ts`, `StockScreen`, migration sessions/stock | Masquer la réserve et les restes ; garder le garde-manger (INCLUS). |
| M8b import de recettes par lien | `engine/import/*`, `recipe-fetch.ts`, `/app/discover/import`, `recipe_imports`, fixtures | Désactiver la route et l'entrée de l'UI ; conserver le code et la table. |
| M10 cantine par enfant (saisie, URL) | `canteen_menus`, `engine/canteen.ts`, `CanteenForms`, `canteen-import.ts` | **Remplacer** par `school_menus` ; l'alerte doublon (`engine/canteen.ts`) est réutilisable telle quelle. Import par URL à retirer. |
| Session partagée entre appareils | `SessionProvider`, `server/session.ts`, `sessions` | Garder le persistant local ; couper la synchronisation. À arbitrer : le coût de retrait peut dépasser celui du maintien. |
| Écriture hors ligne avec rejeu | `lib/offline-queue.ts` | Garder la lecture hors ligne ; désactiver le rejeu. |
| Apple | `LoginForm`, `auth.ts` | Retirer le bouton. |
| Rôle `viewer` | enum `household_role`, `RoleSelect`, RLS | Masquer dans l'UI ; enum conservé. |
| Étape « habitudes » et garde alternée | `OnboardingWizard`, `engine/portions.ts`, `HouseholdForms` | Ramener à 4 étapes ; garde alternée masquée. |

## 5. Contradictions techniques à trancher

1. **Cantine** : `canteen_menus` (par membre) vs `school_menus` (par école, publié par l'association). Migration de données inutile (aucune prod), mais RLS et UI changent.
2. **Plafond de comptes** : SPEC §16 proposait 10 foyers par compte et 10 membres ; D4 dit 8 comptes. Vérifier la contrainte actuelle.
3. **Edge Functions** : la spec les cite pour `notify` et `extract-canteen-menu` ; le code utilise des routes Next + cron externe. Suggestion : garder les routes Next (déjà testées) sauf contrainte d'hébergement.
4. **CI et Docker** : voir §1.
5. **Nom du paquet et du produit** : à renommer en « Fin Prêt » (textes, manifest, e-mails).

## 6. Questions ouvertes de la spec (§12)

À signaler à chaque récapitulatif : statut juridique de l'éditeur (mentions de facture paramétrables `COMPANY_*`), nom de l'école pilote, texte de rétractation (`TODO(juriste)`).

## 7. Proposition de plan

Calendrier : aujourd'hui 20 octobre, gel le 18 décembre, soit environ 8 semaines pour J1 à J8.

1. **Sprint A (S1)** : décisions §4 et §5, `events`, `entitlements.ts`, retraits d'UI (REPORTÉ), `design-system/` et charte, CI sans Docker, Sentry.
2. **Sprint B (S2-S3)** : migrations associations, écoles, abonnements ; module École complet avec tests de la section 5.
3. **Sprint C (S4-S5)** : Stripe, reversements, `/asso`, fiche tuto, e-mails, notifications.
4. **Sprint D (S6)** : `/admin`, landing et page satellite (la landing peut partir plus tôt, en parallèle), légal, sitemap.
5. **S7-S8** : recette, a11y, Lighthouse, test de restauration, gel.
6. **Bêta et production** : janvier, mise en réel de Stripe le 2 janvier.

Les sprints A et la landing (indépendante) peuvent tourner en parallèle.

## 8. Avancement du Sprint A (20 octobre 2026)

| Chantier | État |
| --- | --- |
| Drapeaux REPORTÉS (`src/lib/features.ts`) | Fait : Apple, rôle `viewer`, étape « habitudes », garde alternée, congélateur et restes, import de recettes (page, action, partage), synchronisation de session, écriture hors ligne des courses. Code et tables conservés. Cantine par enfant laissée active (`householdCanteen`) jusqu'au remplacement par les menus d'école (Sprint B). |
| Table `events` + `trackEvent` | Fait : migration `20261027100000_events.sql` (poussée sur le projet de développement), test pgTAP, événements `signup`, `onboarding_done`, `week_generated`, `session_started`, `session_done`, `shopping_checked`. `trial_started`, `subscribed`, `association_joined` et `asso_*` suivront avec leurs fonctions. |
| `can()` (`src/server/entitlements.ts`) | Fait, testé et branché aux actions et aux écrans (Sprint B). |
| `design-system/tokens.json` + `pnpm tokens` | Fait ; `src/styles/tokens.css` généré, `tokens:check` en CI. `brand/charte-fin-pret.md` toujours absente. |
| CI sans Docker | Fait : pgTAP sur PGlite, e2e sur le projet hébergé via secrets `SUPABASE_DEV_*` (à créer dans le dépôt), build et e2e sautés sans secrets. |
| Sentry | Fait (`src/instrumentation*.ts`), actif seulement avec `SENTRY_DSN` ; sans source maps. |
| Renommage « Fin Prêt » | Fait (application, manifest, paquet). |

## 9. Suite

Les sprints B à D sont livrés : voir `RECAP_JANVIER.md` (fait, reste à faire par l'équipe, écarts, questions ouvertes).
