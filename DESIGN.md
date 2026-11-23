---
version: "2.1"
name: Fin Prêt Néo
description: Application web progressive de planification de repas et de cuisine en lots pour les familles, en néo-brutalisme.
colors:
  bg: "#fff8e7"
  surface: "#ffffff"
  chip: "#fff6d6"
  ink: "#17151f"
  muted: "#4a4658"
  line: "#17151f"
  nav: "#17151f"
  on-nav: "#fff8e7"
  violet: "#7a5af8"
  violet-strong: "#4b2fc9"
  on-violet: "#ffffff"
  banane: "#ffd23f"
  on-banane: "#17151f"
  green: "#1fa85a"
  green-strong: "#17803f"
  blue: "#4d96ff"
  pink: "#ff6b9d"
  peach: "#ff8c42"
  yellow: "#fff6d6"
  cream-ink: "#7a5a00"
  on-fill: "#17151f"
  ink-fixed: "#17151f"
  focus: "#7a5af8"
  kit-band: "#7a5af8"
  on-kit-band: "#ffffff"
  kit-offer: "#ffd23f"
  on-kit-offer: "#17151f"
  kit-annot: "#e5007e"
  on-kit-annot: "#ffffff"
typography:
  display:
    fontFamily: Archivo Black
    textTransform: uppercase
  sans:
    fontFamily: Space Grotesk
  mono:
    fontFamily: Space Mono
rounded:
  r0: 0px
  r1: 2px
  r2: 4px
  card: 4px
  sheet: 4px
  pill: 9999px
borders:
  mobile: 2px
  desktop: 3px
shadows:
  sm: 2px 2px 0 #17151f
  base: 3px 3px 0 #17151f
  lg: 5px 5px 0 #17151f
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

Fin Prêt aide les familles à planifier les repas de la semaine et à cuisiner en lots le dimanche. Le design system s'appelle « Fin Prêt Néo » (v2.1). Il est **néo-brutaliste** : aplats francs, bordures encre épaisses, ombres dures décalées, coins quasi droits, rien de flou ni de dégradé. L'énergie vient du contraste et de la couleur. Les effets n'y sont pour rien.

La clarté passe avant le style : un titre et une seule action principale par écran. Le texte est en français, au tutoiement, chaleureux, direct et jamais culpabilisant. Les pages destinées aux bureaux d'association vouvoient.

Sources de référence :
- `design-system/tokens.json` : seule source des jetons. `pnpm tokens` génère `src/styles/tokens.css`, contrôlé en CI par `pnpm tokens:check`. On ne modifie jamais `tokens.css` à la main.
- `src/styles/neo.css` : classes des primitives (`.btn`, `.card`, `.pill`, `.seg`, `.stamp`, `.faq`…).
- `docs/DESIGN_SYSTEM.md` : catalogue des composants.
- `/design-system` : galerie vivante, disponible en développement uniquement.
- Maquette d'origine : projet « Fin Prêt Néo » dans Claude Design (palette A).

Les règles de ce fichier priment sur celles du skill `landing-page-design` dès qu'elles se contredisent : rayons, ombres, polices, mouvement.

## Colors

Toutes les couleurs viennent des jetons, jamais écrites en dur.

- **Neutres.** `bg` (crème) est le fond de page. `surface` (blanc) est le fond des cartes, `chip` celui des puces et des zones calmes. `ink` porte le texte, `muted` le texte secondaire. `line` (encre) sert aux bordures et aux ombres. `nav` et `on-nav` forment la barre de navigation sombre.
- **Deux signatures.**
  - `banane` = action principale (`cta`). **Une seule action banane par écran.**
  - `violet` = sélection et mise en avant (`sel`). Le texte blanc (`on-violet`) n'y est admis qu'en 16 px gras minimum.
- **Un domaine, un aplat.** Le jeton `role` de `tokens.json` les associe ainsi :

  | Domaine | Aplat |
  |---|---|
  | `menu` | violet |
  | `courses` | vert |
  | `stock` | bleu |
  | `progres` | banane |
  | `session` | pêche |
  | `alerte` | rose |

