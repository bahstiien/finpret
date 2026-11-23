---
type: "Règle métier"
title: "Conservation et congélation"
description: "Quel plat peut être servi quel jour après la session du dimanche, selon sa durée de conservation au frigo et s'il se congèle."
tags: ["session", "conservation"]
status: "stable"
finpret:
  code: ["src/engine/slots.ts#assignGroups", "src/engine/compose.ts#fixPasta"]
  fields:
    fridge: "jours au frigo après la session, dimanche = jour 0"
    freeze: "se congèle"
---

# Conservation et congélation

Chaque [plat de la session](/recettes/plats/index) indique `fridge` (jours de conservation au frigo après la session du dimanche, jour 0) et `freeze` (se congèle).

- Un plat qui **ne se congèle pas** ne peut servir que jusqu'au jour `fridge` : avec `fridge: 2`, il peut servir lundi (1) ou mardi (2), pas jeudi (4).
- Les plats non congelables prennent les créneaux les plus proches de la session, les moins bien conservés d'abord.
- Les plats **congelables** prennent les créneaux les plus éloignés, sans limite de jour (ils passent par le congélateur).
- Si les plats tirés ne rentrent pas dans ces limites, la combinaison est rejetée et le moteur en tire une autre.
- La même limite s'applique quand le moteur permute les plats pour éviter deux repas de pâtes le même jour (voir [équilibre des plats](/regles/equilibre-plats)).
- Les portions congelées alimentent la réserve, qui revient dans les semaines suivantes (voir [structure de la semaine](/regles/structure-semaine)).
