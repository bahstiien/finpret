# Retours rapides sur les repas

Facultatifs, un tap, sur chaque carte de « Plats de la semaine ». Aucun questionnaire : rien n'est demandé tant que le foyer ne touche pas un bouton.

| Bouton | Stockage (`ratings`) | Effet sur le tirage (`feedbackBias`, clé de tri, plus petit = plus tôt) |
|---|---|---|
| À refaire (👍, ex-favori) | `value = 1` | −0,7 |
| Aimé des enfants | `kids_liked` | −0,4 |
| Trop long | `too_long` | +0,8 (espacé, jamais exclu) |
| Ne plus proposer (👎) | `value = -1` | exclu du tirage (inchangé) |

- Goût et temps sont indépendants : « trop long » ne touche pas au goût. Un plat à la fois « à refaire » et « trop long » reste légèrement favorisé (−0,7 + 0,8 ≈ neutre) : il revient, mais pas plus souvent qu'un autre.
- Corriger un avis : retoucher le bouton le retire (`toggleFeedback`). Un refus efface « aimé des enfants » ; aimer un plat refusé lève le refus.
- Priorité des contraintes : régime, allergies et ingrédients refusés filtrent le catalogue dans `createEnv`, avant tout poids. Les signaux ne font que trier ce qui reste (test dans `src/engine/feedback.test.ts`).
- Variété : un plat aimé ne revient jamais deux semaines de suite (les deux semaines les plus récentes le bloquent) ; avant, un favori était exempté de toute la fenêtre `noRepeatWeeks`.
- Les poids restent sous la dispersion de l'aléa (1) et du garde-manger : c'est un coup de pouce, pas un verrou.

Migration `20261111000000_ratings_feedback.sql` : `value` devient nullable, deux colonnes booléennes, deux contraintes. Compatible avec la version précédente de l'app (null = pas d'avis).

## Reste à faire / limites
- Les retours se posent depuis l'écran Menu ; il n'y a pas encore de liste « Mes avis » pour corriger un plat qui n'est plus dans la semaine.
- Interface non vérifiée dans un navigateur (pas de base locale lancée) ; seuls typecheck, lint, Vitest et pgTAP (PGlite) ont tourné.
