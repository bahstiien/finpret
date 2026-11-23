---
type: "Règle métier"
title: "Quantités et contenants"
description: "Mise à l'échelle des ingrédients, arrondi aux contenants du commerce, liste de courses et restes au garde-manger."
tags: ["courses", "quantites"]
status: "stable"
finpret:
  code: ["src/engine/quantities.ts", "src/engine/format.ts#snapNum", "src/engine/format.ts#packBest"]
  seed: ["seed/packs.json", "seed/ingredients.json"]
---

# Quantités et contenants

## Mise à l'échelle
Quantités de la recette × portions du repas / 4 (voir [portions du foyer](/regles/portions)). Le gâteau du goûter est préparé une fois, sans mise à l'échelle.

## Arrondi aux contenants
- Pour un ingrédient vendu en contenants standard (`packs.json`, 1 ou 2 formats), la quantité d'une recette est ramenée à la combinaison de 1 à 4 contenants la plus proche, si l'écart reste dans la tolérance (`tol`, 20 % par défaut). Sinon elle est gardée telle quelle.
- Une conserve (`boite`) compte au moins 1 boîte, arrondie à l'unité.
- À l'achat, le moteur prend la plus petite combinaison de contenants couvrant au moins 97 % du besoin.

## Liste de courses
- Besoin = total de la semaine − stock du garde-manger. Un ingrédient marqué « assez » au garde-manger est couvert.
- Les ingrédients du rayon `base` (placard : huile, épices, sel…) ne sont pas achetés par défaut. Voir les [ingrédients](/ingredients/index).

## Restes après la session
- Restes = acheté + stock − utilisé, arrondis (à 10 g ou 10 ml près, à la demi-unité si l'ingrédient l'autorise, sinon à l'unité inférieure).
- Ils restent au garde-manger au-dessus d'un seuil : 30 g ou 10 % du plus petit contenant, 1 unité sinon. En dessous, l'ingrédient sort du garde-manger.
- Les restes du garde-manger favorisent ensuite les recettes qui les utilisent (voir [saisonnalité](/regles/saisonnalite)).
