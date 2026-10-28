# Design system Fin Prêt

Une seule source pour l'apparence : les tokens viennent de `design-system/tokens.json` (`pnpm tokens` génère `src/styles/tokens.css`), les composants de `src/components/ui/`, importés depuis `@/components/ui`. Une galerie vivante est visible en développement sur `/design-system` (404 en production).

**Les règles du skill `landing-page-design` (partie B) priment sur SPEC §11 et sur les maquettes** pour tout ce qui suit. Elles remplacent l'ancienne charte (Gabarito + Figtree, graisses 800/900, rayons 28 px, tailles libres).

## Principes
1. **Clarté d'abord.** Un titre, une action principale par écran. Les actions secondaires sont plus discrètes.
2. **Douceur.** Rayons de l'échelle Tailwind (cartes 24 px, feuilles 32 px), teintes douces, fonds plats (jamais de dégradé en fond), bordures complètes ou absentes, jamais d'un seul côté.
3. **Retour immédiat.** Squelette de chargement, léger enfoncement au toucher (`scale(0.98)`), apparitions de 500 à 700 ms sur la courbe `ease-base`. Tout s'arrête ou devient un simple fondu avec `prefers-reduced-motion`.
4. **Accessible par défaut.** Zones tactiles ≥ 44 px, contrastes AA, libellé ARIA obligatoire sur les boutons-icônes, focus visible (violet, jaune sur fond violet via `.on-violet`), navigation au clavier, lien d'évitement sur les pages publiques.
5. **Clair et sombre.** On n'écrit jamais une couleur en dur : on utilise les tokens (`bg-surface`, `text-muted`…). Exception : le texte sombre sur fond banane (`text-[#17151F]`).

