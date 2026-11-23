---
type: "Règle métier"
title: "Anti-répétition, budget et repli"
description: "Comment le moteur évite de reproposer les mêmes recettes, tient le budget, et quelles règles il relâche quand aucune semaine ne convient."
tags: ["menu", "budget"]
status: "stable"
finpret:
  code: ["src/engine/compose.ts#generateWeek", "src/engine/compose.ts#compose", "src/engine/compose.ts#budgetOf"]
  defaults:
    noRepeatWeeks: 3
    PRICEY: 1.6
---

# Anti-répétition, budget et repli

## Anti-répétition
- Les recettes (plats, soupe, soirs simples) des `noRepeatWeeks` dernières semaines (2 à 6, défaut 3) sont exclues.
- Une recette aimée (« à refaire », « aimée des enfants ») peut revenir plus tôt, mais jamais deux semaines de suite.

## Budget
Si le foyer a un budget hebdomadaire et que les prix sont connus :
- une recette dont la portion coûte plus de 1,6 fois la cible par portion passe en fin de tirage (sans être exclue) ;
- une semaine dont le coût estimé dépasse le budget est rejetée, mais la moins chère est gardée de côté.

## Repli, dans l'ordre
1. Anti-répétition complète.
2. Exclusion de la semaine précédente seulement, puis aucune exclusion.
3. Abandon de l'objectif de recettes du monde (voir [équilibre des plats](/regles/equilibre-plats)).
4. Si seul le budget bloque : la semaine la moins chère trouvée est proposée, signalée hors budget.
5. En dernier recours : les recettes refusées par le foyer redeviennent possibles (signalé à l'utilisateur).
6. Sinon : génération impossible.
