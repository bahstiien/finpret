# Exposer une sélection du catalogue : analyse (3 novembre 2026)

## Constat chiffré (seed/*.json, comptage du 3 novembre 2026)

| Fichier | Entrées | Noms distincts |
|---|---|---|
| mains.json (plats de batch cooking) | 408 | 407 |
| soups.json | 34 | 34 |
| simples.json (dîners express) | 80 | 80 |
| cakes.json (goûters) | 47 | 47 |
| breakfasts.json | 35 | 35 |

Le chiffre annoncé sur l'accueil (« 184 repas, 35 goûters, 25 petits-déjeuners », `src/i18n/landing.ts`) ne correspond plus au seed : 522 repas (408 + 34 + 80), 47 goûters, 35 petits-déjeuners. Il vient d'un état antérieur du catalogue (commit « Ajoute 150 plats », 604 recettes). **À trancher par le produit** avant toute page qui citerait un volume ; les pages ajoutées ne citent aucun volume.

## État réel : le catalogue est déjà largement public

La couche `src/seo` publie **déjà** `/recettes/{slug}` pour toutes les recettes du seed (hors doublons de nom), 30 combinaisons de menus (`/menus/...`) et des hubs, tous au sitemap. Aucune information du seed ne marque une recette comme « validée » : il n'existe ni champ de relecture, ni statut, ni date. Les petits-déjeuners n'ont pas de page (pas d'id, pas de recette).

## Recommandation

1. **Ne pas considérer le catalogue comme un acquis SEO** : pages recettes = contenu dérivé d'un seed non relu, sans photo, dont certaines données (durées des dîners express, `activeMin` fixé à 20 pour les simples et goûters) sont des valeurs par défaut du code et non des mesures.
2. **Passer à une liste blanche** : ajouter au seed (ou à `src/seo/images.ts`) un drapeau `publish: true` posé à la main après relecture (quantités, étapes, conservation, allergènes, photo). Le sitemap, les liens et `indexable` ne retiennent que ces recettes. Les autres : `noindex`, hors sitemap, non liées (le mécanisme existe déjà pour les menus sous le seuil).
3. **Premier lot réaliste : 15 à 30 recettes** : les 15 plats utilisés dans les trois exemples de semaine (`src/seo/exemples.ts`) puis les plats de la série suivante. Critères : sans variante de saison, durée et conservation renseignées dans le seed, pas de doublon de famille (`grp`), photo disponible.
4. **Goûters et petits-déjeuners** : à reporter. Les petits-déjeuners n'ont ni étapes ni quantités ; les goûters n'ont qu'une durée en texte libre.
5. **Menus générés** : 30 combinaisons (2, 4, 6 personnes × 5 contraintes × 2 formats) ne diffèrent que par le filtre et l'échelle : risque de quasi-doublons et de cannibalisation avec les trois exemples. Les conserver indexables seulement si chacune a une raison d'être distincte ; sinon `noindex`.

## Corrigé le 3 novembre 2026

- Accueil : 521 repas distincts, 47 goûters, 35 petits-déjeuners (un test compare ces chiffres au seed).
- Menus générés : réduits à 6 (2/4/6 personnes × classique/végétarien, batch), en `noindex`, hors sitemap ; les menus « pas cher », « enfants », « rapide » et « quotidien » (critères inférés, non issus du seed) sont supprimés. Les pages indexables de menu sont les 3 exemples.
- Hubs : « en 2 heures » supprimé (durée de session non fiable) ; textes des autres hubs limités à des faits du catalogue ; ils restent `noindex` tant qu'aucun menu n'est indexable.
- Contenus retirés : durée de session estimée, « décongèle-le la veille », « se réchauffent en quelques minutes », 20 min de travail actif des dîners express (désormais `null`), CTA « gratuitement ». Le texte « le jour du repas » des recettes n'affiche plus de `{placeholder}`.