## Tokens
- **Couleurs** : `bg`, `surface`, `ink`, `muted`, `line`, `chip`, `violet` (+ `-soft`, `-strong`), `banana`, `green` (+ `-soft`, `-ink`, `-strong`), `blue`, `pink`, `peach`, `yellow` (teintes `-soft` / `-ink`), `nav`. **Mode sombre** : fonds neutres limités à #000000, #181818, #1F1F1F, #272727, #313131 et #131209 (`bg` #181818, `surface` #1F1F1F, `chip` #272727, `line` #313131, `nav` #000000). Exception documentée : les teintes douces (`blue-soft`, `pink-soft`, `peach`, `yellow-soft`, `green-soft`, `violet-soft`) restent des surfaces colorées sémantiques en sombre.
- **Police** : Manrope, une seule famille pour les titres et le texte (`font-display` et `font-sans` y pointent). Graisses 400 à 700 ; jamais d'italique, jamais 800 ou 900.
- **Échelle typographique** : uniquement les paliers Tailwind (`text-xs` 12/16 à `text-9xl`). Une taille qui n'en est pas un se ramène au palier inférieur, avec son interligne. Boutons principaux : `text-base` semibold ; boutons d'en-tête : `text-sm` semibold. Corps de texte en `text-wrap: pretty`, titres en `balance`.
- **Espacements** : 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px (classes `0`, `0.5`, `1`, `2`, `3`, `4`, `6`, `8`, `10`, `12`, `16`, `20`, `24`). Boutons principaux : 8 px en vertical, 12 px en horizontal, hauteur minimale 44 px.
- **Rayons** : échelle Tailwind. `rounded-card` = 24 px (`rounded-3xl`), `rounded-sheet` = 32 px (`rounded-4xl`), `rounded-xl` pour les boutons, `rounded-2xl` pour les champs, `rounded-pill` pour les pastilles. **Rayon imbriqué** : intérieur = extérieur − marge, si la marge est inférieure à 32 px et le résultat supérieur à 2 px ; sinon, angle droit.
- **Mouvement** : courbe `ease-base` = cubic-bezier(0.22, 1, 0.36, 1), jamais `ease`, `linear` ni `ease-in-out`. 500 ms pour les déplacements, 300 ms pour les couleurs et l'opacité au survol (jamais moins de 200 ms), 700 ms pour les apparitions. On n'anime que `transform` et `opacity`.
- **Icônes** : Phosphor (graisse « regular »), via `Icon` (`@/components/ui` dans l'application, `@/components/landing/Icon` sur les pages marketing). Jamais Material.
- **Ombre** : `shadow-float` (barre flottante, feuilles).

## Pages publiques (landing)
- Barre de navigation flottante, centrée, translucide et floutée (`PublicNav`) ; sur mobile, panneau plein écran dont les liens arrivent l'un après l'autre (60 ms de décalage, 24 px de montée). La page courante porte `aria-current="page"`.
- Sections qui montent de 32 px en fondu à l'entrée dans l'écran, une seule fois (`Reveal`, `IntersectionObserver`, jamais d'écouteur de défilement).
- Une section « phrase de fond » en grand texte (`TaglineReveal`) : les mots passent de 30 % d'encre à l'encre pleine un par un en franchissant une ligne à 60 % de l'écran.
- Titre du hero en dégradé de texte de gauche à droite (#000000 → #666666 en clair, #FFFFFF → #9B9B9B en sombre), largeur max 680 px, saut de ligne là où la phrase respire. Le dégradé n'existe que sur ce texte.
- Livraison : lien d'évitement, page 404 de marque (`not-found.tsx`), icône d'onglet (`app/icon.png`), pages légales liées dans le pied de page.

## Composants

| Composant | Rôle |
|---|---|
| `AppFrame` | Cadre des pages connectées : barre latérale (≥ 900 px) ou barre flottante (mobile), contenu animé |
| `PageHeader` | Titre de page (h1), surtitre, description, actions |
| `SectionHeader` | Titre de section (h2) + compteur ou action |
| `Card` | Surface de base ; `tone` : surface, violet, dark, yellow, blue, pink, peach, green ; `padding` : none, sm (16 px), cozy (16 px), md (24 px), lg (32 px) |
| `Button`, `LinkButton`, `buttonClass()` | Variantes primary, secondary, outline, dark, ghost, danger ; tailles sm, md, lg |
| `IconButton` | Bouton rond à icône, `label` obligatoire |
| `Pill` / `Badge` | Étiquette d'état, huit teintes |
| `Callout` | Message en ligne (info, success, warning, error), annoncé aux lecteurs d'écran ; `FormMessage` en est un alias |
| `EmptyState` | Écran vide : icône, explication, action |
| `StatTile` | Chiffre clé |
| `ListRow` | Ligne avec pastille d'icône, titre, sous-titre, fin |
| `ProgressBar`, `ProgressRing` | Progression 0–100 |
| `Avatar` | Initiale du prénom |
| `Segmented` | Choix unique entre 2 à 4 options |
| `TextField`, `SelectField`, `Toggle`, `Stepper`, `ChipToggle`, `SlotGrid` | Formulaires |
| `Sheet` | Feuille modale (`<dialog>`) |
| `Skeleton` | Chargement ; `app/loading.tsx` en donne un par défaut |
| `Toast` | `useToast()` pour les confirmations |
| `Icon` | Icônes Phosphor, décoratives sauf `label` |

## Règles d'usage
- Pas de `<h1 className="text-4xl …">` à la main : utilise `PageHeader`.
- Pas de bouton fait à la main : `Button`, ou `LinkButton` / `buttonClass()` pour un lien.
- Un nouveau composant d'interface va dans `src/components/ui/`, est exporté par `index.ts` et ajouté à la galerie.
- Un nouveau token se déclare dans `design-system/tokens.json`, puis `pnpm tokens`.
- Les textes restent dans `src/i18n/fr.ts`.

## État de la migration
Migrés : titres de page (`PageHeader`) et cartes simples (`Card`) sur tous les écrans ; boutons-liens jaunes (`buttonClass()`).

**Passe « landing-page-design » (octobre 2026).** Appliquée mécaniquement à toute l'interface : police unique, graisses plafonnées à 700, tailles et rayons arbitraires ramenés à l'échelle Tailwind, espacements ramenés à la table, interlignes et crénages arbitraires supprimés, transitions sur `ease-base`, icônes Phosphor, neutres sombres. Les écrans connectés n'ont pas été relus un à un : une vérification visuelle écran par écran reste à faire (surtout densité des listes après le passage de 20 px à 16 px, et hauteur des boutons).

Reste, volontairement : les cartes à classes calculées, les listes `<ul className="rounded-card divide-y …">`, les `<form>` et `<details>` qui portent leur propre habillage. Les migrer au fil des retouches.
