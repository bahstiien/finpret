# SEO programmatique — Fin Prêt

Couche de pages publiques, indexables et rendues côté serveur, générées à partir du catalogue (`seed/*.json`). Aucune donnée d'utilisateur n'y figure : seules les recettes du catalogue global et des menus types composés par un algorithme déterministe.

## Architecture des routes

| Route | Contenu | Source |
|---|---|---|
| `/recettes` | index des recettes | `src/seo/catalog.ts` |
| `/recettes/{slug}` | recette complète (ingrédients pour 4, étapes, conservation et congélation, astuce enfants, nutrition) | `RECIPES` |
| `/menus` | index des menus indexables | `src/seo/menus.ts` |
| `/menus/{slug}` | 5 repas, planning de batch cooking, liste de courses consolidée, FAQ | `COMBINATIONS` (`src/seo/config.ts`) |
| `/batch-cooking` | index des hubs | `src/seo/hubs.ts` |
| `/batch-cooking/{theme}` | introduction, menus et recettes liés, FAQ | `HUB_DEFS` |
| `/og/{type}/{slug}` | image de partage 1200×630 générée | `src/app/og/` |
| `/sitemap.xml`, `/robots.txt` | indexation | `src/app/sitemap.ts`, `src/app/robots.ts` |

- Tout est **statique** (`generateStaticParams`, `dynamicParams = false`) : le HTML brut contient tout le contenu. Un slug inconnu renvoie une vraie 404 (`src/app/not-found.tsx`).
- Le groupe de routes `src/app/(seo)/` a son propre layout (en-tête, pied de page) et ne charge aucun composant client ni le code de l'app connectée.
- Le middleware **exclut** ces chemins (matcher) : pas d'appel Supabase par requête, donc pas de cookie ni de dynamisation. Il ajoute `X-Robots-Tag: noindex, nofollow` sur `/app`, `/onboarding`, `/settings`, `/asso`, `/admin`, `/login`, `/join`, `/api`, `/auth`.
- Le catalogue est lu depuis `seed/*.json` au build (validé par les schémas Zod du moteur), sans base de données. Les doublons de nom exact du seed ne sont publiés qu'une fois.

## Seuils anti thin content

- Menu : indexable si ≥ `MIN_RECIPES_PER_MENU` (5) recettes distinctes. Sous le seuil, la page est générée en `noindex`, absente du sitemap et non liée.
- Hub : indexable si ≥ 5 recettes et ≥ 2 menus indexables (`MIN_RECIPES_PER_HUB`, `MIN_MENUS_PER_HUB`).
- Chaque menu a une introduction composée d'un angle propre à la contrainte, d'un paragraphe propre au format et d'un paragraphe de faits tirés du menu (recettes, durée, congélation). Un test vérifie que toutes les introductions sont distinctes.

## Ajouter une combinaison de menu

1. `src/seo/config.ts` : ajouter la valeur dans `PERSONS`, `CONSTRAINTS` ou `FORMATS` (les combinaisons sont leur produit cartésien), ou filtrer `COMBINATIONS` pour n'en garder que certaines.
2. Nouvelle contrainte : ajouter son slug dans `CONSTRAINT_SLUG`, son filtre dans `matches()` et son texte d'angle dans `intro()` (`src/seo/menus.ts`).
3. `pnpm test` : les tests vérifient slugs, titres et descriptions uniques, introductions distinctes, longueurs.
4. Avancer `CONTENT_LASTMOD` dans `src/seo/config.ts`.

Ajouter un hub : une entrée dans `HUB_DEFS` (`src/seo/hubs.ts`) avec introduction, FAQ et filtres.

Proxys de contrainte (le seed n'a pas de prix) : « pas cher » = 8 ingrédients au plus, ni poisson ni bœuf ; « enfants » = difficulté ≤ 2 ; « rapide » = 25 min de travail actif au plus. La page « pas cher » ne chiffre jamais le prix.

## Photos

Le seed ne contient aucune photo. Tant qu'une recette n'a pas de photo, la page n'en affiche pas et `image` (JSON-LD, Open Graph) pointe vers l'image générée `/og/recettes/{slug}`. Google attend de vraies photos pour les résultats enrichis Recipe : à renseigner dans `src/seo/images.ts` (`public/recettes/{slug}.webp`, dimensions et `alt`). Next.js sert alors WebP/AVIF avec `priority` (LCP).

## Données structurées

- Recettes : `Recipe` (name, image, description, recipeIngredient, recipeInstructions en `HowToStep`, prepTime, cookTime, totalTime en ISO 8601, recipeYield, recipeCategory, recipeCuisine, nutrition) + `BreadcrumbList`. Les temps ne sont émis que s'ils existent dans le seed (les dîners express n'ont pas de durée). La nutrition vient des macros du seed (estimation par portion adulte).
- Menus et hubs : `ItemList` + `FAQPage` + `BreadcrumbList`. Index : `BreadcrumbList`.

**Tester** :
1. Rich Results Test : <https://search.google.com/test/rich-results> → saisir l'URL de production (ou coller le code source d'une page servie en local via « Code »).
2. Validateur schema.org : <https://validator.schema.org>.
3. En local : `curl -s http://localhost:3000/recettes/<slug> | grep -o 'application/ld+json' | wc -l` (2 scripts par recette, 3 par menu et hub).
4. Les tests Vitest (`src/seo/seo.test.ts`) vérifient la présence des champs obligatoires.

## Commandes de vérification

