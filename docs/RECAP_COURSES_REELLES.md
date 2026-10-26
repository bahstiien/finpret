# Récapitulatif — Courses réelles, lots L1 à L4 (drapeau `realPurchases` éteint)

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

## Lot L4 (écritures atomiques, conflits)
- Migration `20261103000000_purchase_rpc.sql` (poussée) : `record_purchase` et `transfer_purchase` en SQL, sous verrou de la semaine : idempotence, révision et solde non négatif vérifiés dans la même transaction que l'écriture. Plus d'insertion directe dans `purchase_events`. Test pgTAP 11 réécrit (15 assertions : replay, clé réutilisée, révision périmée, correction sous le transféré, transfert atomique, lecture seule, autre foyer).
- `recordPurchase` / `setPurchasedTotal` appellent la fonction SQL ; nouvelle action `transferPurchase` (§9.6, AC-23). Le moteur `appendEvent` reste la référence testée de la règle, plus appelée par l'action.
- Menu : sous le drapeau, l'écriture du plan est conditionnée à `weeks.updated_at` lu avec le contexte ; un autre appareil qui a écrit entre-temps n'est pas écrasé (message « Le menu a changé sur un autre appareil »).
- `grid.test.ts` : délai porté à 30 s (échec intermittent sous charge, test CPU pur).

## Lot L3 (résolution) et annulation
- `engine/adaptation.ts` : `propose` (pur, déterministe) remplace une préparation non verrouillée par une recette du catalogue du foyer (déjà filtré par régime, allergies, refus ; saison, frigo, pâtes, plafonds `completeMains`). Classement §12 (manques résolus sans achat, ingrédients ajoutés, préparations modifiées, achats réutilisés par couverture, durée, préférences, identifiant), 3 propositions au plus, budget de 200 évaluations avec indicateur `limited`, paires évaluées globalement (pas de double réclamation du stock), « ne plus acheter » rejette tout candidat qui exige un complément (AC-24). 7 tests.
- Migration `20261104000000_adaptations.sql` (poussée) : `adaptation_previews` (15 min), `adaptation_events`, fonctions `commit_adaptation` et `undo_adaptation` : plan, journal et aperçu consommé dans une seule transaction ; refus si empreinte, version de la semaine, révision d'achats ou verrouillage ont changé (AC-08, AC-13, AC-18). Test pgTAP 14 (12 assertions).
- `server/actions/adaptation.ts` : `previewAdaptation` (30 aperçus/min/foyer, 20 manques max), `commitAdaptation` (empreinte recalculée, proposition revérifiée par le moteur sur les données actuelles), `undoAdaptation` (refusée si la préparation a changé ou est verrouillée ; les achats récents sont conservés).
- Écran : panneau « Adapter mon menu » (choix des manques, propositions avec impact, « Appliquer ces changements », historique avec « Annuler »).
- Choix : aucune substitution d'ingrédient (pas de règles éditoriales validées) ; « Introuvable » + « chercher ailleurs / ne plus acheter » alimentent la recherche. Aucun objectif souple n'est relâché (`relaxed` toujours vide). Durée = prép. + temps actif des blocs (pas de recalcul complet de la session).

## Complément L4/L5
- Migration `20261105000000_plan_guard.sql` (poussée) : déclencheur sur `weeks.plan` qui refuse (`preparation_locked`) toute écriture, même directe, qui change une préparation verrouillée (recette, repas servis, repas retirés, convives) ; verrou = session démarrée (toutes les préparations à `uid`) ou `preparation_states`. Les plans sans `uid` ne sont pas concernés (comportement ancien inchangé). Test pgTAP 15 (8 assertions). Ferme le contournement par client modifié signalé plus haut.
- Indicateurs §23 : `purchase_recorded`, `purchase_quantity_corrected`, `shopping_issue_reported`, `adaptation_previewed`, `adaptation_no_verified_candidate`, `adaptation_committed`, `adaptation_undone`, `adaptation_conflict`, `shopping_review_completed` ; propriétés numériques ou énumérées seulement (jamais de libellé, d'allergie ni de repas).
- Export RGPD : achats, signalements, préparations protégées, confirmations et adaptations ajoutés ; la suppression d'un foyer les supprime en cascade.
- Panneau « Adapter mon menu » : quand rien n'est trouvé, « Garder mon menu » et lien vers les recettes.

## Écarts et reste à faire
- Interface non vérifiée dans un navigateur (drapeau désactivé, pas de Supabase local).
- `packBest` garde sa tolérance de 97 % (parité avec le prototype) ; `recommendPacks` (100 %) n'est utilisé que dans la vue des achats réels.
- Migration non poussée sur Supabase hébergé.
- L2 : panneau « Où j'en suis » (`WeekOpsPanel`) : « Déjà commencé / préparé » et « Réaffecter » (transfert vers une semaine suivante). Écrans non vérifiés dans un navigateur.
- L3 : en l'absence de proposition, pas d'action « retirer le repas non commencé » ; remplacement limité aux plats, soupes et soirs simples (pas week-end ni goûter) ; interface non vérifiée dans un navigateur.
- L5 (temps réel de bout en bout, mesures, instrumentation), L6 (pilote) et arbitrages du §25 non traités.
