# Données de départ (seed)

Exportées depuis le prototype (`reference/menu-legacy.html`), utilisé en conditions réelles. Les macros sont des estimations **par portion adulte** : `m = [kcal, protéines g, glucides g, lipides g]`.

## ingredients.json — `{ [clé]: Ingredient }`
| Champ | Sens |
|---|---|
| `l` | Libellé affiché (« Pâtes complètes ») |
| `u` | Unité : `g`, `ml`, `pc` (pièce), `boite` (conserve), `cs` (c. à soupe), `cc` (c. à café) |
| `c` | Rayon : voir `aisles.json`, plus `base` = placard (huile, épices, sel…), non acheté par défaut |
| `n` | Pour `pc` : `[singulier, pluriel]` (« courgette », « courgettes ») |
| `showN` | Afficher le nom dans la quantité (« 1 sachet de levure ») |
| `s` | Suffixe (« de 400 g ») |
| `half` | Autorise les demi-unités (½ citron) |

## aisles.json — `[[clé, libellé]]`, dans l'ordre des rayons

## packs.json — contenants standard du commerce
`{ [ingrédient]: { s: [tailles], l: "barquette", tol?: 0.2 } }`. Voir SPEC §7.4.

## notSeasonal.json
Ingrédients du rayon légumes **non soumis** à la saisonnalité (citron, banane, pomme…).

## mains.json — plats à préparer pendant la session
| Champ | Sens |
|---|---|
| `id`, `n` (nom complet), `s` (nom court), `d` (description) | Identité |
| `o` | Origine : code pays ISO 3166 en minuscules (`fr`, `it`, `mx`…) |
| `p` | Protéine : `volaille`, `boeuf`, `porc`, `poisson`, `veg` |
| `grp` | Famille (`curry`, `lasagnes`, `tarte`, `frittata`, `risotto`…) : 2 plats d'une même famille ne cohabitent pas dans une semaine |
| `pasta`, `comfort` | Plat de pâtes, plat réconfort |
| `oven` | Utilise le four pendant la session |
| `fridge` | Jours de conservation au frigo après la session (le dimanche = jour 0) |
| `freeze` | Se congèle |
| `months` | Mois de disponibilité (1-12) ; absent = toute l'année |
| `sv` | Variantes saisonnières : `[{ m: mois, l: libellé, ing: {...}, prep: [...] }]` fusionnées dans la recette (SPEC §7.2) |
| `ing` | `{ [clé ingrédient]: quantité pour 4 portions adultes }` |
| `prepMin`, `prep` | Préparation (minutes, étapes) |
| `blocks` | Étapes de cuisson : `{ mode, active, passive, wait?, a: [textes] }`. `mode` ∈ `feu`, `four`, `airfryer`, `micro`, `blender`, `mixeur`, `robot`, `plan`; `active` = minutes de travail, `passive` = minutes d'attente ; `wait:false` = peut chevaucher le bloc précédent |
| `box` | Conditionnement (« curry seul, riz à part ») |
| `jj` | Consigne du jour du repas (cuisson du féculent, réchauffage) |
| `kid` | Tâche pour l'enfant (facultatif) |
| `cz` | Indication de congélation (facultatif) |

Les textes contiennent des **placeholders** `{clé}` remplacés par la quantité formatée et mise à l'échelle (SPEC §7.4).

## soups.json — soupes du soir (même format que `mains`, sans `oven`)
## simples.json — soirs simples cuisinés le jour même
`{ id, n, s, o, m, ing, steps, months?, pasta?, comfort? }`
## cakes.json — goûters
`{ id, n, t (gateau | brioche | biscuit | crepe), tm (durée), parts, months?, m, kid, ing, steps }`
## breakfasts.json — petits-déjeuners
`{ n, d, t (sucre | sale), m: [kcal, protéines] }` (pas d'`id` : en générer un à l'import)
