---
type: "Règle métier"
title: "Équilibre des plats"
description: "Contraintes de composition d'une semaine : protéines, four, pâtes, familles, plats réconfort, végétarien et recettes du monde."
tags: ["menu", "composition"]
status: "stable"
finpret:
  code: ["src/engine/compose.ts#fits", "src/engine/compose.ts#completeMains", "src/engine/compose.ts#fixPasta", "src/engine/env.ts#effectiveSettings"]
  defaults:
    proteinCaps: { volaille: 2, boeuf: 1, porc: 1, poisson: 1, veg: 2 }
    ovenMax: 2
    pasta: 2
    comfort: 1
    world: 2
    minVeg: 0
---

# Équilibre des plats

S'applique aux [plats de la session](/recettes/plats/index), tirés dans l'ordre : plats réconfort, puis plats de pâtes, puis le reste.

## Plafonds (réglables par foyer)
- **Protéines** : nombre maximal de plats par protéine (`p` : volaille, bœuf, porc, poisson, végétarien). Pour un foyer végétarien ou pescétarien, le plafond végétarien est levé.
- **Four** : au plus `ovenMax` plats utilisant le four pendant la session.
- **Pâtes** : au plus `max(3, pasta)` plats de pâtes.
- **Famille** (`grp` : curry, lasagnes, tarte…) : jamais deux plats de la même famille dans la semaine.

## Minimums
- **Pâtes** : au moins `pasta` plats de pâtes (au plus le nombre de plats moins 1). Ce minimum est relâché d'un cran à chaque échec.
- **Végétarien** : au moins un plat végétarien dès 4 plats, et au moins `minVeg`.
- **Réconfort** : `comfort` plats réconfort par semaine (0, 1, 2, ou 1 toutes les 2 semaines), partagés entre plats et soirs simples.
- **Monde** : au moins `world` recettes d'origine autre que la France (`o` ≠ `fr`) parmi plats, soupe et soirs simples. Objectif abandonné en [repli](/regles/anti-repetition-et-repli).

## Pâtes le même jour
- Jamais deux repas de pâtes le même jour (soupe, soirs simples, réserve et week-end compris) : le moteur permute les plats dans la limite de leur [conservation](/regles/conservation), puis les jours des soirs simples.
- Lors d'une modification à la main, un changement qui crée un tel jour déclenche un avertissement ; un conflit déjà présent ne compte pas.