- **Statuts.** `info` (bleu), `success` (vert), `warning` (banane) et `danger` (rose). Ils vont toujours avec une icône et un texte : l'état ne se lit jamais par la couleur seule.
- **Texte sur aplat.** Encre (`on-fill`) sur vert, bleu, rose, pêche, banane et jaune ; le texte secondaire y est `on-fill` atténué, jamais `muted`. Blanc uniquement sur violet et sur `nav`. Jamais de blanc sur vert (contraste 3,09:1).
- **Support imprimé** (kit des associations) :
  - `kit-band` / `on-kit-band` pour le bandeau ;
  - `kit-offer` / `on-kit-offer` pour l'encart offre ;
  - `kit-annot` pour les repères de maquette, qui ne s'impriment jamais.

  Un document imprimé doit rester lisible en noir et blanc.
- Aucun dégradé, aucune transparence, aucun fond flouté.

## Themes

Le design system est en **thème clair uniquement**. L'app reste claire même quand l'appareil est réglé en sombre : `tokens.json` n'a plus de bloc `color.dark`, `tokens.css` ne réagit pas à `prefers-color-scheme` et les réglages ne proposent plus de choix de thème. Un nouveau jeton n'a pas de valeur sombre.

Conséquence tant que ce bloc existe : sur un aplat, le texte secondaire ne prend jamais `muted` (gris clair en sombre, 2,3:1 sur `yellow`). Il prend `on-fill` atténué (`opacity-75`), qui garde au moins 5:1 dans les deux thèmes. Tout écran se vérifie aussi en sombre.

## Typography

Trois familles, pas d'italique.

- **Archivo Black** (`font-display`) : les titres, **toujours en capitales**.
- **Space Grotesk** (`font-body` / `font-sans`) : le texte et l'interface.
- **Space Mono** (`font-mono`) : tous les nombres, dates, quantités, prix, minuteurs, codes et métadonnées.

Les styles de texte passent par des classes (taille mobile → desktop) :

| Classe | Taille |
|---|---|
| `t-hero` | 52 → 112 (un seul par écran) |
| `t-1` | 34 → 56 |
| `t-2` | 24 → 32 |
| `t-3` | 18 → 20 |
| `t-body` | 16 |
| `t-ui` | 16 gras |
| `t-small` | 14 |
| `t-label` | 13, capitales |
| `t-kicker` | 12, capitales, mono |
| `num-l` | 36 → 48 |
| `num-xl` | 64 → 120 |

Dans l'app, le corps de texte ne descend jamais sous 14 px. Les autres tailles suivent uniquement l'échelle Tailwind ; une valeur hors échelle se ramène au palier inférieur. Les titres de page passent par `PageHeader`, jamais par un titre stylé à la main.

## Layout

Les marges, espacements et gouttières n'utilisent que les paliers de `spacing`. La marge d'écran est de 16 px sur mobile et de 40 px sur desktop. Le seuil desktop est 900 px : les bordures et les ombres y grossissent.

Cibles tactiles :
- `--touch-min` 44 px : toute cible ;
- `--touch-main` 52 px : boutons md et champs ;
- `--touch-session` 60 px : bouton lg et navigation de la session guidée.

Les éléments d'une même grille peuvent se coller sur des filets encre (`Bento`) au lieu d'être espacés.

Sous 900 px, la barre d'onglets flotte en bas de l'écran. **Mode cuisine** : pendant une session lancée, elle disparaît (règle `body:has([data-session-live])` dans `globals.css`) et la navigation Précédent / Suivant de la session reste collée en bas, pour que la première action de chaque étape soit visible sans défiler. Le grand numéro d'étape n'apparaît qu'à partir de 900 px ; sur mobile, le bandeau « Étape n sur N » suffit.

## Elevation & Depth

La profondeur vient d'**ombres dures** : décalage x = y, flou 0, couleur `line`.

| Ombre | Mobile | Desktop |
|---|---|---|
| `--sh-sm` | 2 px | 3 px |
| `--sh` | 3 px | 6 px |
| `--sh-lg` | 5 px | 9 px |

Variantes colorées : `--sh-violet` et `--sh-banane`. Aucune ombre floue, aucune élévation par transparence.

## Shapes

