# Récapitulatif des jalons SPEC_JANVIER (CLAUDE.md, règle 10)

État au 20 octobre 2026, branche `m2-catalogue`. Détail de l'écart de départ : `AUDIT_ECART_JANVIER.md`.

## Ce qui est fait

| Jalon | Contenu livré | Tests ajoutés |
| --- | --- | --- |
| **J0** | `design-system/tokens.json` → `pnpm tokens` → `src/styles/tokens.css` ; CI sans Docker (PGlite + projet Supabase de développement) ; Sentry (actif avec `SENTRY_DSN`) | `design-tokens` (lit le CSS généré), `tokens:check` en CI |
| **J1** | Table `events` + `trackEvent` ; événements `signup`, `onboarding_done`, `trial_started`, `week_generated`, `session_started`, `session_done`, `shopping_checked`, `association_joined`, `menu_swap`, `canteen_pdf_import`, `asso_*` ; fonctions REPORTÉES masquées par `src/lib/features.ts` ; connexion limitée à 5 liens par heure et par e-mail | `events.test`, pgTAP 09 |
| **J2, J3** | Déjà livrés (catalogue, moteur) | inchangés |
| **J4** | Onboarding en 4 étapes (+ école de l'enfant et jours de cantine) ; `can()` (`src/server/entitlements.ts`) branché : Changer (3/semaine), Déplacer, convives, garde-manger, impression, comptes du foyer, rappels des repas, cantine (gratuite avec une association, D12) | `entitlements.test` |
| **J5** | Inchangé hors REPORTÉ (session partagée, congélateur, restes : masqués) | e2e adaptés |
| **J6** | Module École : migrations + RLS ; `/ecole/[code]` (cookie `fp_asso`, `noindex`, 30 requêtes par minute) ; rattachement du foyer, essai de 30 jours ; `/asso/inscription`, `/asso/menus` (import PDF, quota 8 par mois, validation, publication, badge « modifié ») ; notification unique par école et semaine ; programme du jour alimenté par les menus d'école | pgTAP 10 (32 tests), `associations.spec` (4 scénarios de la spec), `association-code.test` |
| **J7** | Stripe : Checkout (mensuel, annuel, coupon), portail, webhook idempotent, reversements (+800, +50, négatifs), clôture trimestrielle et relevé PDF ; espace `/asso` (tableau de bord masqué sous 5, équipe, kit, relevés, IBAN chiffré AES-256-GCM) ; fiche tuto PDF (QR décodable) et version web ; e-mails React Email ; rappel de fin d'essai J-3 et J0 ; back-office `/admin/*` (TOTP obligatoire, journal) | `stripe-webhook.test` (12), `payouts.test`, `iban.test`, `tuto.test` (PDF, QR), `rna.test`, `csv.test`, `trial.test` |
| **J8** | `/associations` et `/associations/comment-ca-marche` (statiques, JSON-LD, Open Graph généré, sitemap, robots), simulateur, formulaire de prospects (piège invisible, 3 par heure), pages légales (gabarits) ; mesure `asso_*` sans cookie | `associations-content.test`, `seo.test` ; Lighthouse : SEO 100, Performance 95 (mobile) / 100, Accessibilité 100 |

## Ce qui reste à faire par l'équipe (hors code)

1. **Secrets du dépôt GitHub** pour la CI : `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY`, `SUPABASE_DEV_DB_URL`.
2. **Stripe** : lancer `pnpm stripe:setup` avec une clé de **test** (`sk_test_…`), copier les identifiants dans `.env.local`, créer le webhook (`/api/stripe/webhook`, huit événements listés dans `src/server/stripe-webhook.ts`), puis refaire la configuration en mode réel le 2 janvier. Renseigner l'URL des conditions de vente dans Stripe (case à cocher `consent_collection`).
3. **Planificateur** (toutes les 15 minutes : `GET /api/cron/notify` ; trimestriel, 1er janvier, avril, juillet, octobre à 03:00 Europe/Paris : `GET /api/cron/payouts`, tous deux avec `Authorization: Bearer $CRON_SECRET`).
4. **Variables d'environnement** à créer : `IBAN_ENCRYPTION_KEY` (`openssl rand -hex 32`), `APP_URL`, `ALERT_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM`, `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`, `COMPANY_NAME`/`COMPANY_ID`/`COMPANY_VAT`.
5. **Premier administrateur** : après sa première connexion, insérer son identifiant dans `public.admins` (SQL Editor), puis activer le TOTP sur `/admin/mfa` (le TOTP doit être activé dans *Authentication → Providers* de Supabase).
6. **Textes juridiques** (`TODO(juriste)` : mentions, CGU, CGV avec rétractation et renonciation, confidentialité, contrat de partenariat) et **charte** `brand/charte-fin-pret.md` (sections 8 et 9) : non fournie, les textes de la spec ont été repris tels quels.
7. **Test de restauration** : procédure dans `RESTAURATION.md`, à jouer avant le 18 décembre.
8. **Polices Gabarito et Figtree dans les PDF** : Helvetica en attendant les fichiers de police (TODO(spec)).

## Écarts avec la spec

- L'import PDF des menus d'école s'exécute dans l'action serveur (route Next.js), pas dans une Edge Function `extract-canteen-menu` ; le PDF n'est pas conservé dans Storage (seuls les menus datés, à valider, le sont). Les notifications utilisent `/api/cron/notify` et non une Edge Function.
- Les champs du menu extraits d'un PDF arrivent dans « Plat » : l'éditeur les répartit à la validation (le découpage entrée / plat / accompagnement n'est pas fiable sans modèle de langage).
- Limitation de débit en mémoire (par instance du serveur) : suffisante pour freiner un abus ordinaire, à remplacer par un magasin partagé si le trafic le demande.
- `current_quarter_cents` n'est pas masqué sous 5 foyers (la spec masque les compteurs) : un montant de 8 € révèle un abonnement, sans identifier la famille.
- Le rôle `viewer`, Apple, la garde alternée, la réserve congélateur, l'import de recettes, la session partagée et l'écriture hors ligne existent toujours dans le code derrière `src/lib/features.ts` (tous à `false`).
- La cantine saisie par enfant (M10) reste active (`FEATURES.householdCanteen`) comme repli ; un menu d'école publié a toujours la priorité.
- Le test de bout en bout du back-office (TOTP) et de Stripe Checkout n'est pas automatisé (clés et second facteur) : le webhook, les reversements et la clôture sont couverts par des tests unitaires avec événements signés.

## Questions ouvertes (SPEC_JANVIER §12)

1. Statut juridique de l'éditeur : mentions de facture paramétrables (`COMPANY_*`) prêtes.
2. Nom de l'école pilote et de son association : à fournir pour la bêta (J9).
3. Rétractation de 14 jours : case à cocher Checkout prévue (`consent_collection.terms_of_service`), texte `TODO(juriste)`.
