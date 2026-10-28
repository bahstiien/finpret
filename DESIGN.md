---
version: alpha
name: Fin Prêt
description: Application web progressive de planification de repas et de batch cooking pour plusieurs foyers.
colors:
  bg: "#f4f3f8"
  surface: "#ffffff"
  ink: "#17151f"
  muted: "#6b6878"
  line: "#eceaf2"
  violet: "#7a5af8"
  banana: "#ffd23f"
  green: "#1fa85a"
  blue-soft: "#dcebff"
  blue-ink: "#1f4e8c"
  pink-soft: "#ffe6ec"
  pink-ink: "#a3264a"
  yellow-soft: "#fff6d6"
  peach: "#ffe3d6"
  peach-ink: "#a33a12"
  chip: "#f1f0f5"
  violet-soft: "#ece7ff"
  violet-strong: "#4b2fc9"
  nav: "#17151f"
  on-nav: "#ffffff"
  green-soft: "#e2f5e6"
  green-ink: "#17633a"
  green-strong: "#17803f"
  cream-ink: "#7a5a00"
typography:
  display:
    fontFamily: Manrope
  sans:
    fontFamily: Manrope
rounded:
  card: 1.5rem
  sheet: 2rem
  pill: 9999px
spacing:
  "0": 0px
  "2": 2px
  "4": 4px
  "8": 8px
  "12": 12px
  "16": 16px
  "24": 24px
  "32": 32px
  "40": 40px
  "48": 48px
  "64": 64px
  "80": 80px
  "96": 96px
---

## Overview

Fin Prêt aide des foyers à planifier leurs repas et à cuisiner en lots. L'interface vise la clarté et la douceur : un titre et une action principale par écran, des teintes douces, des formes arrondies, un retour immédiat au toucher. Le texte est en français, au tutoiement, chaleureux et direct ; les pages destinées aux bureaux d'association vouvoient.

Les règles du skill `landing-page-design` priment sur SPEC §11 et sur les maquettes pour la typographie, les espacements, les rayons, les icônes et le mouvement.

## Colors

Les couleurs viennent de `design-system/tokens.json`, jamais écrites en dur dans les composants. `bg` est le fond de page, `surface` le fond des cartes, `ink` le texte, `muted` le texte secondaire, `line` les séparations discrètes.

`banana` porte l'action principale ; le texte posé dessus reste sombre dans les deux thèmes. `violet` porte le focus et les actions secondaires (`violet-soft` en fond, `violet-strong` en texte). `green` signale le succès ou la progression.

Les teintes d'état ou de catégorie vont par paires : un fond `-soft` (ou `peach`) et un texte `-ink` de la même famille. `nav` et `on-nav` forment la barre de navigation, sombre dans les deux thèmes.

Les fonds sont plats : jamais de dégradé en arrière-plan. Le seul dégradé admis est celui du texte du titre de la page d'accueil des associations.

## Themes

Le thème suit le système ; l'attribut `data-theme` sur `<html>` impose un choix manuel, mémorisé sur l'appareil. Les valeurs du frontmatter sont celles du thème clair. Sans valeur ci-dessous, le token garde sa valeur claire en thème sombre.

Les fonds sombres neutres (`bg`, `surface`, `chip`, `line`, `nav`) se limitent à #000000, #181818, #1F1F1F, #272727, #313131 et #131209. Les teintes douces (`blue-soft`, `pink-soft`, `yellow-soft`, `peach`, `green-soft`, `violet-soft`) restent des surfaces colorées sémantiques en sombre : c'est l'exception à cette liste.

| Token | Sombre |
|---|---|
| bg | #181818 |
| surface | #1f1f1f |
| ink | #f3f1f8 |
| muted | #a6a2b4 |
| line | #313131 |
| blue-soft | #1d2b44 |
| blue-ink | #a9c8f5 |
| pink-soft | #3a1d29 |
| pink-ink | #f5a3bb |
| yellow-soft | #352d14 |
| peach | #3d2419 |
| peach-ink | #f5a582 |
| chip | #272727 |
| violet-soft | #2a2345 |
| violet-strong | #c4b5fd |
| nav | #000000 |
| on-nav | #f3f1f8 |
| green-soft | #183324 |
| green-ink | #86efac |
| green-strong | #4ade80 |
| cream-ink | #ffd86b |

## Typography

