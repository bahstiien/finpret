# Récapitulatif — Courses réelles, lot L1 (en cours)

## Fait
- `src/engine/purchases.ts` : unités structurées, journal append-only (idempotence, révision, solde non négatif), couverture (partiel, surplus, à vérifier, « assez » borné), contenants à 100 %, `removableMenuKeys`.
- `supabase/migrations/20261030000000_purchase_events.sql` : journal isolé par foyer, insertion réservée aux éditeurs, ni modification ni suppression côté client. Test pgTAP `11_purchase_events_rls`.
- `src/server/actions/purchases.ts` : `recordPurchase` et `setPurchasedTotal` (Zod, rôle, limitation de débit, clé d'idempotence, révision).
- `src/server/shopping.ts` : une ligne dont un achat est enregistré n'est plus supprimée par le recalcul.
- Drapeau `FEATURES.realPurchases` (false) : rien n'est actif tant qu'un foyer pilote ne l'a pas activé.

## Ajouté ensuite (arbitrages appliqués)
- Droit `purchases` gratuit (D-01) et hors quota de changements (D-02) dans `entitlements`, avec test.
- `shoppingNeeds` (engine) : besoin numérique par ingrédient ; `src/server/purchases-view.ts` : besoin, acheté, reste, surplus, « Quantité à confirmer » pour une ancienne coche sans achat (AC-16), contenants à 100 % pour les lignes à achats réels uniquement.
- Écran Courses : bloc besoin/acheté/reste par ligne, formulaire « Total acheté » ou « Ajouter un achat », rafraîchissement temps réel, lecture seule hors ligne. Actif seulement avec `FEATURES.realPurchases`.

## Fin de L1
- Migration `shopping_issues` + test pgTAP 12 ; actions `reportShoppingIssue` / `clearShoppingIssue` (« Introuvable », « Je chercherai ailleurs », « Je n'en achèterai pas davantage », « Je l'ai trouvé »). Un signalement ne touche ni achat ni menu.
- La coche d'une ligne gérée enregistre la quantité suggérée quand elle est fiable (contenants), sinon ouvre la saisie (§8.1).
- « Vérifier mes courses » : `reviewSummary` (testé) ; jamais de « menu prêt » tant qu'un manque ou une quantité à confirmer reste.
- « Ne plus acheter » est enregistré mais n'agit qu'en L3 (propositions) ; « préparations à résoudre » est dit « ingrédients à résoudre » tant que L2 n'existe pas.

## Lot L2 (occurrences, allocations, verrouillage)
- `engine/occurrences.ts` : identité stable `uid` par préparation (champ optionnel du plan, posé par `ensureOccurrenceIds`, conservé par les remplacements), besoin par occurrence (somme = `totals`, vérifié sur 6 semaines générées), `changedOccurrences`, `lockedUids`.
- `engine/allocation.ts` : allocation stock puis achats, verrouillées d'abord, départage rang puis identifiant ; écart isolé sur allocation figée (AC-20) ; `stockPerWeek` (AC-11, AC-25).
- `totals` factorisé via `scaleIngredients` (comportement identique, tests de parité verts).
- Migration `20261101000000_preparations_coverage.sql` : `preparation_states` (protection individuelle, sans retour en arrière) et `coverage_confirmations` ; test pgTAP 13. Poussée sur le projet hébergé de développement, comme les deux précédentes.
- Serveur (derrière `FEATURES.realPurchases`) : `editWeek` refuse toute modification touchant une préparation verrouillée (AC-10) ; la régénération complète est refusée si une préparation est protégée ; la session démarrée verrouille toute la semaine (§14) ; le stock vu par une semaine exclut ce que les précédentes réservent ; actions `markPreparation` et `confirmCoverage` ; bouton « Confirmer que j'en ai assez ».
- Choix : le verrouillage d'une session est dérivé de `sessions.started_at` (pas de copie à écrire dans le RPC `session_start`) ; l'allocation gelée est donc recalculée depuis un plan qui ne peut plus changer, et les écarts (AC-20) sont calculés à la volée plutôt que stockés (`resource_discrepancies` non créée).

## Écarts et reste à faire
- Interface non vérifiée dans un navigateur (drapeau désactivé, pas de Supabase local).
- `packBest` garde sa tolérance de 97 % (parité avec le prototype) ; `recommendPacks` (100 %) n'est utilisé que dans la vue des achats réels.
- Migration non poussée sur Supabase hébergé.
- La vérification de révision et l'écriture ne sont pas dans une seule transaction SQL : deux écritures simultanées sur des clés différentes peuvent passer la même révision. À fermer au lot L4 (fonction SQL transactionnelle).
- L2 : pas d'écran « Déjà commencé / préparé » (action serveur seulement) ; la RLS laisse encore un membre modifier `weeks.plan` directement (écritures directes à fermer en L4) ; les transferts entre semaines (AC-23, `transfer_*`) ne sont pas exposés en action.
- Lots L3 à L6 et arbitrages du §25 non traités.
