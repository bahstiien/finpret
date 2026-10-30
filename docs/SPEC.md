# SPEC — Menu de la semaine (V1)

> Spécification d'implémentation destinée à Claude Code. Le français est la langue de l'interface.
> Mots-clés : **DOIT** = obligatoire en V1, **DEVRAIT** = attendu sauf contrainte forte, **PEUT** = optionnel.

---

## 1. Vision

Une PWA multi-foyers qui :
1. compose chaque semaine les repas du foyer (midis et soirs du lundi au vendredi, idées pour le week-end) ;
2. génère une liste de courses partagée en temps réel, en contenants réels du commerce ;
3. guide une **session de batch cooking** le dimanche (planning parallélisé, minuteurs) ;
4. accompagne chaque jour (programme du jour, décongélation, menu de la cantine, notifications) ;
5. permet d'**importer ses propres recettes** depuis un lien (Marmiton, 750g, Cuisine AZ, blogs…), qui entrent dans le générateur.

Le prototype `reference/menu-legacy.html` implémente déjà ces fonctions pour un seul foyer : **son comportement fait référence** pour le moteur.

## 2. Glossaire

| Terme | Définition |
|---|---|
| Foyer (household) | Unité de partage : membres, réglages, menus, courses, stock |
| Compte (user) | Personne qui se connecte ; appartient à un ou plusieurs foyers |
| Membre (member) | Personne du foyer qui mange (adulte ou enfant), avec ou sans compte |
| Semaine (week) | Plan du lundi au dimanche ; session le dimanche précédent (jour 0) |
| Créneau (slot) | Couple jour (1 = lundi … 7 = dimanche) et repas (`lunch` ou `dinner`) |
| Plat de batch (main) | Recette préparée pendant la session, qui couvre 1 à 3 créneaux |
| Soupe du soir (soup) | Préparée pendant la session, servie sur 2 soirs |
| Soir simple (simple) | Cuisiné le jour même, en 15 à 25 min |
| Portion | Unité adulte ; un enfant vaut une fraction (§7.3) |
| Réserve congélateur (bank) | Repas congelés disponibles, utilisés en priorité |
| Garde-manger (pantry) | Ingrédients en stock, avec quantité |

## 3. Rôles et permissions

| Action | Administrateur | Membre | Lecture seule |
|---|---|---|---|
| Voir menu, courses, programme du jour | ✓ | ✓ | ✓ |
| Cocher des courses, ajouter un article | ✓ | ✓ | ✓ |
| Générer ou modifier le menu, gérer le stock, mener la session | ✓ | ✓ | — |
| Paramétrage du foyer, membres, invitations, suppression | ✓ | — | — |

Il DOIT toujours y avoir au moins un administrateur par foyer. Le créateur du foyer est administrateur.

## 4. Authentification et comptes

- **Connexion par lien magique e-mail** (Better Auth), **Apple** et **Google** (OAuth). Le mot de passe PEUT être activé plus tard ; il n'est pas dans la V1.
- **Après la première connexion :** si l'utilisateur n'a aucun foyer, il crée un foyer ou rejoint un foyer via une invitation, puis passe à l'onboarding.
- **Invitations :**
  - lien signé (jeton aléatoire, expiration 7 jours, usage unique) ou envoi par e-mail ;
  - à l'ouverture du lien : connexion si nécessaire, puis adhésion avec le rôle prévu ;
  - l'administrateur peut révoquer une invitation en attente.
