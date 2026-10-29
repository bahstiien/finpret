# Design system Fin Prêt Néo

Néo-brutalisme : aplats francs, bordures noires épaisses, ombres dures, rien de flou. Source de référence : le projet « Fin Prêt Néo » dans Claude Design (palette A, feuille finpret-neo v2.1). Dans le code :

- `design-system/tokens.json` est la seule source des jetons ; `pnpm tokens` génère `src/styles/tokens.css` (`pnpm tokens:check` en CI). Ne modifie jamais `tokens.css` à la main.
- `src/styles/neo.css` porte les classes des primitives (`.btn`, `.card`, `.pill`, `.seg`, `.stamp`, `.faq`…). Elle ne définit plus aucun jeton, sauf les trois familles de polices.
- Les composants React vivent dans `src/components/ui/`, importés depuis `@/components/ui`.
- Une galerie vivante est visible en développement sur `/design-system` (404 en production).

## Principes
1. **Clarté d'abord.** Un titre, une action principale par écran (une seule action banane par écran).
2. **Bordure noire partout.** Cartes, boutons, champs, images, feuilles : `--bw` (2 px mobile, 3 px desktop ≥ 900 px). Pointillés réservés aux états désactivés, emplacements vides et squelettes.
3. **Ombre dure, jamais floue.** Décalage x = y, flou 0, couleur `--line` : `--sh-sm`, `--sh`, `--sh-lg` (2 / 3 / 5 px mobile, 3 / 6 / 9 px desktop), `--sh-violet`, `--sh-banane`. Aucun dégradé, aucune transparence.
4. **Rayons quasi nuls.** `--r0` 0, `--r1` 2 px (défaut), `--r2` 4 px (maximum). La pilule (`--r-pill`) est réservée à `Pill`.
5. **Mouvement mécanique.** Survol : l'élément s'enfonce de 2 px et son ombre raccourcit ; clic : il s'écrase sur son ombre ; un nouveau tampon s'abat par paliers. Pas de fondu. Tout s'arrête avec `prefers-reduced-motion`.
6. **Accessible par défaut.** Contraste AA, cibles ≥ 44 px (`--touch-min`), focus visible (`--focus`, 3 px plein décalé de 3 px), libellé ARIA obligatoire sur les boutons-icônes. L'état se lit aussi en forme et en texte, jamais par la couleur seule.
7. **Pas d'emoji, jamais d'enfant représenté.** Les origines sont des drapeaux dessinés, les pictogrammes des `Icon`.

