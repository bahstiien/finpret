---
type: "Règle métier"
title: "Structure de la semaine"
description: "Comment la semaine est découpée en créneaux : plats de la session, soirs légers (soupe, soirs simples) et repas de la réserve."
tags: ["menu", "session"]
status: "stable"
finpret:
  code: ["src/engine/slots.ts#buildSlots"]
  settings:
    light: "0 à 4, défaut 2"
    bankUse: "0 à 4, défaut 2 (0 sans congélateur)"
    weekendBatch: "défaut non"
---

# Structure de la semaine

Le moteur part des créneaux du lundi au vendredi (du lundi au dimanche si le réglage « Inclure le week-end dans la session » est actif), midi et soir, moins les créneaux décochés par le foyer.

## Soirs légers
- Le réglage `light` fixe le nombre de soirs légers, pris dans l'ordre mardi, jeudi, mercredi, vendredi, lundi.
- Avec au moins 2 soirs légers, les 2 premiers sont une même [soupe](/recettes/soupes/index), servie deux soirs.
- Les autres soirs légers sont des [soirs simples](/recettes/soirs-simples/index), préparés le soir même (pas pendant la session).

## Réserve du congélateur
- `bankUse` repas viennent de la réserve (plats congelés les semaines précédentes), placés dans l'ordre vendredi midi, jeudi midi, vendredi soir, jeudi soir, mercredi midi…
- La plus ancienne congélation sort en premier.

## Plats de la session
- Chaque [plat de la session](/recettes/plats/index) couvre un dîner et le déjeuner du lendemain (le dernier soir enchaîne sur le lundi midi).
- Les midis restants sont rattachés aux plats existants, puis regroupés deux par deux.
- Le même plat n'est jamais servi midi et soir le même jour, sauf s'il n'y a pas d'autre solution.
- Les plats sont répartis selon leur [conservation](/regles/conservation) et doivent respecter l'[équilibre des plats](/regles/equilibre-plats).