- **Bordure encre partout.** Cartes, boutons, champs, images et feuilles ont une bordure `--bw` : 2 px sur mobile, 3 px sur desktop. Elle entoure toute la forme, jamais un seul côté. Les pointillés sont réservés aux états désactivés, aux emplacements vides et aux squelettes.
- **Rayons quasi nuls.** `--r0` 0, `--r1` 2 px (défaut) et `--r2` 4 px (maximum). Les cartes et les feuilles prennent 4 px au plus. La pilule (`--r-pill`) est réservée à `Pill` / `Badge`.
- **Inclinaisons.** Les jetons `--tilt-l`, `--tilt-1`, `--tilt-r`, `--tilt-2` et `--tilt-sticker` (−3° à 2°) donnent le côté « collé à la main ». Pas plus d'une ou deux pièces inclinées par écran (sticker, tampon, badge d'offre), jamais un texte long.

## Components

Les composants vivent dans `src/components/ui/` et s'importent depuis `@/components/ui`. Un nouveau composant y est ajouté, exporté par `index.ts` et présenté dans la galerie `/design-system`. Le catalogue complet est dans `docs/DESIGN_SYSTEM.md`.

- **Actions** : `Button`, `LinkButton` ou `buttonClass()` pour un lien.
  - Variantes : `primary` (banane), `secondary` (violet), `outline`, `dark`, `ghost`, `danger`.
  - Tailles : sm 44, md 52, lg 60.
  - Une seule `primary` par écran. `IconButton` exige un `label`.
- **Surfaces** : `Card` et sa `tone` (surface, violet, dark, yellow, blue, pink, peach, green, banane), `Sheet` pour les feuilles modales.
- **Étiquettes** : `Pill` / `Badge` pour les états, `Sticker` (incliné, ombre dure) pour les nouveautés et les offres, `Stamp` pour le tampon du passeport, en encre `ink-fixed`.
- **Messages** : `Callout`, `EmptyState`, `Toast` (`useToast()`), `Coachmark` (une seule bulle d'aide à la fois), `Skeleton`.
- **Icônes** : `Icon`, en trait simple. Pas d'icônes Material ni d'emoji ; les origines sont des drapeaux dessinés.
- **Focus** : visible et plein, 3 px en `--focus` décalé de 3 px.

Pas encore portés depuis la maquette : `OfferBox` et `MealFrieze`, prévus pour le kit imprimé des associations.

## Motion

Le mouvement est **mécanique**, sans fondu ni easing doux. La courbe est `--ease-base` (`steps(2)`).

- Survol : l'élément s'enfonce de 2 px et son ombre raccourcit.
- Clic : il s'écrase sur son ombre.
- Nouveau tampon : il s'abat par paliers.

Durées : `--t-fast` 90 ms pour le survol et le clic, `--t-stamp` 360 ms pour le tampon. Seuls `transform` et `opacity` s'animent. Avec `prefers-reduced-motion`, tout s'arrête.

## Do's and Don'ts

- Ne pas poser `muted` sur un aplat : utiliser `on-fill` atténué.
- Ne jamais écrire une couleur en dur : déclarer le jeton dans `design-system/tokens.json`, puis lancer `pnpm tokens`.
- Ne pas mettre plus d'une action banane par écran.
- Ne pas poser de texte blanc sur vert, ni de texte blanc de moins de 16 px gras sur violet.
- Ne pas utiliser de dégradé, d'ombre floue, de transparence ou de flou d'arrière-plan.
- Ne pas dépasser 4 px de rayon, sauf la pilule de `Pill`.
- Ne pas poser de bordure sur un seul côté d'une forme.
- Ne pas utiliser d'autre police qu'Archivo Black, Space Grotesk et Space Mono, ni d'italique, ni de titre en minuscules.
- Ne pas écrire de nombre, de prix ou de durée hors de Space Mono.
- Ne pas incliner plus de deux pièces par écran, ni un texte long.
- Ne pas écrire de `<h1 className="text-4xl …">` à la main : utiliser `PageHeader`.
- Ne pas fabriquer de bouton à la main : utiliser `Button`, `LinkButton` ou `buttonClass()`.
- Ne pas utiliser de taille, de marge ou de rayon hors des échelles.
- Ne pas ajouter de texte d'interface hors de `src/i18n/fr.ts`. Mettre une espace insécable avant `: ; ? !` et un verbe d'action sur les boutons.
- Ne pas utiliser d'emoji ni d'icônes Material, et ne jamais représenter d'enfant.
- Respecter `prefers-reduced-motion`.
