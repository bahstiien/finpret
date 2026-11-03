# Audit SEO technique et sémantique — Fin Prêt (3 novembre 2026)

Mesures faites sur la production `https://finpret.app` avec `curl` (aucun accès à Search Console depuis cet environnement). Rien ci-dessous n'est une position, un volume de recherche ou un trafic.

## Constaté en production

| Contrôle | Résultat |
|---|---|
| `http://` → `https://` | 308 vers `https://finpret.app/` |
| `www.` → apex | 301 vers `https://finpret.app/` |
| Accueil, `/recettes`, `/menus`, `/batch-cooking` | 200, HTML complet rendu côté serveur/statique (pas de dépendance à JavaScript) |
| URL inconnue | vraie 404 |
| `/app` | 307 vers `/login?next=%2Fapp`, `X-Robots-Tag: noindex, nofollow` |
| `robots.txt` | `Allow: /`, espaces connectés/API/invitations bloqués, `Sitemap:` déclaré, `/_next/` non bloqué |
| `sitemap.xml` | 613 URL (pages publiques + recettes, menus, hubs), aucune route privée |
| Recette (`/recettes/poulet-citron`) | canonical auto-référent, `index, follow`, JSON-LD Recipe |

## Problèmes confirmés et corrigés

1. **Accueil sans canonical ni donnée structurée** : ajout du canonical `/`, d'Open Graph complet (url, siteName, image logo) et d'un JSON-LD `Organization` + `WebSite` + `SoftwareApplication` (`src/seo/jsonld.ts`). Aucune note, avis ni prix : rien de tel n'est affiché.
2. **Aucun lien interne depuis l'accueil vers le catalogue public** (`/recettes`, `/menus`, `/batch-cooking`) : ces ~600 pages n'étaient atteignables que par le sitemap. Liens ajoutés au pied de page (toujours actifs, hors drapeau `associations`).
3. **Title/description/H1 sans le produit ni la cible** : « Le dimanche, tu cuisines… » ne disait ni « batch cooking » ni « famille ».
   - Title (57 car.) : `Fin Prêt — Application de batch cooking pour les familles`
   - Description (132 car.) : `Menus de saison, liste de courses et session de batch cooking guidée : prépare 10 repas en 2 h 30 le dimanche pour toute ta famille.`
   - H1 : `Batch cooking en famille. 10 repas en 2 h 30.` ; pastille : `Application de batch cooking`.
4. **Sitemap** : l'accueil passe de `https://finpret.app` à `https://finpret.app/`, identique au canonical.

Tests : `src/seo/home.test.ts` (longueurs, mots-clés, absence de note/prix dans le JSON-LD, liens du pied de page).

## Non modifié, à décider

- `/associations` et `/associations/comment-ca-marche` sont publiques et dans le sitemap alors que le drapeau `FEATURES.associations` est à `false` (le pied de page affiche « Bientôt »). Soit retirer du sitemap, soit activer le drapeau.
- `/ecole/<code inconnu>` répond 200 (page `noindex`, non liée) : un code invalide n'est pas une vraie 404.
- Pas d'image Open Graph dédiée à l'accueil (le logo carré sert de repli, carte `summary`). Les recettes n'ont pas de vraies photos (`src/seo/images.ts`), limite connue pour les résultats enrichis Recipe.
- Aucun `lastmod` sur les pages non catalogue du sitemap (non inventé).
- FAQPage non ajouté sur l'accueil : Google n'affiche plus ce résultat enrichi pour la plupart des sites.

## Vérifications externes (résultats **inconnus**)

À faire dans Google Search Console (propriété `finpret.app`) et Bing Webmaster Tools :

1. Valider la propriété (DNS) et soumettre `https://finpret.app/sitemap.xml` : statut, nombre d'URL découvertes.
2. Inspecter l'URL de l'accueil, d'une recette, d'un menu et d'un hub : « L'URL est sur Google ? », canonical retenu par Google, rendu.
3. Rapport « Pages » : motifs d'exclusion (« Explorée, actuellement non indexée », « Détectée, actuellement non indexée » fréquents sur du contenu programmatique neuf).
4. Rapport « Performances » : requêtes et pages (vide possible si le site est récent).
5. Rich Results Test sur une recette et sur l'accueil.
6. Recherche `site:finpret.app` à titre indicatif seulement.
7. Après déploiement, re-vérifier : `curl -s https://finpret.app/ | grep -E 'canonical|ld\+json'`.

Aucune indexation ni résultat enrichi n'est garanti.