```bash
BASE=http://localhost:3000   # pnpm build && pnpm start

# HTML brut : tout le contenu est dans la réponse, sans JavaScript
curl -s $BASE/recettes/poulet_citron | grep -c "<h1"          # 1
curl -s $BASE/menus/semaine-4-personnes-batch-cooking | grep -o "<h2[^>]*>[^<]*" 
curl -s $BASE/batch-cooking/en-2-heures | grep -o 'rel="canonical"[^>]*'

# Codes HTTP et en-têtes
curl -sI $BASE/recettes/poulet-citron | head -5                # 200
curl -sI $BASE/recettes/inconnu | head -1                      # 404
curl -sI $BASE/app | grep -i "x-robots-tag\|location"          # noindex + redirection login
curl -sI $BASE/login | grep -i x-robots-tag                    # noindex, nofollow

# Sitemap et robots
curl -s $BASE/sitemap.xml | grep -c "<loc>"
curl -s $BASE/sitemap.xml | grep -o "<lastmod>[^<]*" | sort -u
curl -s $BASE/robots.txt

# Tous les URL du sitemap répondent 200
curl -s $BASE/sitemap.xml | grep -o "<loc>[^<]*" | sed 's/<loc>//' | sed "s#https://finpret.app#$BASE#" | xargs -n1 -P8 -I{} curl -s -o /dev/null -w "%{http_code} {}\n" {} | sort | uniq -c | sort -rn | head
```

## Checklist de mise en ligne

- [ ] `APP_URL=https://finpret.app` défini en production (canonical, sitemap, Open Graph, JSON-LD).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passent.
- [ ] Les commandes ci-dessus : 200 sur les pages, 404 sur un slug inconnu, noindex sur les routes connectées, sitemap sans URL en erreur.
- [ ] Rich Results Test sur une recette, un menu et un hub : aucune erreur.
- [ ] Photos des recettes prioritaires ajoutées (`src/seo/images.ts`).
- [ ] `CONTENT_LASTMOD` à jour.
- [ ] Search Console : ajouter la propriété, soumettre `https://finpret.app/sitemap.xml`, demander l'indexation des 20 pages prioritaires.
- [ ] Lighthouse mobile (`pnpm audit:lighthouse`) : LCP < 2,5 s, CLS < 0,1 ; INP < 200 ms (pas de JavaScript client sur ces pages).
- [ ] Suivi à 4 semaines : pages indexées, impressions par requête, pages « explorées, non indexées ».

## 20 pages à générer en priorité

Les requêtes sont des hypothèses de longue traîne, **non mesurées** : à confirmer dans un outil de volumes (Search Console, Semrush…) avant d'arbitrer.

| # | Page | Requête cible | Intention |
|---|---|---|---|
| 1 | `/menus/semaine-4-personnes-batch-cooking` | menu de la semaine 4 personnes batch cooking | Obtenir un menu complet à reproduire |
| 2 | `/menus/semaine-4-personnes-pas-cher-batch-cooking` | menu de la semaine pas cher batch cooking | Réduire le budget courses |
| 3 | `/menus/semaine-4-personnes-vegetarien-batch-cooking` | menu de la semaine végétarien batch cooking | Trouver une semaine sans viande |
| 4 | `/menus/semaine-4-personnes-enfants-batch-cooking` | menu de la semaine pour enfants | Menu accepté par les enfants |
| 5 | `/menus/semaine-4-personnes-rapide-batch-cooking` | menu de la semaine rapide batch cooking | Gagner du temps |
| 6 | `/menus/semaine-2-personnes-batch-cooking` | menu de la semaine 2 personnes batch cooking | Menu pour un couple |
| 7 | `/menus/semaine-6-personnes-batch-cooking` | menu de la semaine grande famille | Cuisiner pour 6 |
| 8 | `/menus/semaine-4-personnes` | menu de la semaine 4 personnes | Idées de dîners sans batch cooking |
| 9 | `/menus/semaine-4-personnes-pas-cher` | menu de la semaine pas cher | Réduire le budget |
| 10 | `/menus/semaine-4-personnes-vegetarien` | menu de la semaine végétarien | Semaine végétarienne |
| 11 | `/batch-cooking/en-2-heures` | batch cooking en 2 heures | Savoir si c'est faisable |
| 12 | `/batch-cooking/pour-debutant` | batch cooking pour débutant | Se lancer |
| 13 | `/batch-cooking/famille` | batch cooking famille | Organiser les repas de la famille |
| 14 | `/batch-cooking/sans-four` | batch cooking sans four | Cuisiner sans four |
| 15 | `/menus/semaine-2-personnes-pas-cher-batch-cooking` | menu pas cher pour deux | Budget d'un couple |
| 16 | `/menus/semaine-6-personnes-enfants-batch-cooking` | menu famille nombreuse enfants | Gérer une grande tablée |
| 17 | `/menus/semaine-2-personnes-vegetarien-batch-cooking` | menu végétarien 2 personnes | Semaine végétarienne en couple |
| 18 | `/menus/semaine-6-personnes-pas-cher-batch-cooking` | menu pas cher 6 personnes | Budget grande famille |
| 19 | `/menus/semaine-2-personnes-rapide-batch-cooking` | menu rapide 2 personnes | Dîners rapides pour deux |
| 20 | `/recettes` | recettes batch cooking familiales | Parcourir les recettes |

Après les photos, les recettes à fort potentiel sont celles qui se congèlent et ont une origine identifiable (curry, lasagnes, chili…) : à prioriser à partir des requêtes réelles de la Search Console.
