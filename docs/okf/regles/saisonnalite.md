---
type: "Règle métier"
title: "Saisonnalité"
description: "Quand une recette est proposable selon le mois, ses variantes de saison et le garde-manger, et comment le tirage est pondéré."
tags: ["menu", "saison"]
status: "stable"
finpret:
  code: ["src/engine/season.ts#eligible", "src/engine/season.ts#resolve", "src/engine/season.ts#wshuffle"]
  seed: ["seed/notSeasonal.json"]
---

# Saisonnalité

Le mois retenu est celui du lundi de la semaine.

## Recette proposable
- Une recette sans `months` est proposable toute l'année ; sinon seulement les mois listés.
- Exception : si **tous** ses légumes saisonniers sont au garde-manger, elle reste proposable hors saison (rien n'est gaspillé).
- Légume saisonnier : ingrédient du rayon légumes absent de `notSeasonal.json` (citron, banane, pomme… n'en sont pas). Voir les [ingrédients](/ingredients/index).
- Une recette à variantes (`sv`) doit avoir au moins une variante valable ce mois-là (ou couverte par le garde-manger).

## Variante retenue
Celle dont les légumes sont au garde-manger, sinon celle du mois, sinon la première. Ses ingrédients remplacent ou complètent ceux de la recette, ses étapes s'ajoutent.

## Tirage pondéré
Parmi les recettes proposables, le tirage favorise :
- les recettes qui utilisent le garde-manger (1 point par ingrédient de viande, de frais ou de légumes en stock, 0,3 sinon, plus un bonus pour les ingrédients à date courte) ;
- les plats notés « à refaire » et « aimé des enfants » ; il espace les plats jugés « trop longs ».

Une recette refusée par le foyer n'est jamais tirée, sauf en dernier [repli](/regles/anti-repetition-et-repli).
