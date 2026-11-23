---
type: "Règle métier"
title: "Portions du foyer"
description: "Calcul des portions d'un repas à partir des membres du foyer, de leur âge et de leur présence (garde alternée comprise)."
tags: ["foyer", "quantites"]
status: "stable"
finpret:
  code: ["src/engine/portions.ts#portionForAge", "src/engine/portions.ts#householdPortions", "src/engine/portions.ts#mealPd"]
---

# Portions du foyer

Les recettes sont écrites pour 4 portions adultes ; elles sont mises à l'échelle selon les portions de chaque repas (voir [quantités et contenants](/regles/quantites-et-contenants)).

## Portion d'un membre
- Adulte : 1.
- Enfant, selon l'âge au lundi de la semaine : moins de 3 ans 0,33 ; 3 à 6 ans 0,5 ; 7 à 11 ans 0,75 ; 12 ans et plus 1.
- Enfant sans date de naissance : 0,5.
- Toute portion peut être modifiée à la main ; un membre archivé ne compte plus.

## Présence
- Par défaut, chacun est présent à tous les repas.
- Des règles par jour et par repas (midi, soir) peuvent l'absenter, par exemple la cantine le midi.
- En garde alternée, une règle peut ne valoir qu'en semaine A ou B, comptées depuis une semaine de départ « A ». La règle de la semaine A ou B l'emporte sur une règle « toutes les semaines ».

## Repas modifié
Si le foyer précise les convives d'un repas (« Qui est à table ? »), les portions valent adultes + enfants × la portion moyenne des enfants du foyer (0,5 sans enfant enregistré).
