# SPEC_PRISE_EN_MAIN — Prendre en main Fin Prêt (nouveaux foyers)

> **Statut : proposition, en attente de validation.** Aucun code n'est écrit tant que ce document n'est pas validé.
> Complète `docs/SPEC_JANVIER.md` (qui reste prioritaire sur le périmètre, les jalons et les droits) et `docs/SPEC.md` (comportement des écrans). L'onboarding de paramétrage (4 étapes, SPEC_JANVIER §2 et SPEC §5) **ne change pas**.
> En cas de contradiction : SPEC_JANVIER > SPEC_PRISE_EN_MAIN > SPEC > `reference/menu-legacy.html`. Les écarts constatés avec les documents existants sont listés en §12.
> Tout ce qui est marqué **REPORTÉ** n'est pas développé, même partiellement.

---

## 0. Comment travailler avec ce document

1. Exécute les jalons **J5b, J7b, J8b** dans l'ordre (§9). Chaque jalon liste ses tâches, ses fichiers, ses tests et sa définition de « terminé ».
2. Un jalon n'est terminé que si ses tests passent, si `pnpm lint && pnpm typecheck && pnpm test` sont verts, et si le récapitulatif de fin de jalon est écrit (CLAUDE.md, règle 10).
3. Les textes de ce document sont les textes de référence : reprends-les tels quels dans `src/i18n/fr.ts` (clés regroupées sous `gettingStarted`, `tips`, `emptyStates`, `prepSheet`, `help`, `faq`). Ils ont été rédigés d'après la SPEC et le ton des textes existants, **faute de `brand/charte-fin-pret.md`** (absente du dépôt) : à relire contre la charte (§12, point 2).
4. Aucune API, aucun comportement absent de la SPEC n'est inventé. Ce qui manque est signalé par un `TODO(spec)` ; les points tranchés sont au §11.
5. Nommage : les modules de ce document s'appellent `getting-started` (le mot `onboarding` est déjà pris par l'assistant de paramétrage : `src/lib/onboarding.ts`, `src/server/actions/onboarding.ts`). Seuls la table `onboarding_progress`, la clé `can('onboarding')` et les noms d'événements gardent le mot imposé par la demande.

## 1. Objectif et indicateurs

**Objectif.** Amener un foyer neuf, depuis son arrivée sur l'onglet Menu après le premier menu, jusqu'à sa première session terminée et sa 2e semaine générée, sans visite guidée : l'aide apparaît au moment où elle sert.

**Périmètre temporel.** La prise en main commence à la première arrivée sur Menu après l'onboarding et se termine quand le foyer a terminé sa première session **et** généré sa 2e semaine (la checklist, elle, se termine à la fin de la première session : §4.1).

| Indicateur | Définition | Objectif |
| --- | --- | --- |
| **Principal : activation à 10 jours** | Part des foyers qui ont un événement `session_done` au plus 10 jours (calendaires, fuseau du foyer) après leur inscription (événement `signup` du compte créateur) | **40 %** (§11, Q1). Repère : SPEC_JANVIER §1 vise 75 foyers sur 150, soit 50 %, sans délai |
| **Secondaire : 2e semaine** | Part des foyers qui ont un 2e événement `week_generated` (semaine de départ différente de la 1re) | Repère : 50 foyers sur 150, soit 33 % (SPEC_JANVIER §1 « revenus une 2e semaine ») |

Lecture : cohorte = foyers dont le `signup` du créateur tombe dans la période ; dénominateur = foyers ayant fini l'onboarding (`onboarding_done`), pour ne pas compter les abandons d'avant la prise en main. Les deux ratios sont calculés par une requête sur `events` fournie dans le récapitulatif de J5b (§7.4). **Aucun outil tiers.**

Indicateurs de diagnostic (sans objectif) : part des foyers qui cochent chacune des 6 étapes, médiane du délai entre `onboarding_done` et chaque étape, part des foyers qui masquent la checklist, part des bulles fermées avec « Compris » ou ignorées, part des messages envoyés suivis de l'étape visée dans les 48 h.

## 2. Principes (non négociables)

1. **Pas de carrousel ni de visite guidée au premier lancement.** L'aide apparaît au moment où elle sert.
2. **Une seule aide visible à la fois sur un écran.** Toujours fermable, jamais bloquante. Définition précise en §4.2.
3. **Les étapes se cochent toutes seules** à partir de ce que l'utilisateur fait réellement (table `events`). L'utilisateur ne déclare rien — sauf l'exception explicite « Je cuisine seul·e ».
4. **Ton de la charte :** tutoiement, concret, chaleureux, jamais culpabilisant. Aucun message du type « Tu n'as pas encore… ». Test automatique : aucun texte de `gettingStarted`, `tips`, `emptyStates`, `prepSheet`, `help`, `faq` ni de la séquence ne contient « pas encore », « n'as pas », « tu aurais dû », « en retard », « oublié ».
5. **Gratuit pour toutes les offres.** `can(offer, 'onboarding')` vaut `true` partout (ajout dans la liste `ALWAYS` de `src/server/entitlements.ts`, avec son test).
6. **Composants et jetons existants uniquement** (`Card`, `Button`, `Pill`/`Badge`, `Sheet`, `Icon`, `ListRow`, `ProgressBar`, `EmptyState`, `Callout`, `Segmented`). Aucune nouvelle couleur. Les trois composés nouveaux (`Checklist`, `Tile`, `Coachmark`, §4) sont de simples assemblages de ces briques et de ces jetons, déclarés dans `src/components/ui/` et ajoutés à la galerie (DESIGN_SYSTEM.md).
7. **Tous les textes dans `src/i18n/fr.ts`.** Accessibilité AA, clavier, `prefers-reduced-motion` respecté, modes clair et sombre.

## 3. Périmètre

| Domaine | INCLUS | REPORTÉ |
| --- | --- | --- |
| Checklist « Ta première semaine » | 6 étapes automatiques, carte réductible et masquable, relance depuis l'Aide | Checklist « semaine 2 », badges, récompenses |
| Conseils contextuels | 5 bulles (une par onglet), mémorisées par compte | Conseils sur les écrans de réglages, visite guidée |
| États vides | Garde-manger, courses, session, Découvrir, cantine (familles et bénévoles), équipe, notifications, Menu | **Congélateur** (réserve : `FEATURES.freezerAndLeftovers = false`), **Mes recettes** (import : `FEATURES.recipeImport = false`), historique des semaines |
| Première session accompagnée | Tile « Demain, ta première session », Sheet de préparation, niveau débutant, 3 conseils, écran de fin | Session partagée entre appareils (`sharedSession`), restes après la session |
| Séquence de messages J0–J14 | E-mail (Resend) + Web Push si autorisé, 6 messages | Messages « courses prêtes » et « début de session » **comme rappels récurrents** (SPEC_JANVIER §2) : seuls les 2 messages ponctuels de la séquence existent, voir §12 point 3 |
| Aide (Profil > Aide) | Relance, conseils, FAQ de 8 questions, contact | Chat, base de connaissances, vidéos |

## 4. Les six briques

### 4.1 Checklist « Ta première semaine »

**Emplacement.** Carte en haut de l'onglet Menu (au-dessus du programme du jour). Composé `Checklist` = `Card` + `ListRow` par étape + `ProgressBar` + `Button`.

**Propriété.** Propre au **foyer** : ce qu'un membre fait la coche pour tous. Donnée : `onboarding_progress` (§5). L'état est **recalculé côté serveur** à partir des événements (fonction pure §7.1), puis enregistré ; une étape cochée ne se décoche jamais.