Une seule famille, Manrope, pour les titres (`display`) comme pour le texte (`sans`) ; aucune autre police, aucun italique. Les graisses vont de la normale au gras : jamais plus lourd. Les tailles sont uniquement celles de l'échelle Tailwind, avec leur interligne ; une taille qui n'en est pas une se ramène au palier inférieur. Les chiffres sont à largeur fixe pour que les quantités et les durées s'alignent.

La hiérarchie descend du titre de page au titre de section, de carte, au texte puis au texte secondaire. Les titres de page passent par `PageHeader`, jamais par un titre stylé à la main. Les titres se répartissent en lignes équilibrées et le texte courant évite le mot isolé en fin de paragraphe. Les boutons principaux sont en `text-base` semi-gras, les petits boutons d'en-tête en `text-sm`.

## Layout

Les marges, espacements et gouttières n'utilisent que les paliers de `spacing` ; une valeur intermédiaire se ramène au palier inférieur. Un bouton principal a 8 px de marge verticale et 12 px de marge horizontale, avec une hauteur minimale de 44 px pour le toucher.

Sur les pages publiques, le titre et le sous-titre du hero ne dépassent pas 680 px de large, et le saut de ligne tombe là où la phrase respire.

## Elevation & Depth

La profondeur reste rare : seules la barre flottante mobile et les feuilles modales portent l'ombre `shadow-float`. Partout ailleurs, la hiérarchie vient du contraste entre `bg` et `surface`, pas de bordures dures ; une bordure entoure toute la forme ou n'existe pas.

La barre de navigation des pages publiques flotte au-dessus du contenu, compacte et centrée, sur une surface translucide floutée.

## Shapes

Les rayons suivent l'échelle Tailwind. Les cartes utilisent `card`, les feuilles modales `sheet`, les étiquettes `pill`, les boutons le rayon `xl`, les champs et lignes de liste le rayon `2xl`.

Une forme posée dans une autre, à moins de 32 px du bord, prend pour rayon celui de l'extérieur moins la marge ; si le résultat ne dépasse pas 2 px, elle reste à angle droit.

## Components

Les composants vivent dans `src/components/ui/` et s'importent depuis `@/components/ui`. Un nouveau composant y est ajouté, exporté par l'index et présenté dans la galerie `/design-system`.

Les actions passent par `Button`, `LinkButton` ou `buttonClass()` pour un lien, avec une seule action principale (`primary`) par écran ; les actions secondaires sont plus discrètes. Les boutons-icônes exigent un libellé ARIA. Les icônes passent par `Icon` et viennent toutes de Phosphor, en un seul trait.

Les surfaces passent par `Card` et sa teinte, les messages en ligne par `Callout` (annoncé aux lecteurs d'écran), les écrans vides par `EmptyState`, le chargement par `Skeleton`, les confirmations par `useToast()`.

Le focus visible est violet ; sur un aplat violet, marqué `on-violet`, il passe à `banana`.

Les pages publiques partagent `PublicHeader` (lien d'évitement et barre flottante `PublicNav`, dont la page courante porte `aria-current`) et `PublicFooter`. Une section entre dans l'écran avec `Reveal`, une phrase de fond s'allume mot à mot avec `TaglineReveal`, et `not-found.tsx` porte la page 404 de marque.

Tout mouvement suit la courbe `ease-base`, jamais celle du navigateur ; seuls `transform` et `opacity` s'animent, et les durées viennent de `design-system/tokens.json`. Avec `prefers-reduced-motion`, le déplacement devient un simple fondu.

## Do's and Don'ts

- Ne jamais écrire une couleur en dur : utiliser les tokens. Seule exception : le texte sombre sur fond `banana`.
- Ne pas écrire de `<h1 className="text-4xl …">` à la main : utiliser `PageHeader`.
- Ne pas fabriquer de bouton à la main : utiliser `Button`, `LinkButton` ou `buttonClass()`.
- Ne pas déclarer de couleur ailleurs que dans `design-system/tokens.json`, puis régénérer avec `pnpm tokens`.
- Ne pas ajouter de texte d'interface hors de `src/i18n/fr.ts`.
- Ne pas utiliser de taille, de rayon ou de marge arbitraire hors de l'échelle Tailwind et du tableau `spacing`.
- Ne pas utiliser de graisse 800 ou 900, ni d'italique.
- Ne pas utiliser d'icônes Material.
- Ne pas poser de dégradé en arrière-plan ni de bordure sur un seul côté d'une carte.
- Respecter `prefers-reduced-motion` : toute animation s'arrête ou devient un fondu.
