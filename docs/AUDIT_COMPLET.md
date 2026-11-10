# Audit complet de Fin Prêt

Mis à jour le 10 novembre 2026, branche `main` @ `6dda926` (après la PR #43).
Remplace l'audit du 24 octobre (avant la migration Postgres) et `AUDIT_ECART_JANVIER.md` (photo du 20 octobre, périmée).

**Méthode** : relecture du code de `main` (drapeaux de `src/lib/features.ts`, marqueurs `TODO(spec)` et `TODO(juriste)`, tests de bout en bout, CI) et des branches locales non fusionnées.
**Non vérifié pour cet audit** : exécution des tests, interface dans un navigateur, production.

## 1. Fonctionnalités codées mais éteintes

| Sujet | État | Reste à faire |
| --- | --- | --- |
| Paiement en ligne (`onlinePayment: false`) | Stripe Checkout, portail, webhook idempotent, reversements et clôture trimestrielle codés et couverts par des tests unitaires. Offres affichées avec « Prochainement ». | Aucun test de bout en bout de Checkout. `pnpm stripe:setup` en mode réel le 2 janvier, webhook de production. Décider de la date d'ouverture. |
| Connexion Google (`googleSignIn: false`) | Bouton affiché avec « Prochainement ». | Identifiants OAuth de production, puis activer. |
| Parcours associations (`associations: false`) | `/ecole/[code]`, `/asso/*` (menus, équipe, kit, relevés, IBAN), back-office des associations livrés, masqués. | C'est le cœur du modèle économique (J6, J7) : décider de l'ouverture, nom de l'école pilote à fournir (J9). |
| Courses réelles (`realPurchases: false`) | Lots L1 à L4 codés, panneau « Où j'en suis ». | Écrans jamais vérifiés dans un navigateur ; pas d'action « retirer le repas non commencé » ; L5 (temps réel, mesures) et L6 (pilote) non traités. Décision : pilote ou report. |
| Autres fonctions REPORTÉES | 9 drapeaux à `false` : Apple, rôle `viewer`, étape « habitudes » de l'onboarding, garde alternée, congélateur et restes, import de recettes, session partagée, écriture hors ligne, rappels courses et session. | Code à maintenir sans usage ; retirer ce qui ne reviendra pas après le lancement. |
| Cantine | Cantine par enfant (`householdCanteen: true`) coexiste avec les menus d'école publiés (ces derniers ont la priorité). | Trancher : retrait (adapter `canteen.spec.ts`) ou maintien comme repli. |

## 2. Contenu et conformité

| Sujet | État | Reste à faire |
| --- | --- | --- |
| Allergènes | `src/engine/catalog/allergens.ts` : 5 `TODO(spec)` (saucisse, galette, chocolat, bouillon, curry) + entrées ajoutées avec les recettes de saison non validées. Allergènes des ingrédients ajoutés par le foyer ignorés (`derive.ts`). | Validation éditoriale (sécurité alimentaire). |
| Petits-déjeuners | Texte libre, sans régime ni allergènes (`rows.ts`) : ils disparaissent dès qu'un filtre est actif. | Structurer leurs ingrédients ou renseigner régime et allergènes. |
| Pages légales | Mentions légales, CGU et CGV rédigées (PR #31). **Confidentialité** et **Partenariat associations** affichent encore `TODO(juriste)`. | Textes à fournir ; la politique de confidentialité est obligatoire (RGPD) avant l'ouverture. |
| Suppression de compte | Immédiate (`deleteAccount`, abonnement Stripe résilié d'abord) ; la spec prévoit 30 jours. | Aligner sur la spec ou documenter le choix de l'immédiat. |
| Charte | `brand/charte-fin-pret.md` absente. | À fournir. |
| Polices des PDF | Helvetica (`tuto-pdf.tsx`). | Embarquer les polices de la marque. |
| Support | Délai de réponse non fixé (`fr.ts`, texte provisoire). | Fixer un engagement. |
| Limites métier | 5 foyers par compte, 10 personnes par foyer, 30 imports par mois, alerte courses à 9 h : propositions en `TODO(spec)`. | Validation PO. |
| Accueil | Prénom affiché (membre lié au compte ou profil) : `TODO(spec)` §16 Q2. | Décision PO. |

## 3. Risques techniques

1. **Limitation de débit en mémoire** (`src/server/rate-limit.ts`) : compteur par processus, remis à zéro à chaque déploiement. Protège le lien magique, `/ecole/[code]`, les prospects et la création d'association. Une table Postgres suffirait.
2. **`current_quarter_cents` non masqué sous 5 foyers** (`20261028100000_associations.sql`) : écart avec D13, un montant de 8 € révèle un abonnement.
3. **Import PDF des menus d'école** : tout arrive dans « Plat » (pas de découpage entrée / plat / accompagnement), PDF source non conservé.
4. **Test de restauration** (`RESTAURATION.md`) jamais joué : à faire avant le 18 décembre.

Corrigés depuis l'audit du 24 octobre : résiliation Stripe à la suppression, buckets de fichiers (remplacés par le disque, `src/server/files.ts`), types de la base générés (`pnpm db:types`), e-mails en français au design Néo envoyés par Brevo, déploiement versionné (`deploy/`, crons `notify`, `streak-close`, `payouts`), CI qui joue pgTAP, build et Playwright sans secret.

## 4. Tests

- **Sans test de bout en bout** : `/admin` (dont TOTP), espace `/asso` hors inscription et import de menus, Stripe Checkout, articles hors menu (courses), suggestions de recettes des utilisateurs et `/admin/recettes`, `/admin/usage`, budget de la semaine.
- **Branches locales non fusionnées** : `fix-progress-e2e-date` (1 commit, test « Nos progrès » indépendant du jour) et `gouters-150` (4 commits : 150 goûters, `main` en a 47).

## 5. Documentation et processus

| Élément | État |
| --- | --- |
| `RECAP_JANVIER.md`, `AUDIT_ECART_JANVIER.md` | Datés du 20 octobre, parlent encore de Supabase et d'Edge Functions : à mettre à jour ou archiver. |
| `README.md` | Décrit une CI Docker/Mailpit et cite Apple et l'import comme actifs. |
| `CLAUDE.md` | Compte de goûters (47) à mettre à jour si `gouters-150` est fusionnée. |
| Processus métier non écrits | Validation d'une association (délai, motifs de refus), échec de webhook Stripe, reversements et remboursements, demandes RGPD. |

## 6. Ordre de priorité

Gel des fonctionnalités le 18 décembre 2026, lancement le 4 janvier 2027. « Qui » : **Code** = développement (Claude Code), **Toi** = décision ou action hors code.

| # | Action | Qui | Critère de terminé |
| --- | --- | --- | --- |
| 1 | Valider la table d'allergènes ; renseigner les petits-déjeuners | Toi puis Code | Plus de `TODO(spec)` dans `allergens.ts` |
| 2 | Textes Confidentialité et Partenariat | Toi (juriste) | Plus aucun `TODO(juriste)` |
| 3 | Décider de l'ouverture : paiement, Google, associations | Toi | Drapeaux fixés pour le lancement, décision notée ici |
| 4 | Si paiement ouvert : Stripe en mode test de bout en bout, puis réel le 2 janvier | Code puis Toi | Abonnement payé, webhook reçu en production |
| 5 | Test de restauration | Toi | Compte rendu daté dans `RESTAURATION.md` |
| 6 | Limitation de débit en table Postgres ; masquer `current_quarter_cents` sous 5 foyers | Code | Tests unitaire et pgTAP verts |
| 7 | Fusionner `fix-progress-e2e-date` et `gouters-150` | Code | Branches fusionnées, CI verte |
| 8 | Tests e2e : `/admin`, `/asso`, articles hors menu, suggestions, budget | Code | Parcours joués en CI |
| 9 | Trancher courses réelles et cantine par enfant | Toi | Décisions notées ici |
| 10 | Mettre à jour README, `RECAP_JANVIER.md` ; écrire les processus métier | Code et Toi | Docs à jour |