**Création.** La ligne `onboarding_progress` est créée au premier rendu de Menu d'un foyer dont `onboarding_done` est enregistré, avec l'étape `discover_menu` déjà cochée (c'est le sens de « Découvrir ton menu »). Les foyers créés avant la mise en production de la fonction n'ont **aucune ligne** et ne voient pas la carte (§8).

| # | Clé | Libellé | Coché quand | Bouton d'une étape non faite | Destination |
| --- | --- | --- | --- | --- | --- |
| a | `discover_menu` | Découvrir ton menu | Arrivée sur Menu après l'onboarding (création de la ligne) | — (déjà cochée) | — |
| b | `adjust_meal` | Ajuster un repas | Premier événement `menu_swap` (Changer), `menu_move` (Déplacer) ou `menu_removed` (Retirer) du foyer | « Voir mes plats » | Menu, section « Plats de la semaine » (ancre `#plats`) |
| c | `invite` | Inviter la personne qui cuisine ou fait les courses avec toi *(facultatif)* | Événement `invitation_sent`, **ou** 2e compte dans le foyer (`memberships`), **ou** clic sur « Je cuisine seul·e » | « Inviter » (administrateur) et « Je cuisine seul·e » | `/settings/household` (invitations) |
| d | `shop` | Cocher tes courses | Premier `shopping_checked` du foyer | « Ouvrir ma liste » | `/app/shopping` |
| e | `start_session` | Lancer ta session | `session_started` | « Voir ma session » | `/app/session` |
| f | `finish_session` | Terminer ta session | `session_done` | « Reprendre ma session » si `session_started`, sinon « Voir ma session » | `/app/session` |

**Règles**
- Les étapes se cochent **dans n'importe quel ordre** ; l'étape proposée en bouton principal (`primary`) est la première non faite, les autres boutons sont `outline`.
- **Progression :** « *N* sur 6 » (`ProgressBar`, libellé accessible « *N* étapes sur 6 terminées »). L'étape c compte quand elle est cochée, y compris par « Je cuisine seul·e ».
- **Fin :** la checklist est terminée quand les cinq étapes obligatoires (a, b, d, e, f) sont cochées ; l'étape c, facultative, ne bloque pas. À ce moment : `completed_at` est renseigné, l'événement `onboarding_completed` est enregistré, la carte passe en **état de réussite** (texte ci-dessous), puis disparaît définitivement quand l'utilisateur la ferme (bouton « Fermer ») ou après 3 jours, selon le premier des deux (`dismissed_at` renseigné).
- **Réduire / développer :** la carte se réduit à son en-tête (titre + « *N* sur 6 ») ; l'état est une commodité **par appareil** (stockage local du navigateur, repli sur « développée » s'il est indisponible). Réduction automatique à partir du 21e jour après la création si la checklist n'est pas terminée (jamais de masquage automatique).
- **Masquer :** bouton « Masquer, je me débrouille » (`Button` `ghost`) ; renseigne `dismissed_at` pour **tout le foyer**, enregistre `onboarding_dismissed`, affiche un toast avec « Annuler ». Tout membre peut masquer.
- **Relancer :** depuis Profil > Aide (§4.6) : remet `dismissed_at` à `null` (événement `onboarding_restarted`). Si la checklist est terminée, l'Aide affiche « Ta première semaine : terminée » sans action de relance.
- **Droits :** l'étape c n'affiche « Inviter » qu'à l'administrateur du foyer (les invitations sont réservées à l'administrateur, SPEC §3) ; les autres membres voient seulement « Je cuisine seul·e ».
- **Offre gratuite :** Changer est limité à 3 par semaine et Déplacer est réservé à l'essai et à l'abonnement (SPEC_JANVIER §4) : l'étape b se coche avec **n'importe lequel** des trois gestes, y compris « Retirer » qui est libre. Le bouton ne mène jamais à un écran d'abonnement.
- **Une seule étape « Inviter »** par foyer : l'étape ne se recoche pas si un membre quitte le foyer.

**Textes**

| Élément | Texte |
| --- | --- |
| Titre | Ta première semaine |
| Progression | *N* sur 6 |
| Sous-titre (en cours) | Chaque étape se coche toute seule quand tu la fais. |
| a | Découvrir ton menu |
| b | Ajuster un repas · *aide :* Change, déplace ou retire un plat qui ne te tente pas. |
| c | Inviter la personne qui cuisine ou fait les courses avec toi · badge « Facultatif » · *aide :* Vous partagez la même liste de courses, en direct. |
| d | Cocher tes courses · *aide :* Coche chaque article au fil du magasin. |
| e | Lancer ta session · *aide :* Une session, c'est toute ta semaine cuisinée en une fois. |
| f | Terminer ta session · *aide :* Tes repas sont prêts, il ne reste qu'à les réchauffer. |
| Boutons | Voir mes plats · Inviter · Je cuisine seul·e · Ouvrir ma liste · Voir ma session · Reprendre ma session |
| Réduire / développer | Réduire la carte · Développer la carte |
| Masquer | Masquer, je me débrouille |
| Toast de masquage | Checklist masquée. Tu la retrouves dans Profil > Aide. · bouton « Annuler » |
| Réussite : titre | Bravo, ta première semaine est bouclée |
| Réussite : texte | Tu as cuisiné ta semaine et tu sais comment tout ça marche. Pour la suite, ta semaine 2 se prépare en deux minutes. |
| Réussite : boutons | Préparer ma semaine 2 · Fermer |
| Étape c validée par « Je cuisine seul·e » | Tu cuisines seul·e, c'est noté. Tu pourras inviter quelqu'un quand tu voudras. |

**Critères d'acceptation**
```gherkin
Scénario: Arrivée sur Menu après l'onboarding
  Étant donné que le foyer vient de terminer l'onboarding et de générer son premier menu
  Lorsqu'un membre ouvre l'onglet Menu
  Alors la carte « Ta première semaine » affiche « 1 sur 6 » avec « Découvrir ton menu » cochée
  Et un événement onboarding_step_done {step: discover_menu} est enregistré une seule fois

Scénario: Ajuster un repas
  Étant donné la checklist à « 1 sur 6 »
  Lorsqu'un membre change, déplace ou retire un repas
  Alors « Ajuster un repas » est cochée et la progression indique « 2 sur 6 »

Scénario: Coche par un autre membre du foyer
  Étant donné deux comptes dans le même foyer
  Lorsque le second compte coche un article de la liste de courses
  Alors, sur l'écran du premier compte, « Cocher tes courses » est cochée

Scénario: Je cuisine seul·e
  Étant donné la checklist avec l'étape « Inviter » non faite
  Lorsque l'administrateur choisit « Je cuisine seul·e »
  Alors l'étape est cochée sans invitation envoyée
  Et un événement onboarding_step_done {step: invite, via: solo} est enregistré

Scénario: Fin de la checklist
  Étant donné les étapes a, b, d, e cochées et l'étape c non faite
  Lorsque la session est terminée (session_done)
  Alors la carte affiche « Bravo, ta première semaine est bouclée » et onboarding_completed est enregistré
  Et après « Fermer », la carte n'apparaît plus jamais sur Menu

Scénario: Masquer puis relancer
  Étant donné la checklist visible
  Lorsqu'un membre choisit « Masquer, je me débrouille »
  Alors la carte disparaît pour tous les membres du foyer
  Et dans Profil > Aide, « Relancer la checklist » la fait réapparaître avec ses étapes déjà cochées
```

### 4.2 Conseils contextuels (bulles)

**Principe.** Une bulle ancrée sur l'élément clé de l'écran, à la **première visite de chaque onglet** (Menu, Courses, Stock, Session, Découvrir). Composé `Coachmark` = `Card` (`tone="violet"`, rayon `rounded-2xl`) + flèche CSS + `Button` « Compris » + `IconButton` de fermeture (libellé « Fermer le conseil »).

**Règles**
- **Une seule bulle par écran** et **au plus 2 par jour** et par compte (jour local du foyer, `households.timezone`). Le décompte se fait sur les événements `tip_shown` du compte.
- **Mémorisation par compte** (pas par foyer) : clé `tips_seen` dans `user_settings` (tableau de clés `menu`, `shopping`, `stock`, `session`, `discover`). Une clé est ajoutée à « Compris », à la fermeture ou à l'accomplissement de l'action ancrée.
- **Le serveur décide** : la page calcule `tipFor(tab)` (clé non vue, moins de 2 bulles aujourd'hui, aucune autre aide transitoire à l'écran) ; le client ne fait qu'afficher et signaler.
- **Définition de « une seule aide visible à la fois »** : au plus une aide **transitoire** (bulle, conseil de première session, Sheet de préparation) à l'écran. Les **cartes permanentes** (checklist, Tile de la veille, tuile de série) ne comptent pas comme des aides transitoires, **sauf** que la checklist se réduit automatiquement à son en-tête quand la Tile « Demain, ta première session » est affichée. Ce point nuance le principe 2 : voir §11, Q3.
- **Priorité sur un même écran :** Sheet ouverte > conseil de première session > bulle d'onglet. Une bulle jamais affichée est simplement reportée à la visite suivante.
- **Offre :** la bulle Stock n'est affichée que si `can('pantry')` (garde-manger réservé à l'essai et à l'abonnement, SPEC_JANVIER §4) ; sinon la clé n'est pas consommée.
- **Accessibilité :** non modale, **ne vole pas le focus**, placée dans le DOM juste après son ancre (ordre de tabulation naturel), `role="region"` avec `aria-label="Conseil"`, ancre reliée par `aria-describedby`, **Échap** la ferme, bouton « Compris » ≥ 44 px, contraste AA en clair et en sombre, apparition en fondu de 220 ms désactivée avec `prefers-reduced-motion`. Sur écran étroit, la bulle se place sous l'ancre (jamais hors écran).

**Textes (2 phrases maximum)**

| Clé | Ancre | Texte |
| --- | --- | --- |
| `menu` | Bandeau des 7 jours | Touche un jour pour voir ses repas. Si un plat ne te tente pas, le bouton ••• te laisse le changer. |
| `shopping` | En-tête de la liste (progression) | Ta liste est rangée par rayon. Coche en magasin : ceux qui partagent le foyer voient la liste se mettre à jour en direct. |
| `stock` | Première ligne du garde-manger (ou bouton d'ajout si vide) | Note ici ce que tu as déjà : la liste de courses n'achète que ce qui manque. Ajuste les quantités avec − et +. |
| `session` | Carte de démarrage | Voici la durée prévue et l'heure de fin. Tu lances la session quand tu es prêt·e : rien ne démarre tout seul. |
| `discover` | Premier bouton « Mettre au menu » | Parcours les recettes par région, saison ou régime. « Mettre au menu » ajoute celle qui te plaît à ta semaine. |

Bouton : **Compris**. Libellé du bouton de fermeture : **Fermer le conseil**.

**Critères d'acceptation**
```gherkin
Scénario: Bulle Courses affichée une seule fois
  Étant donné un compte qui n'a jamais ouvert l'onglet Courses
  Lorsqu'il ouvre Courses
  Alors la bulle « Ta liste est rangée par rayon… » est affichée, ancrée sur l'en-tête de la liste
  Et un événement tip_shown {key: shopping} est enregistré
  Lorsqu'il choisit « Compris » puis revient sur Courses
  Alors aucune bulle n'est affichée
  Et tips_seen contient « shopping »

Scénario: Au plus 2 bulles par jour
  Étant donné un compte qui a déjà vu 2 bulles aujourd'hui
  Lorsqu'il ouvre un onglet dont la bulle n'a jamais été vue
  Alors aucune bulle n'est affichée et la clé n'est pas marquée comme vue

Scénario: Mémorisation par compte
  Étant donné deux comptes du même foyer, dont le premier a vu la bulle Menu
  Lorsque le second ouvre Menu pour la première fois
  Alors il voit la bulle Menu

Scénario: Clavier
  Étant donné une bulle affichée
  Lorsque l'utilisateur appuie sur Échap
  Alors la bulle se ferme, tip_dismissed est enregistré et le focus reste où il était
```

### 4.3 États vides utiles

**Règle.** Chaque liste ou écran pouvant être vide affiche `EmptyState` : une `Icon` du design system, un titre court, **une phrase qui explique à quoi sert l'écran**, **une action principale** (`Button` ou `LinkButton`). Pas d'illustration. Aucun état vide ne culpabilise.

**Inventaire**

| # | Écran / liste | Condition de vide | Icône | Titre | Phrase | Action principale |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Menu : aucune semaine | Pas de semaine active ni brouillon (`NoWeek`) | `sparkle` | Ta semaine commence ici | Fin Prêt compose tes repas du lundi au vendredi, puis ta liste de courses et ta session. | **Préparer ma semaine** (génère) |
| 2 | Menu : jour sans repas | Tous les repas du jour retirés ou décochés | `clock` | Rien de prévu ce jour-là | Les repas que tu retires restent dans la semaine : tu peux les remettre quand tu veux. | **Remettre un repas** (ouvre ••• du jour) |
| 3 | Menu : cantine sans menu publié | Enfant rattaché à une école, aucun menu publié pour la date | `info` | Pas encore de menu de cantine | Le menu s'affiche ici dès que ton association le publie, avec l'alerte quand le dîner ressemble au déjeuner. | **Ajouter le menu à la main** *(seulement si `FEATURES.householdCanteen`)* ; sinon aucune action, la phrase seule |
| 4 | Menu : week-end vide | Aucun repas prévu samedi et dimanche | `sparkle` | Un week-end à inventer | Choisis une recette pour le week-end ou laisse l'app te proposer des idées. | **Suggérer des idées** |
| 5 | Courses avant génération | Aucune semaine, donc aucune ligne | `basket` | Ta liste se remplit toute seule | Elle apparaît dès que ta semaine est prête, rangée par rayon. | **Préparer ma semaine** (vers Menu) |
| 6 | Courses : tout est coché | `cochés = total` | `check` | Tout est dans le panier | Ta liste est complète : tu peux passer à ta session. | **Voir ma session** |
| 7 | Stock : garde-manger vide | Aucune ligne `pantry` | `pot` | Ton garde-manger est vide | Il sert à ne pas racheter ce que tu as déjà : la liste n'achète que ce qui manque. | **Ajouter un ingrédient** (offre essai ou abonnement ; sinon voir §12 point 5) |
| 8 | Stock : congélateur | — | — | **REPORTÉ** (`freezerAndLeftovers`) : texte prévu, non développé | « Tes repas congelés se rangent ici, et sortent en premier au menu suivant. » | — |
| 9 | Session : pas de session à mener | Aucune semaine, ou semaine déjà terminée | `timer` | Pas de session pour l'instant | La session cuisine toute ta semaine en une fois, étape par étape. Elle apparaît dès que ta semaine est prête. | **Préparer ma semaine** (vers Menu) |
| 10 | Découvrir : aucun résultat | Recherche ou filtres sans résultat | `search` | Aucune recette ne correspond | Essaie avec moins de filtres ou un autre mot : le catalogue compte plus de 180 recettes de repas. | **Effacer les filtres** |
| 11 | Découvrir : favoris vides | Filtre « favoris » sans favori | `sparkle` | Tes favoris arriveront ici | Aime une recette pour la retrouver vite et la voir revenir plus souvent au menu. | **Parcourir les recettes** |
| 12 | Découvrir : « Mes recettes » | — | — | **REPORTÉ** (`recipeImport`) | — | — |
| 13 | Équipe : foyer à un seul compte | 1 compte, aucune invitation en attente | `users` | Tu es seul·e pour l'instant | Inviter la personne qui cuisine ou fait les courses avec toi lui donne la même liste, en direct. | **Inviter quelqu'un** (administrateur) |
| 14 | Réglages > Notifications : appareil non autorisé | Permission refusée ou non demandée | `info` | Les rappels sont coupés sur cet appareil | Active-les pour recevoir ton plat du soir et le rappel de décongélation. Tu peux les couper quand tu veux. | **Activer les notifications** (si la permission n'est pas « refusée » ; sinon explication « Autorise-les dans les réglages de ton navigateur », sans bouton) |
| 15 | Bénévole `/asso/menus` : aucun menu publié | Aucun menu `published` pour le mois | `info` | Aucun menu publié ce mois-ci | Les familles de ton école voient ici le menu de la cantine, jour après jour. Importe le PDF de la mairie ou saisis les repas. | **Importer un PDF** |
| 16 | Bénévole `/asso/menus` : brouillons à publier | Menus `draft` en attente | `check` | Des menus attendent ta validation | Relis-les, corrige si besoin, puis publie : les familles sont prévenues une seule fois par semaine. | **Voir les brouillons** |
| 17 | Impression : aucune semaine | Pas de semaine | `print` | Rien à imprimer pour l'instant | La page imprimable reprend ta semaine sur une feuille A4. | **Préparer ma semaine** |

Les icônes citées existent toutes dans `IconName` (`clock`, `info`, `basket`, `pot`, `sparkle`, `users`, `timer`, `search`, `print`, `check`). Pas de nouvelle icône à ce stade : si une icône plus adaptée (cloche, cœur, école) est souhaitée, c'est une demande séparée au design system (`TODO(spec)`).

**Critères d'acceptation**
```gherkin
Scénario: Courses avant génération
  Étant donné un foyer sans semaine générée
  Lorsqu'un membre ouvre Courses
  Alors l'écran affiche « Ta liste se remplit toute seule » et le bouton « Préparer ma semaine »
  Et aucune liste vide ni message d'erreur n'est affiché

Scénario: Garde-manger vide
  Étant donné un foyer en essai sans ligne de garde-manger
  Lorsqu'un membre ouvre Stock
  Alors l'écran affiche « Ton garde-manger est vide » et « Ajouter un ingrédient »

Scénario: Aucun état vide sur une fonction REPORTÉE
  Étant donné FEATURES.freezerAndLeftovers = false
  Lorsqu'un membre ouvre Stock
  Alors aucun bloc « congélateur » n'est affiché
```

### 4.4 Première session accompagnée

**Définition de « première session ».** La première session du foyer : tant qu'aucun `session_done` n'existe pour le foyer. Elle est portée par le jour et l'heure de session du foyer (`household_settings.session`, défaut dimanche 14 h). La « veille » s'entend dans le fuseau `households.timezone`.

#### 4.4.1 Tile « Demain, ta première session »

- **Composé `Tile`** = `Card` cliquable (bouton couvrant la carte, ≥ 44 px, `Icon timer`) placée sur Menu sous la checklist.
- **Affichée** de la veille à 00 h 00 jusqu'au lancement de la session (donc aussi le jour même, avec le titre « Aujourd'hui, ta première session »), tant que la première session n'est pas faite.
- **Fermable** par un bouton « Plus tard » (stocke la clé `prep_tile` dans `tips_seen` du compte) ; jamais bloquante. Elle revient le jour de la session si elle a été fermée la veille (clé `prep_tile` datée : `prep_tile:AAAA-MM-JJ`).
- Quand elle est affichée, la checklist se réduit à son en-tête (§4.2).
- Ouvre la Sheet de préparation et enregistre `prep_sheet_opened`. Lien direct : `/app?prep=1` (utilisé par les messages).

| Élément | Texte |
| --- | --- |
| Titre (veille) | Demain, ta première session |
| Titre (jour même) | Aujourd'hui, ta première session |
| Sous-titre | Cinq minutes de préparation pour cuisiner l'esprit tranquille. |
| Bouton | Préparer ma session |
| Fermeture | Plus tard |

#### 4.4.2 Sheet de préparation

`Sheet` (`<dialog>`, focus piégé, Échap, retour du focus sur la Tile). Contenu, calculé à l'ouverture à partir de la semaine active (moteur pur, §7.3) :

1. **Tes boîtes.** Nombre de boîtes = nombre de conditionnements produits par l'étape « Frigo et congélateur » de `buildSession` : une boîte par repas portionné de chaque plat de batch, plus une par soir de soupe (`portioning.box` du moteur). **Type** : la taille en portions (« 2,5 portions ») et le conditionnement texte du plat (champ `box` du seed, par exemple « curry seul, riz à part »). *Le seed ne contient ni volume ni forme de boîte : aucune donnée de contenant n'est inventée (§11, Q5).* Répartition frigo / congélateur : un repas va au congélateur si son jour dépasse la durée de conservation au frigo du plat (`fridge`), comme dans le moteur.
2. **De la place.** « Libère de la place pour *a* boîtes au frigo et *b* au congélateur. » Si *b* = 0 : la ligne congélateur est omise.
3. **Tes courses.** « *k* articles sur *n* sont cochés. » + bouton « Vérifier ma liste » (vers Courses) ; si tout est coché : « Tes courses sont faites. »
4. **Durée et fin.** « Compte *durée* : fin prévue vers *heure*. » (durée du moteur avec le niveau choisi).
5. **Niveau.** `Segmented` « Débutant » / « À l'aise », **« Débutant » présélectionné** (§4.4.3), avec la phrase : « Débutant ajoute 20 % de marge à chaque étape, pour cuisiner sans courir. »
6. **Pied de Sheet :** bouton principal « C'est noté » (ferme), bouton secondaire « Voir ma session » (vers Session), lien discret « Décaler la session » (vers `/settings/session`, administrateur ; pour un autre membre : texte « Demande à l'administrateur du foyer de décaler la session »).

| Élément | Texte |
| --- | --- |
| Titre | Demain, ta première session |
| Section boîtes : titre | Tes boîtes |
| Section boîtes : texte | *n* boîtes à prévoir : *a* pour le frigo, *b* pour le congélateur. |
| Ligne de boîte | 1 boîte de 2,5 portions · mardi midi · curry seul, riz à part |
| Section place : titre | De la place |
| Section place : texte | Libère de la place pour *a* boîtes au frigo et *b* au congélateur. |
| Section courses : titre | Tes courses |
| Section courses : texte | *k* articles sur *n* sont cochés. / Tes courses sont faites. |
| Section durée : titre | Durée prévue |
| Section durée : texte | Compte *durée* : fin prévue vers *heure*. |
| Niveau : titre | Ton niveau |
| Niveau : aide | Débutant ajoute 20 % de marge à chaque étape, pour cuisiner sans courir. |
| Boutons | C'est noté · Voir ma session · Vérifier ma liste · Décaler la session |

#### 4.4.3 Niveau « débutant » par défaut

- À la première session, le niveau effectif est **`beginner`** (marge +20 %, SPEC §6 et `buildSession`) **sauf choix contraire** : `effectiveLevel = firstSessionLevel ?? 'beginner'` tant que le foyer n'a pas de `session_done`. Il s'applique à la durée affichée sur Menu, dans la Sheet et dans la carte de démarrage de Session.
- **Modifiable** : dans la Sheet et sur la carte de démarrage de Session (`Segmented`). Le choix est enregistré dans `onboarding_progress.first_session_level` et ne change **pas** le réglage Session du foyer.
- Après `session_done`, le niveau du réglage Session (`household_settings.session`, défaut actuel « à l'aise ») s'applique de nouveau.
- Décision (§11, Q4) : « débutant » s'applique à la première session **même si** le réglage du foyer est « à l'aise » (le code ne distingue pas un défaut d'un choix explicite). Seul le choix fait pour cette session (Sheet ou carte de démarrage) prévaut.

#### 4.4.4 Conseils pendant la première session (et seulement elle)

Trois conseils courts, **un à la fois, au bon moment**, uniquement tant que la session en cours est la première du foyer (`session_started` sans `session_done` au niveau du foyer). Ils utilisent le même composé `Coachmark`, ne comptent pas dans la limite de 2 bulles par jour, se mémorisent par compte (clés `fs_wake`, `fs_timers`, `fs_next`) et ont la priorité sur les bulles d'onglet.

| Clé | Déclencheur | Ancre | Texte |
| --- | --- | --- | --- |
| `fs_wake` | Affichage de la première étape après le lancement, **si** le Wake Lock a été obtenu (sinon le conseil est sauté) | Titre de l'étape | Ton écran reste allumé pendant la session : pas besoin de le toucher pour qu'il ne s'éteigne pas. |
| `fs_timers` | Premier minuteur lancé | Barre de minuteurs | Tes minuteurs restent en haut sur tous les onglets. Tu peux aller voir ta liste ou ton stock sans rien perdre. |
| `fs_next` | Première étape dont toutes les tâches sont cochées | Bouton « Étape suivante » | Toutes les tâches sont cochées : le bouton passe au vert. Appuie dessus pour passer à l'étape suivante. |

#### 4.4.5 Écran de fin de première session

Étend l'écran de fin existant (`SessionDoneBanner`, série de SPEC_PROGRES). Affiché à `session_done` du foyer :

- **Récapitulatif :** « *n* repas préparés » (nombre de repas portionnés) et « Durée réelle : *h* h *mm* » (de `sessions.started_at` à `sessions.done_at`). Si la durée est inconnue ou supérieure à 12 h, la ligne est omise.
- **Consigne du lundi soir :** rappel de la consigne du jour (`jj`) du **dîner du lundi** de la semaine, mise à l'échelle des portions. Repli : si le lundi soir est retiré ou absent, la consigne du **prochain dîner prévu** avec son jour (« Ton prochain dîner, mardi : … ») ; si aucun dîner n'est prévu, la ligne est omise.
- **Suite :** bouton « Voir ce soir » (vers Menu) ; la checklist passe en état de réussite (§4.1).

| Élément | Texte |
| --- | --- |
| Titre | Ta première session est faite |
| Récapitulatif | *n* repas préparés · Durée réelle : *h* h *mm* |
| Consigne | Lundi soir : *consigne* |
| Consigne (repli) | Ton prochain dîner, *jour* : *consigne* |
| Texte de clôture | Les soirs de semaine, il te suffit de sortir la boîte du jour et de la réchauffer. |
| Bouton | Voir ce soir |

**Critères d'acceptation**
```gherkin
Scénario: Sheet de préparation la veille de la session
  Étant donné un foyer sans session terminée dont la session est prévue demain
  Lorsqu'un membre ouvre Menu
  Alors la Tile « Demain, ta première session » est affichée
  Lorsqu'il ouvre la Tile
  Alors la Sheet affiche le nombre de boîtes, la place à libérer, l'état des courses, la durée et l'heure de fin
  Et le niveau « Débutant » est présélectionné
  Et un événement prep_sheet_opened est enregistré

Scénario: Pas de Tile hors veille
  Étant donné un foyer dont la session est prévue dans 3 jours
  Lorsqu'un membre ouvre Menu
  Alors aucune Tile « Demain, ta première session » n'est affichée

Scénario: Niveau débutant par défaut
  Étant donné la première session d'un foyer, niveau non modifié
  Lorsque la session est construite
  Alors sa durée est celle du niveau « beginner » (+20 %)

Scénario: Conseil du minuteur
  Étant donné la première session en cours
  Lorsqu'un membre lance son premier minuteur
  Alors un seul conseil est affiché : « Tes minuteurs restent en haut… »
  Et aucun conseil de session n'est affiché à la session suivante

Scénario: Écran de fin
  Étant donné la première session terminée
  Alors l'écran affiche le nombre de repas préparés, la durée réelle et la consigne du lundi soir
```

### 4.5 Séquence de messages J0 à J14

**Canaux.** E-mail (Resend, gabarits React Email dans `src/emails/`) **et** Web Push si l'appareil est autorisé (`push_subscriptions`). Un message logique = **une** ligne de `notification_log`, envoyé sur l'e-mail et, en plus, sur le push s'il existe ; événement `onboarding_message_sent {key, channel}` par canal.

**Destinataires.** Les comptes du foyer, à l'exception des comptes désinscrits (`user_settings.notifications.marketingEmails = false`, déjà géré par `/api/unsubscribe`). Le message J0 ne va qu'au compte créateur (c'est le `WelcomeEmail` existant, enrichi : pas de second e-mail de bienvenue).

**Déclenchement par le comportement.** Chaque message a une **date d'échéance** (calendrier) et une **condition d'envoi** (comportement) :

| Clé | Échéance (fuseau du foyer) | Envoyé si | Ignoré si |
| --- | --- | --- | --- |
| `welcome` | J0, à la fin de l'onboarding | Toujours (créateur) | — |
| `shopping_eve` | Veille du jour de courses du foyer, 18 h | Semaine active, étape d non faite | Étape d faite (`shopping_checked`) |
| `session_eve` | Veille de la session, 18 h | Première session non lancée | Étape e faite (`session_started`) |
| `session_late` | 3 jours après la date prévue de la session, 10 h | Aucune session lancée | Étape e faite |
| `session_after` | Lendemain de `session_done`, 10 h | Première session terminée | — |
| `week2` | `session_done` + 5 jours, 10 h | Aucune 2e semaine générée | 2e `week_generated` présent |

**Règles d'envoi** (fonction pure testée, §7.2)
1. **Au plus 1 message par jour et par compte** (jour local du foyer). Si deux messages sont dus le même jour, l'ordre de priorité est : `session_eve` > `shopping_eve` > `session_late` > `session_after` > `week2` > `welcome`. Le perdant est reporté au jour suivant **s'il tolère un jour de retard** (`welcome`, `session_late`, `session_after`, `week2`), sinon abandonné. Les messages de veille (`shopping_eve`, `session_eve`) ne sont **jamais** reportés : leur texte « demain » serait faux.
2. **Un message n'est pas envoyé si son étape est déjà faite** (colonne « Ignoré si »).
3. **Idempotence** par `notification_log` : une ligne par (compte, type `onboarding`, jour) **et** une ligne au plus par (compte, clé de message). Les deux garanties sont des index uniques (§5), atomiques : deux passages du cron ne produisent jamais deux envois.
4. **Fuseau :** toutes les échéances et le « jour » de la règle 1 suivent `households.timezone` (D3).
5. **Fenêtre :** la séquence couvre J0 à J14 après l'inscription. Exception : `session_after` et `week2`, rattachés à la session, peuvent partir jusqu'à `session_done` + 6 jours même au-delà de J14 (§11, Q6). Le masquage de la checklist coupe `shopping_eve`, `session_late` et `week2`, pas `session_eve` ni `session_after` (§11, Q7).
6. **Canaux et heures :** l'e-mail part si le compte n'est pas désinscrit (`marketingEmails`), le Web Push si l'appareil est consenti et abonné ; sans aucun des deux, rien ne part. Les messages de veille partent à partir de 18 h, les autres à partir de 10 h, heure du foyer. Le passage du planificateur (toutes les 15 minutes) appelle `runGettingStartedMessages` ; la bienvenue est aussi envoyée à la fin de l'onboarding, une fois le premier menu prêt (elle remplace l'ancien e-mail de bienvenue : pas de second message).
7. **Désinscription en un clic** : lien et en-tête `List-Unsubscribe` de tout e-mail de la séquence (mécanisme existant). Le push peut être coupé par le navigateur ou dans Réglages > Notifications.
8. **Jamais de reproche** : aucun texte ne mentionne un retard ou un oubli.
9. Cette séquence est **gratuite pour toutes les offres** (`can('onboarding')`) et distincte des rappels payants (`notifications.meals`) : voir §12 point 3 pour sa relation avec les types `shopping` et `session` REPORTÉS.

**Textes** (objet · corps · bouton ; `{…}` = variable calculée côté serveur ; signature commune « L'équipe Fin Prêt » portée par le gabarit)

**1. `welcome` — J0**
- Objet : Bienvenue chez Fin Prêt, ta semaine est prête
- Corps : Bonjour {prénom}, ta première semaine est prête : {n_repas} repas, ta liste de courses et une session le {jour_session} à {heure_session}. Voilà ce qui t'attend cette semaine : jeter un œil au menu et changer ce qui ne te tente pas, faire tes courses avec la liste, puis cuisiner le tout d'un coup avec la session guidée. Tu avances à ton rythme, on t'aide au bon moment.
- Bouton : Voir mon menu → `/app`
- Push : « Ta semaine est prête » · « {n_repas} repas, une liste, une session le {jour_session}. »

**2. `shopping_eve` — veille du jour de courses**
- Objet : Ta liste de courses est prête
- Corps : {prénom}, demain, c'est ton jour de courses. Ta liste compte {n_articles} articles, rangés par rayon. Si quelqu'un fait les courses avec toi, vous cochez chacun de votre côté et la liste se met à jour en direct.
- Bouton : Ouvrir ma liste → `/app/shopping`
- Push : « Ta liste est prête » · « {n_articles} articles, rangés par rayon. »

**3. `session_eve` — veille de la session**
- Objet : Demain, ta première session
- Corps : Demain, tu cuisines ta semaine en {durée}, fin prévue vers {heure_fin}. Pour être prêt·e : {n_boîtes} boîtes ({a} pour le frigo, {b} pour le congélateur), de la place au frigo et au congélateur, et tes courses faites. Tout le détail est dans ta fiche de préparation.
- Bouton : Préparer ma session → `/app?prep=1`
- Push : « Demain, ta première session » · « {n_boîtes} boîtes, {durée}, fin vers {heure_fin}. »

**4. `session_late` — 3 jours après la date prévue**
- Objet : On décale ta session ?
- Corps : Ta session était prévue {jour_session}. Ça arrive : une semaine a ses imprévus. Tu peux la caler sur un autre jour, ou alléger ta semaine pour cuisiner moins d'un coup. Dans les deux cas, ton menu reste là.
- Boutons : Choisir un autre jour → `/settings/session` · lien : Alléger ma semaine → `/settings/menu`
- Push : « On décale ta session ? » · « Choisis un autre jour ou allège ta semaine. »

**5. `session_after` — lendemain de la session**
- Objet : Bravo, ta première session est faite
- Corps : Tes {n_repas} repas sont prêts, bravo ! Les soirs de semaine, c'est simple : sors la boîte du jour, réchauffe, et c'est prêt. Chaque soir, le programme du jour te dit quoi servir et quoi sortir du congélateur pour le lendemain.
- Bouton : Voir ce soir → `/app`
- Push : « Bravo, ta première session est faite » · « Ce soir, il suffit de réchauffer. »

**6. `week2` — J+5 après la session**
- Objet : Ta semaine 2 t'attend
- Corps : Ta première semaine est derrière toi. Pour la suivante, l'app compose les repas et la liste en quelques secondes, et tu ajustes ce que tu veux.
- Bouton : Préparer ma semaine 2 → `/app` (ouvre la génération de la semaine suivante)
- Push : « Ta semaine 2 t'attend » · « Prépare-la en deux minutes. »

**Critères d'acceptation**
```gherkin
Scénario: Un seul message par jour
  Étant donné un compte pour lequel shopping_eve et session_eve sont dus le même jour
  Lorsque le cron d'envoi passe
  Alors seul session_eve est envoyé ce jour-là
  Et shopping_eve est envoyé le lendemain si son échéance n'est pas dépassée de plus d'un jour

Scénario: Étape déjà faite
  Étant donné un foyer dont les courses sont déjà cochées
  Lorsque la veille du jour de courses arrive
  Alors aucun message shopping_eve n'est envoyé

Scénario: Idempotence
  Étant donné session_eve déjà journalisé pour un compte
  Lorsque le cron passe deux fois dans la même fenêtre
  Alors un seul message est envoyé et une seule ligne existe dans notification_log

Scénario: Pas de session
  Étant donné une session prévue dimanche et jamais lancée
  Lorsque jeudi à 10 h (fuseau du foyer) arrive
  Alors le message « On décale ta session ? » est envoyé, sans aucun reproche

Scénario: Désinscription
  Étant donné un e-mail de la séquence
  Lorsque le compte suit le lien de désinscription
  Alors plus aucun e-mail de la séquence n'est envoyé à ce compte, et les e-mails transactionnels continuent
```

### 4.6 Aide dans l'app (Profil > Aide)

**Emplacement.** Page `/settings/help`, liée depuis Profil (visible par **tous** les membres, comme la section Profil : SPEC §6, critère « lecture seule »). Une entrée `help` est ajoutée à `MEMBER_SECTIONS` dans `src/lib/settings-sections.ts`. Enregistre `help_viewed` à l'ouverture. `PageHeader` + `Card`.

**Contenu**
1. **Ta première semaine** : si la checklist est masquée et non terminée → « Relancer la checklist » (§4.1) ; si terminée → ligne « Ta première semaine : terminée ».
2. **Les conseils** : « Revoir les conseils » vide `tips_seen` du compte (événement `tips_reset`) ; toast « Les conseils reviendront à ta prochaine visite de chaque onglet. » (toujours dans la limite de 2 par jour).
3. **Questions fréquentes** : 8 questions en accordéons (`<details>` natifs, accessibles au clavier) ; `faq_opened {key}` à l'ouverture.
4. **Nous écrire** : « Une question qu'on n'a pas prévue ? Écris-nous à bonjour@finpret.app. » avec un `LinkButton` `mailto:` « Écrire à l'équipe ».

| Élément | Texte |
| --- | --- |
| Titre de page | Aide |
| Description | Retrouve ici la checklist, les conseils et les réponses aux questions les plus courantes. |
| Carte checklist | Relancer la checklist · Elle reprend là où tu en étais. |
| Carte conseils | Revoir les conseils · Ils reviennent au fil de tes visites, deux par jour au plus. |
| Titre FAQ | Questions fréquentes |
| Contact | Une question qu'on n'a pas prévue ? Écris-nous à bonjour@finpret.app. |
| Bouton contact | Écrire à l'équipe |

**FAQ (8 questions)** — réponses fondées sur les fonctions de la SPEC et sur les droits de SPEC_JANVIER §4. Clés : `edit_meal`, `guest`, `add_member`, `pantry`, `freezing`, `move_session`, `share_shopping`, `cancel`.

1. **Comment modifier un repas ?** *(`edit_meal`)* — Sur un repas, touche ••• : « Changer » propose un autre plat, « Déplacer » le met sur un autre créneau, « Retirer » l'enlève de la semaine (tu peux le remettre). Sur l'offre gratuite, tu peux changer 3 repas par semaine ; « Déplacer » fait partie de l'essai et de l'abonnement.
2. **Comment gérer un invité à table ?** *(`guest`)* — Touche ••• sur le repas, puis « Qui est à table ? ». Règle le nombre d'adultes et d'enfants : les portions du repas s'adaptent. Cette option fait partie de l'essai et de l'abonnement.
3. **Comment ajouter un membre du foyer ?** *(`add_member`)* — Pour quelqu'un qui mange à ta table : Réglages > Foyer > Membres. Pour qu'une personne ait son propre accès (courses, session) : Réglages > Foyer > Invitations, puis envoie-lui le lien, valable 7 jours et utilisable une seule fois. Ces réglages sont réservés à l'administrateur du foyer. Le foyer compte 2 comptes sur l'offre gratuite, 8 en essai ou abonnement.
4. **À quoi sert le garde-manger ?** *(`pantry`)* — Tu y notes ce que tu as déjà : la liste de courses n'achète que ce qui manque. Une quantité vide veut dire « assez ». Le garde-manger fait partie de l'essai et de l'abonnement.
5. **Comment fonctionne la congélation ?** *(`freezing`)* — Pendant la session, la dernière étape te dit quelles boîtes vont au frigo et lesquelles au congélateur. Chaque jour, la tuile « Avant de dormir » t'indique ce qu'il faut sortir pour le lendemain. Avec l'essai ou l'abonnement, un rappel te le dit aussi à 20 h 30 (modifiable dans les réglages).
6. **Comment décaler la session ?** *(`move_session`)* — Va dans Réglages > Session et change le jour et l'heure. L'app te demande si le changement s'applique à la semaine en cours ou à partir de la prochaine. Si tu n'es pas administrateur du foyer, demande-lui de le faire.
7. **Comment partager les courses ?** *(`share_shopping`)* — Toutes les personnes du foyer voient la même liste, qui se met à jour en direct quand l'une d'elles coche un article. Invite la personne avec qui tu fais les courses (Réglages > Foyer > Invitations). Tu peux aussi envoyer la liste par message ou la copier. Sans réseau, elle reste consultable.
8. **Comment annuler mon abonnement ?** *(`cancel`)* — Va dans Abonnement, puis « Gérer mon abonnement » : tu arrives sur le portail de paiement où tu peux résilier. Ton foyer repasse alors à l'offre gratuite et tes données restent là. Pendant l'essai sans carte, il n'y a rien à annuler : il se termine tout seul.

**Critères d'acceptation**
```gherkin
Scénario: Relancer la checklist
  Étant donné la checklist masquée
  Lorsqu'un membre ouvre Profil > Aide puis « Relancer la checklist »
  Alors la carte réapparaît sur Menu avec ses étapes déjà cochées
  Et onboarding_restarted est enregistré

Scénario: Revoir les conseils
  Étant donné un compte dont tips_seen contient « shopping »
  Lorsqu'il choisit « Revoir les conseils »
  Alors tips_seen est vide
  Et la bulle Courses réapparaît à sa prochaine visite de Courses

Scénario: FAQ au clavier
  Étant donné la page Aide
  Lorsqu'un utilisateur ouvre la 3e question au clavier (Tab, Entrée)
  Alors la réponse est affichée et faq_opened {key: add_member} est enregistré

Scénario: Aide pour tous les rôles
  Étant donné un compte « membre » non administrateur
  Lorsqu'il ouvre /settings/help
  Alors la page s'affiche, sans « Inviter » ni lien vers un réglage qui lui est refusé
```

## 5. Modèle de données

Migration à créer : `supabase/migrations/20261110000000_getting_started.sql` (date indicative ; suivre la numérotation en cours).

```sql
-- Prise en main (SPEC_PRISE_EN_MAIN §5) : progression par foyer, lecture par les membres, écriture serveur seulement.
create table public.onboarding_progress (
  household_id uuid primary key references public.households on delete cascade,
  steps jsonb not null default '{}',        -- { "<step>": { "done_at": "…", "by": "<user_id>|null", "via": "event|solo" } }
  first_session_level text check (first_session_level in ('beginner','confident')),
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.onboarding_progress enable row level security;
create policy onboarding_progress_select on public.onboarding_progress
  for select to authenticated using (public.is_household_member(household_id));
revoke insert, update, delete on public.onboarding_progress from authenticated, anon;
revoke all on public.onboarding_progress from anon;

-- Conseils vus : par compte (pas par foyer), écriture serveur seulement.
alter table public.user_settings add column tips_seen text[] not null default '{}';
revoke update (tips_seen) on public.user_settings from authenticated;   -- à adapter si user_settings n'a pas de grant par colonne : voir TODO(spec)

-- Journal d'envoi : nouveau type et idempotence par message.
alter table public.notification_log drop constraint notification_log_kind_check;
alter table public.notification_log add constraint notification_log_kind_check
  check (kind in ('dinner','thaw','shopping','session','test','canteen_published','trial_ending','onboarding'));
-- Une clé de message au plus par compte (le couple compte-type-jour est déjà unique : un message par jour).
create unique index notification_log_onboarding_key
  on public.notification_log (user_id, (payload->>'key')) where kind = 'onboarding';

-- Compte des conseils du jour : lecture serveur des événements par compte.
create index events_user_name_created_idx on public.events (user_id, name, created_at desc);
```

**RLS testée** (pgTAP sur PGlite, `pnpm test:db:lite`, nouveau fichier `14_getting_started_rls.test.sql`) :
- un membre du foyer A lit `onboarding_progress` de A ; **aucune ligne** de B (aucun accès inter-foyer) ;
- `insert`, `update`, `delete` par `authenticated` sur `onboarding_progress` : refusés (0 ligne ou erreur) ;
- `update user_settings set tips_seen = …` par `authenticated` : refusé ; un autre compte ne lit jamais `tips_seen` d'autrui ;
- `notification_log` : insertion client refusée ; deux insertions de la même clé `onboarding` pour un compte : la seconde échoue ; deux messages `onboarding` le même jour : la seconde échoue ;
- `events` : toujours aucun accès client.

## 6. Événements (table `events`)

Ajouter dans `EVENT_NAMES` (`src/lib/events.ts`). Écriture par `trackEvent` (clé de service) ; les événements issus du client passent par l'action serveur `recordWeekEvent`-like dont la liste blanche est étendue **uniquement** à `tip_shown`, `tip_dismissed`, `prep_sheet_opened`, `help_viewed`, `faq_opened`.

| Événement | Props | Déduplication |
| --- | --- | --- |
| `onboarding_step_done` | `{step, via?}` | Une fois par foyer et par `step` |
| `onboarding_dismissed` | — | À chaque masquage |
| `onboarding_completed` | — | Une fois par foyer |
| `tip_shown` | `{key}` | À chaque affichage |
| `tip_dismissed` | `{key}` | À chaque fermeture |
| `prep_sheet_opened` | — | À chaque ouverture |
| `help_viewed` | — | À chaque ouverture |
| `faq_opened` | `{key}` | À chaque ouverture |
| `onboarding_message_sent` | `{key, channel}` (`email` ou `push`) | Une fois par compte, clé et canal |

**Événements ajoutés par rapport à la demande, nécessaires à la détection des étapes** (§12 point 4) :

| Événement | Props | Rôle |
| --- | --- | --- |
| `menu_move` | `{week}` | Étape b (Déplacer) : seul `menu_swap` existe aujourd'hui |
| `menu_removed` | `{week}` | Étape b (Retirer) |
| `invitation_sent` | — | Étape c |
| `onboarding_restarted` | — | Relance depuis l'Aide |
| `tips_reset` | — | « Revoir les conseils » |

Les événements existants servent tels quels : `signup`, `onboarding_done`, `week_generated`, `shopping_checked`, `session_started`, `session_done`, `menu_swap`.

## 7. Tests

### 7.1 Vitest — état de la checklist (fonction pure)

`src/engine/getting-started.ts` : `computeChecklist(input) → { steps, doneCount, completed, successVisible }`, **sans import de React ni de Supabase** (CLAUDE.md, règle 2). Entrée : événements du foyer (nom, `user_id`, date, props), nombre de comptes, invitations envoyées, choix « seul·e », état enregistré, `dismissed_at`, `completed_at`, date courante.

Tests (`src/engine/getting-started.test.ts`), **un cas par étape** :
1. `discover_menu` : cochée dès que la ligne existe ;
2. `adjust_meal` : coché par `menu_swap`, puis par `menu_move`, puis par `menu_removed` (trois cas) ;
3. `invite` : cochée par `invitation_sent` ; par un 2e compte ; **par « Je cuisine seul·e »** (`via: solo`) ; jamais décochée si le 2e compte part ;
4. `shop` : coché par `shopping_checked` ;
5. `start_session` : coché par `session_started` ;
6. `finish_session` : coché par `session_done` ;
7. **coche par un autre membre du foyer** : `shopping_checked` d'un `user_id` différent du créateur coche l'étape pour le foyer ;
8. événements d'**un autre foyer** : aucune incidence ;
9. monotonie : une étape cochée le reste, même si l'événement disparaît (suppression de compte) ;
10. fin : cinq étapes obligatoires cochées sans `invite` → `completed = true` ; avec `invite` cochée mais `finish_session` manquante → `completed = false` ;
11. visibilité : `dismissed_at` → masquée ; réussite visible 3 jours puis plus ; réduction automatique après 21 jours.

Test de ton : aucun texte des clés listées au principe 4 ne contient les motifs interdits.

### 7.2 Vitest — règle d'envoi des messages (fonction pure)

`src/engine/getting-started-messages.ts` : `planMessage({ now, tz, account, household, events, log, unsubscribed }) → { send: key | null, reason }`.
Cas : (a) **un message par jour** (deux dus le même jour → priorité `session_eve`, le second reporté) ; (b) report abandonné si l'échéance est dépassée de plus d'un jour ; (c) **message non envoyé si l'étape est faite** (un cas par message conditionnel : `shopping_eve`, `session_eve`, `session_late`, `week2`) ; (d) **idempotence** : clé déjà journalisée → aucun envoi, deux appels successifs → un seul envoi ; (e) fuseau : la veille se calcule en `Europe/Paris` et en `Pacific/Auckland` pour la même instant ; (f) désinscrit → aucun envoi ; (g) hors fenêtre J14 → aucun envoi sauf exception de session ; (h) `welcome` uniquement pour le créateur ; (i) `session_late` jamais avant J+3.

### 7.3 Vitest — autres

- `can(offer, 'onboarding')` vaut `true` pour `free`, `trial`, `monthly`, `yearly`, avec ou sans association.
- `prepSheet(week, session, level)` : nombre de boîtes cohérent avec l'étape « Frigo et congélateur » de `buildSession` sur les 5 semaines de référence ; répartition frigo / congélateur ; niveau `beginner` = +20 % sur la durée ; aucun `undefined` ni `NaN` dans les textes.
- Écran de fin : consigne du lundi soir, repli sur le prochain dîner, durée réelle omise au-delà de 12 h.
- `tipFor` : au plus 2 par jour, une par écran, clé vue ignorée, bulle Stock masquée hors offre payante.
- Gabarits d'e-mail : rendu des 6 messages sans `undefined`, lien de désinscription présent.

### 7.4 Requête d'indicateurs (fournie, non exposée dans l'interface)

```sql
-- Activation à 10 jours et 2e semaine (par cohorte d'inscription).
with cohort as (
  select e.household_id, min(s.created_at) as signup_at
  from events e join events s on s.user_id = e.user_id and s.name = 'signup'
  where e.name = 'onboarding_done' group by e.household_id
)
select count(*) as foyers,
  count(*) filter (where exists (select 1 from events d where d.household_id = c.household_id
    and d.name = 'session_done' and d.created_at <= c.signup_at + interval '10 days')) as activated_10d,
  count(*) filter (where (select count(distinct props->>'week') from events w
    where w.household_id = c.household_id and w.name = 'week_generated') >= 2) as week2
from cohort c;
```
`week_generated` porte `props.week` (date de début de semaine) et `props.regenerated` : une régénération de la même semaine n'est donc pas comptée comme une 2e semaine.

### 7.5 Playwright (`tests/e2e/getting-started.spec.ts`)

1. **Parcours complet :** nouveau foyer → la checklist « Ta première semaine » est visible à « 1 sur 6 » → changer un repas (« 2 sur 6 ») → cocher une course → lancer puis terminer une session → la carte de réussite s'affiche → « Fermer » → la carte a disparu et ne revient pas après rechargement.
2. **Bulle Courses :** affichée à la première visite, absente à la seconde.
3. **Sheet de préparation la veille :** foyer de test dont le jour de session est réglé au lendemain (pas de manipulation d'horloge : le seed place la session au jour suivant) → Tile visible → Sheet avec boîtes, place, courses, durée, niveau « Débutant » présélectionné.
4. **Masquer puis relancer** depuis Aide.
5. **Coche par un autre membre** : deux contextes de navigateur dans le même foyer.

### 7.6 Accessibilité (axe, `tests/e2e/a11y.spec.ts`)

Aucune violation, **en clair et en sombre**, sur : Menu avec checklist (réduite et développée, bulle visible), Aide (FAQ ouverte), Sheet de préparation ouverte. Vérifications manuelles consignées dans le récapitulatif : navigation clavier complète, `prefers-reduced-motion`, zoom 200 %.

## 8. Cas limites

| Cas | Comportement |
| --- | --- |
| **Foyer rejoint par invitation** | Le nouvel invité arrive sur le foyer existant : il voit la **checklist du foyer** dans son état courant (rien n'est refait) et ses **propres bulles** (`tips_seen` vide). Il ne reçoit pas `welcome` (réservé au créateur) mais reçoit les messages de séquence encore dus. Son arrivée coche l'étape « Inviter » (2e compte) pour le foyer. |
| **Membre qui arrive après la première session** | La checklist est peut-être terminée ou masquée : rien ne s'affiche. Il voit ses bulles d'onglet (max 2 par jour). Les conseils de première session et la Tile ne lui sont pas proposés (la « première session » est celle du foyer). Il reçoit `week2` si elle est encore due. |
| **Semaine régénérée** | Une étape cochée reste cochée. La Sheet recalcule boîtes, durée et heure à chaque ouverture. Les messages calculent leurs variables à l'envoi. Une régénération ne relance ni la Tile fermée ni un message déjà envoyé. |
| **Notifications refusées** | Le push est ignoré sans erreur ; l'e-mail part (sauf désinscription). L'état vide n° 14 explique comment activer. Aucun message n'insiste. |
| **Foyer qui saute la première session** | La session prévue passe sans `session_started` : `session_late` part 3 jours après (une seule fois). La Tile et `session_eve` se reportent à la **prochaine date de session prévue** tant qu'aucune session n'est terminée. Étapes e et f restent à faire ; la 2e semaine peut être générée sans elle (indicateur secondaire). La checklist se réduit seule au 21e jour, sans disparaître. |
| **Foyer créé avant la mise en production** | Aucune ligne `onboarding_progress`, aucune checklist, aucune séquence (la migration ne crée pas de lignes). Les bulles s'appliquent (par compte). |
| **Fuseau modifié** | Les échéances futures suivent le nouveau fuseau ; un message déjà journalisé n'est jamais renvoyé. |
| **Deux membres cochent en même temps** | Le calcul est idempotent ; l'événement `onboarding_step_done` n'est enregistré qu'une fois (déduplication par foyer et étape). |
| **Compte créateur supprimé** | La checklist du foyer persiste (portée par `household_id`) ; `by` de l'étape devient orphelin et n'est pas affiché. |
| **Session lancée puis abandonnée** | Étape e cochée ; `session_late` est ignoré ; la Tile ne revient pas ; l'étape f reste à faire. |
| **Wake Lock indisponible** | Le conseil `fs_wake` est sauté ; aucun message d'erreur. |
| **Offre gratuite au-delà de 3 changements** | L'étape b reste cochable par « Retirer » ; aucun écran d'abonnement n'est imposé par la prise en main. |

## 9. Insertion dans les jalons de SPEC_JANVIER §9 (sans repousser le gel du 18 décembre)

**Constat.** Selon `docs/RECAP_JANVIER.md` (état au 20 octobre), **J0 à J8 sont déjà livrés** dans le code ; les jalons J5, J7 et J8 sont donc **clos**. Insérer la prise en main « avec J5, J7, J8 » reviendrait à les rouvrir. Proposition : trois **sous-jalons** qui reprennent le périmètre de ta recommandation, portent le suffixe `b`, et se placent avant le gel. Dates à partir du lundi 26 octobre 2026 :

| Sous-jalon | Rattaché à | Dates | Contenu | Définition de « terminé » |
| --- | --- | --- | --- | --- |
| **J5b-1** | J5 (écran Menu) | 2 – 13 nov. | Migration, `can('onboarding')`, événements (§6), moteur pur `getting-started`, `computeChecklist`, checklist, bulles, états vides n° 1 à 7, 9 à 11, 13 à 17 | Tests §7.1 et §7.3 verts ; pgTAP 14 vert ; Playwright 1, 2, 4, 5 ; axe sur Menu |
| **J5b-2** | J5 (session guidée) | 16 – 27 nov. | Tile, Sheet de préparation, niveau débutant, 3 conseils de première session, écran de fin | Playwright 3 ; axe sur la Sheet ; parcours session existant inchangé |
| **J7b** | J7 (e-mails, notifications) | 30 nov. – 4 déc. | Séquence J0–J14 (6 messages), gabarits React Email, passe dédiée dans `/api/cron/notify`, journal et idempotence | Tests §7.2 verts ; envoi de test des 6 messages (Resend en mode test) ; pas de doublon sur 2 passages |
| **J8b** | J8 (a11y, recette) | 7 – 11 déc. | Aide (relance, conseils, FAQ, contact), audit axe final (Menu, Aide, Sheet, clair et sombre) | axe sans violation ; recette du parcours complet |
| Marge | — | 14 – 18 déc. | **Aucun développement nouveau** : corrections, recette, gel le 18 décembre | — |

La bêta fermée (J9, 20 foyers) mesure les indicateurs : **tout doit être livré avant le gel**.

**Ce qui peut être retiré en cas de glissement** (dans cet ordre) : 1) la **FAQ** (le reste de l'Aide reste) ; 2) les **bulles** (`Coachmark` d'onglet, pas les conseils de première session) ; 3) le message **`session_late`**. **Jamais retirés :** la **checklist** et la **Sheet de préparation**. Si un sous-jalon glisse de plus d'une semaine, appliquer ce retrait avant d'empiéter sur la marge du 14 au 18 décembre. *(Remarque : `session_late` est le seul message qui relance un foyer qui n'a pas cuisiné ; le retirer pèse directement sur l'indicateur principal. Voir §11, Q8.)*

**Mises à jour de SPEC_JANVIER à faire après validation** (étape 4 de la demande) : §1 (nouvel indicateur d'activation à 10 jours et événements ajoutés), §2 (ligne « Prise en main » dans le périmètre), §4 (`onboarding` dans les droits), §9 (sous-jalons ci-dessus et ordre de retrait), §10 (route `/settings/help`), §12 (questions de la prise en main).

## 10. Routes, fichiers et composants

| Élément | Chemin |
| --- | --- |
| Aide | `/settings/help` (tous les membres) |
| Sheet de préparation | `/app?prep=1` (ouvre la Sheet sur Menu) |
| Moteur pur | `src/engine/getting-started.ts`, `getting-started-messages.ts`, `prep-sheet.ts` (+ tests) |
| Serveur | `src/server/getting-started.ts` (synchronisation, `tipFor`), `src/server/actions/getting-started.ts` (masquer, relancer, « seul·e », conseils), passe d'envoi branchée sur `/api/cron/notify` |
| Composants | `src/components/ui/{Checklist,Tile,Coachmark}.tsx` (assemblages de l'existant, ajoutés à la galerie), `src/components/getting-started/*` |
| E-mails | `src/emails/getting-started.tsx` (6 gabarits sur le `Layout` existant) ; `sendWelcome` enrichi |
| Textes | `src/i18n/fr.ts` |
| Droits | `src/server/entitlements.ts` : `Feature` + `ALWAYS` |
| Documentation | `docs/DESIGN_SYSTEM.md` (3 composés), `docs/SPEC_JANVIER.md` |

## 11. Décisions prises (questions ouvertes tranchées)

Ces points étaient ouverts à la rédaction ; ils sont **arrêtés** et appliqués dans le code. Les contester = demander une modification de cette section.

| # | Question | Décision |
| --- | --- | --- |
| Q1 | Objectif d'activation à 10 jours | **40 %** des foyers ayant fini l'onboarding (cohérent avec 75 sur 150 sans délai, et le délai de 10 jours retire une partie des sessions tardives). À réviser après la bêta J9. |
| Q2 | Date d'« inscription » | Événement `signup` du compte créateur. |
| Q3 | « Une seule aide » et cartes permanentes | La règle s'applique aux aides **transitoires** (bulle, conseil de première session, Sheet). La checklist, la Tile et la tuile de série sont des cartes permanentes ; la checklist se réduit à son en-tête quand la Tile est affichée. |
| Q4 | Niveau débutant et réglage existant | À la première session, `débutant` s'applique **même si** le réglage du foyer est « à l'aise » (le code ne distingue pas défaut et choix explicite, l'onboarding ne demande pas le niveau). Le choix fait dans la Sheet ou sur la carte de démarrage prévaut ; il ne change pas le réglage du foyer. |
| Q5 | Type de boîtes | Taille en portions + conditionnement texte du seed (`box`). Aucune table de contenants (volume, forme) n'est inventée. |
| Q6 | Fenêtre de la séquence | `session_after` et `week2` peuvent partir jusqu'à `session_done` + 6 jours, même au-delà de J14. |
| Q7 | Masquage de la checklist et messages | Le masquage coupe `shopping_eve`, `session_late` et `week2` ; il ne coupe ni `session_eve` ni `session_after` (utilité concrète). |
| Q8 | Ordre de retrait en cas de glissement | Celui de la demande : FAQ, bulles d'onglet, `session_late`. Le risque pour l'indicateur principal est signalé dans le récapitulatif de J7b. |
| Q9 | Base légale des e-mails d'accompagnement | Ils respectent `marketingEmails` et la désinscription en un clic ; texte juridique `TODO(juriste)`. |
| Q10 | Masquer la checklist | Tout membre peut la masquer pour le foyer (sans conséquence, relançable). |

## 12. Écarts constatés avec les documents existants

1. **Design system :** `Checklist`, `Tile` et un composant de bulle **n'existent pas** dans `docs/DESIGN_SYSTEM.md` ni dans `src/components/ui/`. Seuls `StatTile`, `ListRow`, `ProgressBar`, `EmptyState`, `Callout`, `Sheet`, `Pill`/`Badge` existent. Le document les définit comme des **assemblages** de l'existant, sans nouveau jeton (règle d'usage du design system : un nouveau composant va dans `src/components/ui/`, `index.ts` et la galerie).
2. **Sources absentes du dépôt :** `brand/charte-fin-pret.md` (citée par CLAUDE.md et SPEC_JANVIER §0) et `design-system/README.md` n'existent pas (`design-system/` ne contient que `tokens.json` ; RECAP_JANVIER, point 6, le signalait déjà). Les textes sont donc à relire contre la charte quand elle sera fournie.
3. **Notifications REPORTÉES :** SPEC_JANVIER §2 reporte « Courses prêtes » et « début de session » ; `FEATURES.shoppingSessionNotifications = false`. Les messages `shopping_eve` et `session_eve` leur ressemblent. **Lecture retenue :** ce sont des messages **ponctuels de la séquence d'accueil** (jusqu'à la première session, type `onboarding`), **pas** les rappels récurrents ; le drapeau reste à `false`. Si cette lecture est refusée, retirer ces deux messages et ne garder que 4 messages.
4. **Événements manquants :** SPEC_JANVIER §1 ne liste que `menu_swap` pour les modifications de repas ; « Déplacer » et « Retirer » n'ont aucun événement, et aucun événement n'existe pour l'envoi d'une invitation. D'où `menu_move`, `menu_removed`, `invitation_sent` (§6), en plus des événements demandés.
5. **Droits et principe 5 (« gratuit pour toutes les offres ») :** le garde-manger (`pantry`), « Déplacer » et « Qui est à table ? » sont réservés à l'essai et à l'abonnement (SPEC_JANVIER §4). La prise en main est gratuite mais **ne doit pas promouvoir** une fonction verrouillée : bulle Stock masquée hors offre payante, étape b cochable par « Retirer », réponses FAQ qui mentionnent l'offre. L'état vide du garde-manger pour un foyer gratuit reste à décider : proposer l'écran existant d'`UpgradeCard`, ou le masquer.
6. **Onboarding à 4 étapes :** SPEC §5 décrit 5 étapes ; SPEC_JANVIER §2 en retient 4 (habitudes REPORTÉ). SPEC_JANVIER prévaut : la demande (4 étapes) est cohérente.
7. **Table `onboarding_progress` :** une colonne est ajoutée à celle demandée, `first_session_level` (choix du niveau pour la première session, §4.4.3).
8. **Idempotence :** l'index existant `notification_log_once` garantit un message **par type et par jour**, pas « au plus 1 message par jour et par compte » toutes séquences confondues, ni « une seule fois par message ». Deux index nouveaux (§5) le garantissent pour la séquence ; la relation avec les autres types (dîner, décongélation, fin d'essai) reste à trancher : la règle retenue ne limite **que** la séquence d'accueil.
9. **Congélateur :** l'état vide « congélateur » est REPORTÉ (`freezerAndLeftovers`). La Sheet de préparation parle de **place** au congélateur (boîtes de la semaine), pas de réserve : aucune dépendance au report.
10. **Branche et état du dépôt :** le travail s'exécute dans le worktree `spec-seo` (branche `optim-seo`, qui contient des modifications SEO non commitées d'une autre session). Le fichier est créé ici sans y toucher ; à rapatrier sur une branche dédiée avant le développement.