- **Multi-foyers :** un compte PEUT appartenir à plusieurs foyers (garde alternée, grands-parents), avec un sélecteur dans le profil. Le foyer actif est mémorisé par appareil.
- **Profil :** nom, e-mail, appareils connectés (déconnexion à distance), abonnements aux notifications.
- **RGPD :** export JSON de toutes les données du foyer, suppression du compte (et du foyer s'il ne reste aucun administrateur, avec confirmation forte), consentement explicite aux notifications, hébergement en région UE.

## 5. Onboarding (5 étapes, 5 minutes)

Assistant plein écran avec barre de progression, retour arrière possible, et valeurs par défaut sensées. L'utilisateur PEUT passer une étape.

| Étape | Champs | Défauts |
|---|---|---|
| 1. Foyer | Nom du foyer ; membres (prénom, adulte ou enfant, date de naissance pour les enfants) ; garde alternée (oui ou non, semaine de départ) | 2 adultes |
| 2. Alimentation | Régime du foyer (omnivore, flexitarien, végétarien, pescétarien) ; 14 allergènes réglementaires ; ingrédients refusés (recherche dans les ingrédients) | Omnivore, aucun |
| 3. Rythme | Créneaux couverts (grille 5 × 2, plus le week-end en option) ; présence par membre et par créneau (par exemple « Léo : cantine le midi en semaine ») ; jour et heure de la session ; durée maximale | Tout couvert, dimanche 14 h, 3 h |
| 4. Équipement | Four (nombre de grilles), plaques (nombre), air fryer, micro-ondes, robot pâtissier, blender chauffant, mixeur plongeant, autocuiseur, congélateur | Four 2 grilles, 4 plaques, micro-ondes, congélateur |
| 5. Habitudes | Jour de courses ; heures de notification ; magasin habituel (texte libre en V1) | Samedi, 17 h 30 et 20 h 30 |

**Fin de l'onboarding :** génération du premier menu (§7), avec un écran récapitulatif de la semaine, de la durée de session et du nombre d'articles, puis arrivée sur l'onglet Menu.

**Critères d'acceptation**
```gherkin
Scénario: Premier menu après l'onboarding
  Étant donné qu'un nouvel utilisateur s'est connecté par lien magique
  Lorsqu'il termine les 5 étapes en gardant les valeurs par défaut
  Alors un foyer est créé avec lui comme administrateur
  Et une semaine en brouillon est générée pour le lundi suivant
  Et l'onglet Menu affiche 10 repas, la durée de session et la liste de courses
```

## 6. Tableau de bord de paramétrage (`/settings`)

Réservé à l'administrateur, sauf la section Profil. Chaque section est un formulaire autonome (validation Zod) qui s'enregistre automatiquement, avec un toast « Enregistré ». Quand un changement affecte la semaine en cours, l'app propose : « Appliquer à la semaine en cours » ou « À partir de la prochaine ».

| Section | Contenu |
|---|---|
| **Foyer** | Membres (ajout, édition, archivage) ; portion calculée selon l'âge, modifiable ; règles de présence par créneau ; calendrier de garde alternée (semaines A et B) ; comptes liés et rôles ; invitations |
| **Alimentation** | Régime du foyer et par membre ; allergènes (exclusion stricte) ; ingrédients refusés ; objectifs (minimum de repas végétariens par semaine, protéines minimales par repas) |
| **Menu** | Équilibre par protéine (plafonds par défaut : volaille 2, bœuf 1, porc 1, poisson 1, végétarien 2, tous modifiables) ; plats de pâtes (1 à 2) ; plats au four maximum (2) ; soirs légers (0 à 4) ; recettes du monde minimum (0 à 3) ; plats réconfort (jamais, 1 toutes les 2 semaines, 1, 2) ; repas tirés du congélateur (0 à 4) ; période sans répétition (2 à 6 semaines, 3 par défaut) ; goûter de la semaine (oui ou non, jour, types) |
| **Session** | Jour et heure ; durée maximale ; équipement (repris de l'onboarding) ; niveau (débutant, à l'aise : marges de temps de +20 % ou +0 %) ; sonnerie et vibration |
| **Courses** | Ordre des rayons (glisser-déposer) ; articles récurrents ; placard de base (ingrédients `base` à vérifier) ; format d'export |
| **Cantine** | Par enfant : jours de cantine et source du menu (saisie, import PDF, URL) ; alerte doublon activée ou non |
| **Notifications** | Par compte : canaux (push, e-mail), rappels activés et heures (plat du soir, décongélation, courses prêtes, début de session) |
| **Données** | Export JSON, historique des semaines, suppression du foyer |
| **Profil** (tous) | Nom, foyer actif, appareils, déconnexion |

**Critères d'acceptation**
```gherkin
Scénario: Exclusion d'un allergène
  Étant donné un foyer avec l'allergène « arachides » coché
  Lorsque le menu est généré ou qu'un plat est changé
  Alors aucune recette contenant un ingrédient marqué arachides n'est proposée
  Et le catalogue Découvrir masque ces recettes, sauf avec le filtre « Afficher tout », où elles sont marquées

Scénario: Un membre en lecture seule ne voit pas le paramétrage
  Étant donné un compte avec le rôle « lecture seule »
  Lorsqu'il ouvre /settings
  Alors seule la section Profil est accessible
```

## 7. Moteur métier (`src/engine/`, TypeScript pur)

Porter fidèlement les fonctions du prototype (`reference/menu-legacy.html`). Correspondance :

| Module | Fonctions de référence dans le prototype |
|---|---|
| `season.ts` | `vegKeys`, `pantryCovers`, `optOk`, `eligible`, `resolve`, `NOT_SEASONAL` |
| `slots.ts` | `buildSlots`, `gMax`, `assignGroups` |
| `compose.ts` | `fits`, `completeMains`, `pickMains`, `compose`, `fixPasta`, `pastaCount`, `pastaClash`, `addsPastaClash`, `wshuffle`, `pantryScore` |
| `edit.ts` | `swap` (Changer), `moveSlot`, `slotEntity`, `setEntitySlot`, `canGo`, retrait et remise d'un repas, `suggestWeekend` |
| `portions.ts` | `mealPd`, `defaultGuests`, `guestsOf`, `kidF` |
| `quantities.ts` | `totals`, `needs`, `fmtQ`, `fill`, `snapNum`, `packBest`, `packBuy`, `shopQ`, `pantryAfterWeek` |
| `session.ts` | `buildSession` (planning, minuteurs, portionnage, ingrédients de session) |
| `nutrition.ts` | Moyennes kcal et protéines par jour (vue impression) |

### 7.1 Entrées et sorties
```ts
type EngineContext = {
  month: number;                         // mois du lundi de la semaine
  settings: MenuSettings;                // §6 Menu
  diet: DietRules;                       // régimes, allergènes, refus
  members: Member[]; presence: PresenceRule[];
  pantry: Record<IngredientKey, number | null>;
  bank: { recipeId: string; portions: number; frozenAt: string }[];
  history: string[][];                   // ids des N semaines précédentes
  ratings: Record<string, 1 | -1>;
  equipment: Equipment;
  random: () => number;                  // injectable pour des tests déterministes
};
generateWeek(ctx, startDate): WeekPlan;  // null si impossible, avec la raison
```

### 7.2 Saisonnalité et variantes
- Une recette est **éligible** au mois M si `months` est absent ou contient M, **ou** si tous ses légumes saisonniers sont au garde-manger ; et, si elle a des variantes `sv`, qu'au moins une est disponible.
- **Résolution des variantes :** d'abord la variante dont les légumes sont au garde-manger, sinon celle du mois, sinon la première. Ses `ing` et `prep` sont fusionnés dans la recette.
- **Tirage pondéré :** priorité aux recettes qui utilisent le garde-manger (poids 1 pour viande, frais et légumes, 0,3 sinon) et aux favoris (+0,7).

### 7.3 Composition de la semaine
1. **Créneaux** (`buildSlots`) : soirs légers choisis dans l'ordre mardi, jeudi, mercredi, vendredi, lundi. Les 2 premiers sont des soirs de soupe (même soupe), les suivants des soirs simples. Les créneaux de la réserve congélateur sont pris dans l'ordre vendredi midi, jeudi midi, vendredi soir… Chaque plat de batch couvre un dîner et le déjeuner du lendemain ; jamais le même plat midi et soir le même jour, sauf si aucune autre solution.
2. **Plats** (`pickMains` puis `completeMains`) : plafonds par protéine, au plus 2 plats au four, une famille `grp` au plus une fois, nombre exact de plats réconfort, au moins 1 végétarien dès 4 plats, minimum de plats de pâtes. Les plats non congelables vont sur les créneaux compatibles avec leur `fridge`.
3. **Soupe et soirs simples,** puis **recettes du monde** au moins égales au réglage (assoupli si impossible).
4. **Règle des pâtes :** au plus un repas de pâtes par jour (soupes, soirs simples, réserve et week-end compris) ; si nécessaire, permuter les plats (`fixPasta`) ; en dernier recours, abaisser le minimum de pâtes (`pastaNeed` mémorisé dans la semaine).
5. **Anti-répétition :** exclure les recettes des N semaines précédentes, sauf les favoris ; relâcher la contrainte si la génération échoue.
6. **Repli :** 60 tentatives par niveau de relâchement, puis sans l'objectif des recettes du monde, puis en ignorant les refus (👎) ; erreur explicite si tout échoue.
7. **Régimes, allergènes et refus :** filtre **dur**, appliqué avant tout le reste et jamais relâché.

### 7.4 Portions, quantités et contenants
- **Portion d'un repas** = somme des portions des membres présents (règles de présence et convives du créneau). Adulte = 1 ; enfant selon l'âge : moins de 3 ans 0,33 ; 3 à 6 ans 0,5 ; 7 à 11 ans 0,75 ; 12 ans et plus 1. Modifiable par membre.
- **Recettes** exprimées pour 4 portions : la quantité est multipliée par `portions / 4`.
- **Arrondi aux contenants** (`snapNum`) : pour un ingrédient présent dans `packs.json`, la quantité de la recette est ramenée à la combinaison de contenants (4 au maximum) la plus proche si l'écart est inférieur ou égal à `tol` (20 % par défaut). Exemple : 530 g de passata → 500 g.
- **Liste de courses** (`packBuy`) : la plus petite combinaison de contenants couvrant au moins 97 % du besoin (« 2 bouteilles de 700 g »). Les boîtes de conserve sont toujours entières. Les ingrédients `base` ne sont achetés que s'ils sont cochés dans le placard.
- **Garde-manger :** besoin = total moins stock ; une quantité nulle (« assez ») couvre le besoin.
- **Restes après la session** (`pantryAfterWeek`) : acheté + stock − utilisé, au-dessus d'un seuil (30 g, ou 10 % du plus petit contenant), ajouté au garde-manger ; les ingrédients épuisés en sont retirés.

### 7.5 Session (`buildSession`)
- **Entrées :** plats actifs, éventuellement doublés pour la réserve, avec les portions, la soupe et l'équipement.
- **Sorties :**
  - étapes horodatées (minutes depuis le début) avec `name`, `where` (appareil), `tasks[]` et éventuel minuteur `{ label, minutes }` ;
  - durée totale ;
  - étape 2 « Ingrédients de la session » : quantités totales, sans les ingrédients servis uniquement le jour du repas (`jj`) ;
  - dernière étape « Frigo et congélateur » : portionnage par boîte (« 1 boîte de 2,5 portions pour mardi midi »), plats doublés et restes à ranger au garde-manger.
- **Ordonnancement :** blocs `four` regroupés par température ; plaques limitées au nombre configuré ; les blocs `wait:false` chevauchent le précédent. Le niveau débutant ajoute 20 % de marge.

### 7.6 Exigences de test du moteur (Vitest)
- 100 % des recettes du seed : aucun placeholder orphelin, aucun ingrédient inconnu, aucun `undefined` ni `NaN` dans les textes formatés.
- Génération sur toutes les combinaisons des réglages (12 mois × pâtes 1-2 × soirs légers 0-4 × réserve 0-4 × 4 jeux de créneaux décochés) : aucun échec avec le repli ; zéro jour avec 2 repas de pâtes ; plafonds respectés.
- `Changer` et `Déplacer` n'introduisent jamais de nouveau conflit de pâtes ; un conflit déjà présent ne bloque pas les autres changements.
- `snapNum(passata, 530) = 500` ; `packBuy(passata, 1240) = 2 × 700 g` ; `fmtQ(mozzarella, 85) = 125 g`.
- Session : durée cohérente (± 5 min) avec le prototype sur 5 semaines de référence (graine aléatoire fixée).

## 8. Fonctionnalités par écran

### 8.1 Menu (`/app`)
- **En-tête :** date, « Bonjour » ou « Bonsoir » + prénom, « Ce soir : *plat* », bouton d'impression.
- **Bandeau des 7 jours :** aujourd'hui en jaune, week-end entouré de jaune, jours passés atténués. Toucher un jour affiche son programme.
- **Programme du jour** en frise : midi et soir (libellé « Midi · à réchauffer », « Soir · 15 à 25 min »), drapeau d'origine, nom, consigne `jj` mise à l'échelle, pastille 👥 des convives, badges (Favori, Soir simple, Congélateur), bouton **•••** (Déplacer, Qui est à table ?, Retirer ou Remettre) ; la cantine de l'enfant concerné, avec l'alerte doublon.
- **Tuiles :** « Ce soir » (sombre, consigne) ; « Avant de dormir » (jaune, plats à sortir du congélateur pour le lendemain) ; « Session dimanche » (durée) ; « Repas prévus ».
- **Grille « Repas à prévoir »** 7 × 2 : en semaine, case cochée (violette) ou décochée ; le week-end, + ouvre le sélecteur de recette. La structure est mémorisée par défaut pour les semaines suivantes.
- **Bandeau du week-end** (violet) : « Suggérer des idées ».
- **Plats de la semaine** en cartes qui défilent : 👍 / 👎, Doubler (pour la réserve), Changer.
- **Goûter de la semaine :** ligne dédiée ; Changer ouvre le sélecteur (recherche, filtres par type, de saison seulement, au hasard).
- **Recettes de la semaine** dépliables, réglages rapides.
- **Préparer la semaine suivante :** disponible dès le jeudi ; la semaine en cours reste active (programme du jour, notifications) jusqu'au dimanche (§9, `status`).

### 8.2 Découvrir (`/app/discover`)
Recherche texte ; segments Recettes et Petits-déjeuners ; filtres région, type, saison, favoris, régime. Carte recette : origine, saison, kcal et protéines, « se congèle », ingrédients pour 4 portions, étapes, bouton **Mettre au menu** (choix du créneau).

### 8.3 Courses (`/app/shopping`)
- **En-tête :** progression `cochés / total` avec une barre.
- **Ajout libre :** texte et quantité, classement automatique par rayon (dictionnaire de mots-clés du prototype, rayons Bébé et Maison et hygiène compris), raccourcis des articles fréquents.
- **Liste par rayon** (ordre du foyer) ; chaque ligne affiche le libellé, la quantité en contenants et sa source (« ajouté par Camille »).
- **Placard à vérifier :** pastilles ; une pastille cochée ajoute l'article à la liste.
- **Temps réel :** chaque coche, ajout ou suppression est visible en moins de 2 s sur les autres appareils ; les modifications se font article par article (aucun écrasement global).
- **Hors ligne :** la liste reste consultable et cochable ; les actions sont rejouées au retour du réseau.
- **Export :** Web Share API (Notes, Messages), copie dans le presse-papiers.

### 8.4 Stock (`/app/stock`)
- **Réserve du congélateur :** plats avec nombre de repas, boutons − et +, date de congélation, alerte au-delà de 3 mois.
- **Garde-manger :** ingrédient, quantité modifiable (− et +, pas adapté à l'unité), « le menu en utilise X », « il en manque Y ».
- **Bouton « Mettre à jour le garde-manger »** après la session ; s'il n'est pas utilisé, la mise à jour se fait automatiquement à la génération de la semaine suivante.

### 8.5 Session (`/app/session`)
- **Carte de démarrage :** durée, heure de fin prévue.
- **Pendant la session :**
  - une étape à la fois : grande heure prévue, titre, appareil, tâches à cocher, bouton « Lancer le minuteur de X min » ;
  - barre de minuteurs persistante sur tous les onglets (pilule jaune quand c'est prêt, +5 min, OK), sonnerie et vibration ;
  - avance ou retard en temps réel, écran maintenu allumé (Wake Lock API) ;
  - navigation Précédent / Étape suivante (le bouton passe au vert quand toutes les tâches sont cochées) ;
  - sur tablette (au moins 900 px) : panneau « À venir » avec les 3 étapes suivantes.
- **État partagé :** l'étape courante, les tâches et les minuteurs sont synchronisés entre les appareils du foyer.

### 8.6 Impression (`/app/print`)
Une page A4 portrait en noir et blanc, réduite automatiquement pour tenir sur une page :
- grille de dimanche à dimanche (midi, soir, à sortir du congélateur, total du jour), avec les convives par repas ;
- cantine ; recette complète du goûter ; un petit-déjeuner sucré et un salé ; zone de notes.

### 8.7 Feuilles modales
- **Qui est à table ?** Tuiles Adultes (bleue) et Enfants (rose) avec − et + ; raccourcis (« Toute la famille », membres habituels, « Juste les adultes ») ; « Valider · X parts ».
- **Recette du week-end :** recherche, filtres (Idées, moins de 30 min, Favoris), choix unique, « Mettre *X* samedi soir ».
- **Déplacer :** liste des créneaux de la même période (semaine ou week-end) avec le plat actuel ; les créneaux du midi sont désactivés pour les soupes et soirs simples ; avertissements (pâtes, conservation).

### 8.8 Import de recette par lien (`/app/discover/import`)

**Objectif :** ajouter une recette trouvée sur le web (Marmiton, 750g, Cuisine AZ, Journal des Femmes, Ricardo, blogs…) au catalogue privé du foyer, pour qu'elle soit proposée par le générateur comme les autres.

**Points d'entrée**
- Bouton **« Importer une recette »** dans Découvrir (champ URL, ou bouton Coller).
- **Partage depuis le navigateur du téléphone :** l'app installée se déclare comme cible de partage (`share_target` dans le manifest), ce qui ouvre l'import avec l'URL pré-remplie.
- **Saisie manuelle** en repli : même formulaire, champs vides.

**Pipeline (Edge Function `import-recipe`)**
1. **Validation de l'URL :** `http`/`https` uniquement ; refus des IP privées, de `localhost` et des schémas `file:` (protection contre la SSRF). Délai maximal de 10 s et taille maximale de 3 Mo. User-Agent identifié. Une seule requête, à la demande de l'utilisateur, sans exploration du site.
2. **Extraction structurée en priorité :** lecture du JSON-LD schema.org `Recipe` (présent sur Marmiton, 750g et la plupart des sites de recettes), y compris dans un `@graph` : `name`, `recipeYield`, `recipeIngredient`, `recipeInstructions` (texte ou `HowToStep`/`HowToSection`), `prepTime`, `cookTime`, `totalTime` (durées ISO 8601), `recipeCuisine`, `recipeCategory`, `nutrition`, `keywords`. Microdata en second recours.
3. **Repli par modèle de langage** si aucune donnée structurée : texte principal de la page (Readability) envoyé à un modèle avec un schéma de sortie JSON strict (validé par Zod).
4. **Normalisation des ingrédients** (ligne par ligne) :
   - analyse de la quantité, de l'unité et du libellé (« 2 c. à soupe d'huile d'olive », « 1 boîte de tomates pelées (400 g) », « 3 gousses d'ail », « sel, poivre ») ; conversion vers les unités du catalogue (`g`, `ml`, `pc`, `cs`, `cc`, `boite`) : 1 cs = 15 ml, 1 cc = 5 ml, 1 verre = 200 ml, 1 l = 1 000 ml, 1 kg = 1 000 g ;
   - **rapprochement avec le catalogue** : correspondance exacte, puis synonymes, puis similarité (seuil 0,85), puis proposition par le modèle de langage parmi les 5 meilleurs candidats ;
   - si aucun rapprochement : création d'un **ingrédient du foyer** (libellé, unité, rayon deviné par le dictionnaire de mots-clés) ;
   - « sel, poivre, au goût » : ingrédient `base` sans quantité.
5. **Mise à l'échelle sur 4 portions** à partir de `recipeYield` (« 6 personnes », « 4 parts ») ; si la valeur est absente, demander à l'utilisateur.
6. **Classement proposé** (règles, puis modèle de langage, toujours modifiable) :
   - **type** : plat de batch, soupe, soir simple ou goûter. Par défaut, « soir simple » si le temps total est de 30 min ou moins, sinon « plat de batch » ;
   - **protéine** déduite des ingrédients (rayon `viande` : volaille, bœuf, porc, poisson ; sinon végétarien) ;
   - **origine** (`recipeCuisine` ou déduction), pâtes, réconfort, four (présence de « four » ou « °C » dans les étapes) ;
   - **conservation** : frigo 3 jours par défaut (2 jours pour le poisson), congélation proposée selon le type (non par défaut pour les plats à base de crème, d'œufs ou de pommes de terre entières) ;
   - **saison** : mois déduits des légumes saisonniers ; toute l'année s'il n'y en a pas ;
   - **macros** : `nutrition` du site ramené à une portion, sinon estimation à partir des ingrédients (table nutritionnelle du catalogue, marquée « estimation »).
7. **Étapes au format de l'app :**
   - soir simple ou goûter : `steps[]` courts, avec placeholders `{clé}` ;
   - plat de batch ou soupe : découpage en `prep[]` et `blocks[]` (`mode`, `active`, `passive`, `a[]`) pour que la session sache l'ordonnancer, plus `box` et `jj` (consigne du jour du repas) ;
   - **les étapes sont reformulées** en phrases courtes à l'impératif et au tutoiement, dans le style de l'app. Le texte original du site n'est pas stocké.

**Écran de validation (obligatoire avant usage)**
- Aperçu : nom, source (site, lien), portions d'origine puis 4 portions, temps.
- **Ingrédients** : une ligne par ingrédient avec le texte d'origine, l'ingrédient du catalogue rapproché (menu déroulant avec recherche), la quantité et l'unité ; les lignes incertaines sont surlignées.
- **Classement et conservation** modifiables ; **étapes** modifiables (ajout, suppression, réordonnancement).
- Boutons : **« Ajouter à mes recettes »**, « Ajouter et mettre au menu », Annuler.
- Indicateur de qualité : « 12 ingrédients reconnus sur 13 ».

**Droits et données**
- Stocker : le nom, la liste d'ingrédients (des faits), les étapes **reformulées**, l'URL et le nom du site. **Ne jamais stocker** les photos, le texte original des instructions ni les commentaires du site.
- Afficher sur chaque recette importée : « Source : Marmiton », avec le lien vers la page d'origine.
- Les recettes importées sont **privées au foyer** (non partagées avec d'autres foyers en V1).
- Le site ne propose pas de recette exploitable (contenu payant, page bloquée, pas de recette) : message clair, et proposition de la saisie manuelle pré-remplie avec ce qui a été trouvé.

**Intégration au moteur**
- Les recettes validées du foyer rejoignent le pool du générateur (filtres de régime et d'allergènes compris), avec un léger bonus de tirage (+0,3, comme un favori atténué).
- Elles apparaissent dans Découvrir avec le badge « Mes recettes » et un filtre dédié ; elles sont modifiables et supprimables (avec confirmation si elles figurent dans la semaine en cours).
- Un plat de batch importé sans `blocks` exploitables reste proposé uniquement comme soir simple, jusqu'à complétion.

**Critères d'acceptation**
```gherkin
Scénario: Import d'une recette Marmiton avec données structurées
  Étant donné un membre du foyer sur l'écran d'import
  Lorsqu'il colle l'URL d'une recette Marmiton contenant du JSON-LD Recipe
  Alors l'écran de validation affiche le nom, les portions ramenées à 4 et au moins 90 % des ingrédients rapprochés du catalogue
  Et aucune photo ni texte original des étapes n'est enregistré
  Et après « Ajouter à mes recettes », la recette apparaît dans Découvrir avec « Source : Marmiton »

Scénario: Page sans données structurées
  Étant donné l'URL d'un blog sans JSON-LD Recipe
  Lorsque l'utilisateur lance l'import
  Alors l'extraction par modèle de langage produit une recette à valider
  Et les ingrédients non reconnus sont surlignés et modifiables

Scénario: Recette importée proposée par le générateur
  Étant donné une recette importée et validée de type « plat de batch », compatible avec le régime du foyer
  Lorsque le menu est généré 20 fois
  Alors elle est proposée au moins une fois
  Et elle respecte les mêmes règles (protéines, pâtes, conservation) que les recettes du catalogue

Scénario: URL interdite
  Étant donné l'URL http://192.168.1.10/recette
  Lorsque l'utilisateur lance l'import
  Alors l'import est refusé avec le message « Ce lien n'est pas accessible »
```

**Tests de l'import (Vitest)**
- Analyseur d'ingrédients : au moins 40 lignes réelles (fournir des fixtures HTML anonymisées de Marmiton, 750g, Cuisine AZ, Journal des Femmes et d'un blog WordPress avec WP Recipe Maker) ;
- conversions d'unités ; durées ISO 8601 ; `recipeYield` (« 4 », « 4 personnes », « 6-8 parts ») ;
- refus SSRF ; délai dépassé ; page sans recette.

## 9. Modèle de données (Postgres, migrations `db/migrations`)

```sql
-- Identité et foyers
create table households (id uuid primary key default gen_random_uuid(), name text not null, created_by uuid references auth.users, created_at timestamptz default now());
create type household_role as enum ('admin','member','viewer');
create table memberships (household_id uuid references households on delete cascade, user_id uuid references auth.users on delete cascade, role household_role not null default 'member', created_at timestamptz default now(), primary key (household_id, user_id));
create table invitations (id uuid primary key default gen_random_uuid(), household_id uuid references households on delete cascade, email text, role household_role not null default 'member', token text unique not null, expires_at timestamptz not null, accepted_at timestamptz, created_by uuid references auth.users);
create table profiles (user_id uuid primary key references auth.users on delete cascade, display_name text, active_household uuid references households);

-- Membres et présence
create table members (id uuid primary key default gen_random_uuid(), household_id uuid references households on delete cascade, user_id uuid references auth.users, name text not null, kind text check (kind in ('adult','child')), birthdate date, portion_override numeric, diet text, archived boolean default false);
create table presence_rules (member_id uuid references members on delete cascade, weekday smallint check (weekday between 1 and 7), meal text check (meal in ('lunch','dinner')), present boolean not null, week_parity text check (week_parity in ('all','A','B')) default 'all', primary key (member_id, weekday, meal, week_parity));

-- Réglages (JSON validé par Zod côté serveur ; schéma versionné)
create table household_settings (household_id uuid primary key references households on delete cascade, version int not null default 1, diet jsonb not null, menu jsonb not null, session jsonb not null, shopping jsonb not null, equipment jsonb not null, updated_at timestamptz default now());
create table user_settings (user_id uuid primary key references auth.users on delete cascade, notifications jsonb not null default '{}');

-- Catalogue (global, en lecture pour tous les comptes connectés)
create table ingredients (key text primary key, label text not null, unit text not null, aisle text not null, forms jsonb, half boolean default false, allergens text[] default '{}', seasonal boolean default true);
create table packs (ingredient_key text primary key references ingredients, sizes int[] not null, label text not null, tolerance numeric default 0.2);
create table recipes (id text primary key, kind text check (kind in ('main','soup','simple','cake','breakfast')), data jsonb not null, origin text, protein text, months smallint[], diet_tags text[], allergens text[], is_active boolean default true,
  household_id uuid references households on delete cascade,      -- null = catalogue global ; sinon recette privée du foyer
  source_url text, source_name text, imported_by uuid references auth.users,
  status text check (status in ('draft','validated')) default 'validated', created_at timestamptz default now());
create table household_ingredients (key text primary key, household_id uuid references households on delete cascade, label text not null, unit text not null, aisle text not null, synonyms text[] default '{}');
create table ingredient_synonyms (synonym text primary key, ingredient_key text references ingredients);   -- « tomates pelées » → tomates
create table recipe_imports (id uuid primary key default gen_random_uuid(), household_id uuid references households on delete cascade, url text not null, status text check (status in ('pending','parsed','failed','validated')), method text check (method in ('jsonld','microdata','llm','manual')), raw_ingredients text[], error text, recipe_id text references recipes, created_by uuid references auth.users, created_at timestamptz default now());

-- Semaine et préférences
create table weeks (id uuid primary key default gen_random_uuid(), household_id uuid references households on delete cascade, start_date date not null, status text check (status in ('draft','active','done')) not null, plan jsonb not null, pasta_need smallint, pantry_done boolean default false, created_at timestamptz default now(), unique (household_id, start_date));
create table ratings (household_id uuid references households on delete cascade, recipe_id text references recipes, value smallint check (value in (-1,1)), primary key (household_id, recipe_id));

-- Courses (une ligne par article pour le temps réel)
create table shopping_items (id uuid primary key default gen_random_uuid(), household_id uuid references households on delete cascade, week_id uuid references weeks on delete cascade, source text check (source in ('menu','pantry_check','manual')), ingredient_key text references ingredients, label text, qty_text text, aisle text not null, checked boolean default false, checked_by uuid references auth.users, added_by uuid references auth.users, updated_at timestamptz default now());

-- Stock
create table pantry (household_id uuid references households on delete cascade, ingredient_key text references ingredients, qty numeric, updated_at timestamptz default now(), primary key (household_id, ingredient_key));  -- qty null = « assez »
create table freezer (id uuid primary key default gen_random_uuid(), household_id uuid references households on delete cascade, recipe_id text references recipes, portions int not null check (portions >= 0), frozen_at date not null);

-- Session partagée
create table sessions (week_id uuid primary key references weeks on delete cascade, started_at timestamptz, current_step int default 0, tasks_done jsonb default '{}', timers jsonb default '[]', updated_at timestamptz default now());

-- Cantine
create table canteen_menus (id uuid primary key default gen_random_uuid(), member_id uuid references members on delete cascade, date date not null, text text not null, source text check (source in ('manual','pdf','url')), validated boolean default false, unique (member_id, date));

-- Notifications
create table push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade, endpoint text unique not null, keys jsonb not null, user_agent text, created_at timestamptz default now());
create table notification_log (id bigserial primary key, user_id uuid, kind text, sent_at timestamptz default now(), payload jsonb);
```

**Le JSON `weeks.plan`** reprend la structure du prototype :
```json
{ "groups": [{ "id": "recipe_id", "meals": [{ "day": 1, "meal": "dinner" }] }],
  "soup": { "id": "…", "days": [2, 4] }, "simples": [{ "day": 3, "id": "…" }],
  "bank": [{ "day": 5, "meal": "lunch", "id": "…" }], "weekend": { "6-dinner": "…" },
  "removed": ["3-lunch"], "guests": { "6-dinner": { "a": 4, "c": 2 } },
  "doubles": ["recipe_id"], "cake": "cake_id", "skip": ["2-lunch"] }
```

**RLS :**
- fonction `is_household_member(hid uuid)` et `household_role_of(hid uuid)` (`security definer`) ;
- `select` pour tout membre du foyer ;
- `insert`, `update` et `delete` selon le rôle (§3) ;
- catalogue global (`household_id is null`) en lecture seule pour le rôle `authenticated` ; recettes, ingrédients et imports privés (`household_id` non nul) lisibles et modifiables par les membres du foyer (rôles admin et member), en lecture pour le rôle viewer.

**Temps réel :** publication Realtime sur `shopping_items`, `weeks`, `sessions`, `pantry` et `freezer`, filtrée par `household_id`.

## 10. Routes et navigation

| Route | Contenu |
|---|---|
| `/` | Page d'accueil publique (pitch, connexion) |
| `/login`, `/auth/callback` | Lien magique et OAuth |
| `/join/[token]` | Acceptation d'une invitation |
| `/onboarding` | Assistant en 5 étapes |
| `/app` | Menu (programme du jour, semaine) |
| `/app/discover`, `/app/shopping`, `/app/stock`, `/app/session` | Onglets |
| `/app/discover/import` | Import d'une recette par lien (`?url=` pré-rempli via la cible de partage) |
| `/app/print` | Vue imprimable (`?week=`) |
| `/settings/[section]` | Tableau de bord de paramétrage |

**Navigation :** sur mobile, une barre flottante sombre en bas (5 icônes, l'onglet actif en pilule jaune avec son libellé, pastille rose s'il reste des courses). À partir de 900 px, des pilules en haut avec le logo et le nombre d'articles restants. Les liens directs vers un onglet DOIVENT fonctionner (notifications).

## 11. Design system (refonte v2, voir `reference/design/`)

- **Polices :** Gabarito (titres, 700 à 900) et Figtree (texte, 400 à 800), auto-hébergées avec `next/font`.
- **Rayons :** cartes 28 px, feuilles 32 px, pilules 999 px. Pas d'ombre sur les cartes (fond `--bg`), ombre légère sur les éléments flottants.
- **Tokens en mode clair :**
  - `--bg #F4F3F8`, `--surface #FFF`, `--ink #17151F`, `--muted #6B6878`, `--line #ECEAF2` ;
  - `--violet #7A5AF8`, `--banana #FFD23F` (actions principales, texte encre), `--green #1FA85A` (validation) ;
  - `--blue-soft #DCEBFF` / `--blue-ink #1F4E8C`, `--pink-soft #FFE6EC` / `--pink-ink #A3264A`, `--yellow-soft #FFF6D6`, `--peach #FFE3D6` / `--peach-ink #A33A12`, `--chip #F1F0F5`.
- **Tokens en mode sombre :** `--bg #121019`, `--surface #1E1B27`, `--ink #F3F1F8`, `--muted #A6A2B4`, `--line #2C2838` ; teintes douces assombries (voir la maquette Stock). Le thème suit le système, avec un réglage manuel.
- **Usage des couleurs :** violet pour la structure de la semaine, jaune pour les actions et les alertes positives, bleu pour la session, rose pour les courses, vert pour la validation, pêche pour le retard et les doublons.
- **Icônes :** Material Symbols Rounded, sous-ensemble ou SVG en ligne. Les drapeaux emoji ont un repli en badge avec le code pays (Windows).

## 12. Notifications

- **Web Push (VAPID)** vers l'application installée (iOS 16.4 et plus après ajout à l'écran d'accueil, Android, ordinateur) ; **e-mail** en solution de repli (Resend ou équivalent).
- **Planification :** crontab du VPS toutes les 15 min (`deploy/cron.sh`) → `/api/cron/notify` → pour chaque compte dont l'heure configurée tombe dans la fenêtre (fuseau horaire du foyer) → calcul du contenu par le moteur → envoi → `notification_log` (idempotence par compte, type et date).
- **Contenus :**
  - « Ce soir : *plat* », avec la consigne ;
  - « Pense à sortir *X* du congélateur pour demain » ;
  - « Courses : N articles » ;
  - « Ta session commence dans 30 min ».
- **Clic sur la notification :** ouverture du bon onglet.

## 13. Cantine

- **Sources :**
  - saisie manuelle par jour ;
  - **import PDF** : envoi vers Storage → Edge Function d'extraction (texte, puis découpage par date à l'aide d'un modèle de langage) → écran de validation obligatoire (`validated = true`) ;
  - **URL** : récupération hebdomadaire, même pipeline.
- **Alerte doublon :** bases détectées par mots-clés (pâtes, riz, poisson, volaille, bœuf, porc, œufs, pommes de terre, pizza, légumineuses ; dictionnaire `FOOD_GROUPS` du prototype), comparées à celles du dîner.

## 14. Jalons et critères d'acceptation

Chaque jalon se termine par : tests verts, `lint` et `typecheck` propres, et un récapitulatif (CLAUDE.md, règle 10).

| # | Jalon | Livrables | Critères de sortie |
|---|---|---|---|
| **M0** | Socle | Next.js, Tailwind (tokens), Supabase local, CI (lint, typecheck, tests), PWA de base | `pnpm dev` affiche la page d'accueil ; la CI passe |
| **M1** | Comptes et foyers | Lien magique, Apple, Google ; foyer ; invitations ; rôles ; RLS | Tests RLS : un compte ne lit aucune donnée d'un autre foyer ; une invitation crée l'adhésion |
| **M2** | Catalogue | Migrations du catalogue, `pnpm seed` (ingrédients, contenants, recettes), allergènes déduits des ingrédients (table de correspondance à écrire, marquée `TODO(spec)` à valider) | 184 recettes de repas, 35 goûters, 25 petits-déjeuners importés ; tests de validité du seed (§7.6) |
| **M3** | Moteur | `src/engine/` complet (§7), avec ses tests | Toutes les exigences du §7.6 passent |
| **M4** | Onboarding et paramétrage | `/onboarding`, `/settings/*` | Scénarios du §5 et du §6 ; un changement de réglage relance ou non la semaine selon le choix |
| **M5** | Menu | Écran Menu complet (§8.1), feuilles modales (§8.7), préparation anticipée | Générer, Changer, Déplacer, Retirer, Convives et Week-end : parcours Playwright |
| **M6** | Courses en temps réel | §8.3, hors ligne | Deux navigateurs : une coche apparaît chez l'autre en moins de 2 s ; ajouts simultanés conservés ; hors ligne puis reconnexion sans perte |
| **M7** | Stock | §8.4, restes après la session | Le garde-manger réduit la liste ; les restes sont ajoutés après la session |
| **M8** | Session | §8.5, état partagé, vue tablette | Session complète jouée en Playwright ; minuteurs persistants entre les onglets |
| **M8b** | Import de recettes | §8.8 : Edge Function, analyseur d'ingrédients, rapprochement, écran de validation, cible de partage, intégration au moteur | Scénarios et tests du §8.8 ; fixtures de 5 sites ; aucune photo ni texte original stocké |
| **M9** | Notifications | Abonnement push, cron, e-mail de repli, liens directs | Une notification de test est reçue ; pas de doublon sur 2 exécutions du cron |
| **M10** | Cantine | Saisie, import PDF avec validation, alerte doublon | Un PDF d'exemple donne des menus datés à valider ; l'alerte s'affiche |
| **M11** | Impression, finitions, accessibilité | §8.6, mode sombre, audit Lighthouse | Impression sur une page A4 ; Lighthouse PWA et Accessibilité ≥ 90 |

## 15. Hors périmètre de la V1

- Paiement et abonnement.
- Partage de recettes importées entre foyers, et création de recettes à partir de zéro avec photos (l'import par lien et la saisie manuelle sont dans la V1).
- Contenants par enseigne et commande au drive.
- Ajout vocal à la liste.
- Applications natives iOS et Android.
- Photos des plats.
- Budget de la semaine.
- Traductions (l'architecture doit les permettre : textes centralisés).

## 16. Questions ouvertes (à valider avec le Product Owner avant M4)

1. Table des allergènes par ingrédient : à constituer, puis à faire valider.
2. Prénom affiché dans l'en-tête : celui du compte ou celui du membre lié ?
3. Fuseau horaire : par foyer (proposé) ou par compte ?
4. Nombre maximal de membres par foyer (proposé : 10) et de foyers par compte (proposé : 5).
5. Garde alternée : calendrier A/B hebdomadaire suffisant en V1 ?
6. Import de recettes : fournisseur du modèle de langage (proposé : API Claude, modèle Haiku pour l'extraction) et quota par foyer (proposé : 30 imports par mois).
7. Import de recettes : faut-il exclure par défaut certains sites dont les conditions d'utilisation interdisent toute extraction automatique, même ponctuelle ? (liste à valider juridiquement)
