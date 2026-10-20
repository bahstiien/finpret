# Design system Fin Prêt

Une seule source pour l'apparence : les couleurs viennent de `design-system/tokens.json` (`pnpm tokens`), les composants de `src/components/ui/`, importés depuis `@/components/ui`. Une galerie vivante est visible en développement sur `/design-system` (404 en production).

## Principes
1. **Clarté d'abord.** Un titre, une action principale par écran. Les actions secondaires sont plus discrètes.
2. **Douceur.** Rayons généreux (cartes 28 px, feuilles 32 px, pilules), teintes douces, jamais de bordure dure.
3. **Retour immédiat.** Squelette de chargement, léger enfoncement au toucher, apparition en fondu de 220 ms. Tout s'arrête avec `prefers-reduced-motion`.
4. **Accessible par défaut.** Zones tactiles ≥ 44 px, contrastes AA, libellé ARIA obligatoire sur les boutons-icônes, focus visible violet, navigation au clavier.
5. **Clair et sombre.** On n'écrit jamais une couleur en dur : on utilise les tokens (`bg-surface`, `text-muted`…). Exception : le texte sombre sur fond banane (`text-[#17151F]`).

## Tokens
- **Couleurs** : `bg`, `surface`, `ink`, `muted`, `line`, `chip`, `violet` (+ `-soft`, `-strong`), `banana`, `green` (+ `-soft`, `-ink`, `-strong`), `blue`, `pink`, `peach`, `yellow` (teintes `-soft` / `-ink`), `nav`.
- **Rayons** : `rounded-card` 28 px, `rounded-sheet` 32 px, `rounded-pill`, `rounded-2xl` pour les champs et lignes.
- **Ombre** : `shadow-float` (barre flottante, feuilles).
- **Typo** : Gabarito (`font-display`) pour les titres, Figtree pour le texte. Titre de page 36 px, section 24 px, carte 18 px, texte 16 px, secondaire 14 px. Chiffres à largeur fixe.

## Composants

| Composant | Rôle |
|---|---|
| `AppFrame` | Cadre des pages connectées : barre latérale (≥ 900 px) ou barre flottante (mobile), contenu animé |
| `PageHeader` | Titre de page (h1), surtitre, description, actions |
| `SectionHeader` | Titre de section (h2) + compteur ou action |
| `Card` | Surface de base ; `tone` : surface, violet, dark, yellow, blue, pink, peach, green ; `padding` : none, sm, md, lg |
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
| `Icon` | Icônes SVG en ligne, décoratives sauf `label` |

## Règles d'usage
- Pas de `<h1 className="text-4xl …">` à la main : utilise `PageHeader`.
- Pas de bouton fait à la main : `Button`, ou `LinkButton` / `buttonClass()` pour un lien.
- Un nouveau composant d'interface va dans `src/components/ui/`, est exporté par `index.ts` et ajouté à la galerie.
- Un nouveau token se déclare dans `design-system/tokens.json`, puis `pnpm tokens`.
- Les textes restent dans `src/i18n/fr.ts`.

## À migrer
Migrés : titres de page (`PageHeader`) et cartes simples (`Card`) sur Menu, Session, Stock, Découvrir, Abonnement, Progression, Réglages, onboarding, admin, asso, école et invitations ; boutons-liens jaunes (`buttonClass()`).

Reste : Courses (`ShoppingScreen`, en cours de modification ailleurs), les pages marketing (`landing/`, `associations/`) qui ont leur propre habillage, les cartes à classes dynamiques et les listes `<ul className="rounded-card …">`, ainsi que les boutons secondaires écrits à la main. Les remplacer écran par écran en vérifiant le rendu.