## Jetons
- **Couleurs** : `bg` (crème #FFF8E7), `surface`, `chip`, `line`, `ink`, `muted`, `nav`, `on-nav`, `violet` (+ `-strong`, `on-violet`), `banane` (+ `on-banane`), `green`, `blue`, `pink`, `peach`, `yellow`, `on-fill`, `ink-fixed`, `focus`. Jamais de couleur en dur dans le code.
- **Deux signatures** : `banane` = action principale (`cta`), `violet` = sélection (`sel`).
- **Un domaine, un aplat** : `menu` violet, `courses` vert, `stock` bleu, `progres` banane, `session` pêche, `alerte` rose. Statuts : `info`, `success`, `warning`, `danger` (toujours avec une icône et un texte). Chaque rôle a son `on-*` : texte `on-fill` (encre) sur vert, bleu, rose, pêche, banane, jaune ; `on-violet` (blanc, 16 px gras minimum) sur violet ; jamais de blanc sur vert (3,09:1).
- **Support imprimé** : `kit-band`, `on-kit-band`, `kit-offer`, `on-kit-offer`, `kit-annot` (repères de maquette, jamais imprimés).
- **Polices** : Archivo Black (`font-display`, titres en capitales), Space Grotesk (`font-body` / `font-sans`, texte), Space Mono (`font-mono`, tous les nombres, dates, quantités, minuteurs).
- **Styles de texte** (classes) : `t-hero` 52 → 112, `t-1` 34 → 56, `t-2` 24 → 32, `t-3` 18 → 20, `t-body` 16, `t-ui` 16 gras, `t-small` 14, `t-label` 13 capitales, `t-kicker` 12 capitales mono, `num-l` 36 → 48, `num-xl` 64 → 120 (mobile → desktop). Un seul `t-hero` par écran ; corps jamais sous 14 px dans l'app.
- **Espacements** : pas de 4 (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Marge d'écran 16 px mobile, 40 px desktop.
- **Cibles tactiles** : `--touch-min` 44, `--touch-main` 52 (boutons md, champs), `--touch-session` 60 (session guidée).
- **Inclinaisons** : `--tilt-l`, `--tilt-1`, `--tilt-r`, `--tilt-2`, `--tilt-sticker`. Une ou deux pièces inclinées par écran, jamais un texte long.
- **Durées** : `--t-fast` 90 ms (survol, clic), `--t-stamp` 360 ms ; courbes par paliers (`steps`).
- **Z-index** : `--z-timers` 25, `--z-nav` 30, `--z-coach` 40, `--z-sheet` 60.

## Thème
Le design system est en **thème clair uniquement**. Le code garde pour l'instant les valeurs du thème sombre dans `tokens.json` (`color.dark`) : à retirer ou à redessiner (question ouverte, voir le récapitulatif de la mise à niveau). Les nouveaux jetons n'ont pas de valeur sombre.

## Composants

| Composant | Rôle |
|---|---|
| `AppFrame`, `AppNav` | Cadre des pages connectées : barre latérale (≥ 900 px) ou barre d'onglets (mobile) |
| `PageHeader`, `SectionHeader` | Titre de page (h1), titre de section (h2) |
| `Card` | Surface de base ; `tone` : surface, violet, dark, yellow, blue, pink, peach, green, banane |
| `Button`, `LinkButton`, `buttonClass()` | primary (banane), secondary (violet), outline, dark, ghost, danger ; tailles sm 44, md 52, lg 60 |
| `IconButton` | Bouton à icône, `label` obligatoire |
| `Pill` / `Badge` | Étiquette d'état (seul usage de la pilule) |
| `Sticker` | Étiquette inclinée à ombre dure (nouveautés, offres) |
| `Difficulty`, `Dot` | Difficulté de 1 à 4 ; point de notification |
| `Callout`, `EmptyState`, `Toast` (`useToast()`), `Coachmark` | Messages, états vides, confirmations, bulle d'aide (une seule à la fois) |
| `StatTile`, `Bento` | Chiffres clés ; grille collée sur des filets (Besoin / Acheté / Reste) |
| `ListRow`, `ProgressBar`, `ProgressRing`, `Avatar` | Lignes, progression, initiale |
| `Segmented`, `TextField`, `SelectField`, `Checkbox`, `Toggle`, `Stepper`, `ChipToggle`, `SlotGrid` | Saisie |
| `Sheet` | Feuille modale (`<dialog>`) |
| `Faq`, `Breadcrumbs`, `TextLink` | Contenu des pages publiques |
| `Stamp` | Tampon du passeport (rond ou carré, encre `ink-fixed`) |
| `Skeleton` | Chargement |
| `Icon` | Pictogrammes en ligne, décoratifs sauf `label` |

Pas encore portés depuis le design system : `OfferBox` et `MealFrieze` (kit associations imprimé), `Topbar` / `Tabbar` en composants autonomes (`AppNav` les couvre).

## Règles d'usage
- Pas de `<h1 className="text-4xl …">` à la main : utilise `PageHeader`.
- Pas de bouton fait à la main : `Button`, ou `LinkButton` / `buttonClass()` pour un lien.
- Un nouveau composant d'interface va dans `src/components/ui/`, est exporté par `index.ts` et ajouté à la galerie.
- Un nouveau jeton se déclare dans `design-system/tokens.json`, puis `pnpm tokens`.
- Les textes restent dans `src/i18n/fr.ts` : tutoiement, chaleureux, jamais culpabilisant, verbe d'action sur les boutons, espace insécable avant `: ; ? !`.
