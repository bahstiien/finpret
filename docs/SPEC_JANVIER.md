# SPEC_JANVIER — Fin Prêt, lancement du lundi 4 janvier 2027

> **Document prioritaire pour Claude Code.** Il fixe le périmètre, l'ordre des jalons et les critères de sortie du lancement de janvier, y compris l'acquisition des associations (landing page SEO et fiche tuto, §8 bis).
> Pour tout comportement non redéfini ici (moteur, quantités, session, écrans), `docs/SPEC.md` fait foi. Pour tout ce qui est visuel, `design-system/` fait foi. Pour tous les textes, `brand/charte-fin-pret.md` (sections 8 et 9) fait foi.
> En cas de contradiction : **SPEC_JANVIER > SPEC > reference/menu-legacy.html**.

---

## 0. Comment travailler avec ce document

1. Exécute les jalons **J0 à J9 dans l'ordre** (section 9). Chaque jalon liste ses tâches, ses fichiers, ses tests et sa définition de « terminé ».
2. Un jalon n'est terminé que si : ses tests passent, `pnpm lint && pnpm typecheck && pnpm test` sont verts, et le récapitulatif de fin de jalon est écrit (CLAUDE.md, règle 10).
3. Ce qui est marqué **REPORTÉ** n'est pas développé, même partiellement. Les tables correspondantes sont créées (migrations), rien de plus.
4. Les décisions **D1 à D13** (SPEC §16 et section 11 ci-dessous) sont arrêtées : applique-les sans les rediscuter, signale seulement une contradiction technique.
5. Gel des fonctionnalités : **vendredi 18 décembre 2026**. Après le gel, seulement des corrections.

## 1. Objectif et indicateurs

Lancer en production le **lundi 4 janvier 2027** (rentrée scolaire, date à confirmer selon le calendrier officiel), avec 3 associations de parents (APE) partenaires et le paiement actif.

| Indicateur au 31 janvier 2027 | Objectif |
| --- | --- |
| Associations actives | 3 |
| Foyers inscrits | 150 |
| Foyers ayant terminé une session | 75 |
| Foyers revenus une 2e semaine | 50 |
| Abonnés payants ou en essai avec carte | 40 |
| Semaines de janvier avec menus de cantine publiés | 100 % |
| Incident bloquant (perte de courses, double paiement) | 0 |

Instrumente ces indicateurs dès J1 (table `events` : `user_id`, `household_id`, `name`, `props`, `created_at` ; événements : `signup`, `onboarding_done`, `week_generated`, `session_started`, `session_done`, `shopping_checked`, `trial_started`, `subscribed`, `association_joined`). Aucun outil d'analyse tiers.

## 2. Périmètre

| Domaine | INCLUS | REPORTÉ |
| --- | --- | --- |
| Comptes | Lien magique, Google, 1 foyer par compte, invitation par lien, rôles `admin` et `member`, 8 comptes max | Apple, rôle `viewer`, multi-foyers |
| Onboarding | 4 étapes : foyer (dont enfant ↔ école), alimentation, rythme, équipement | Étape habitudes, garde alternée |
| Menu | Génération, Changer, Déplacer, Retirer, Qui est à table ?, week-end, goûter, préparation anticipée (SPEC §8.1) | Historique, refaire une semaine |
| Courses | Temps réel par article, contenants, articles libres, placard, export, consultation hors ligne | Écriture hors ligne avec rejeu |
| Stock | Garde-manger avec quantités | Réserve congélateur, restes après session |
| Session | Étapes, minuteurs persistants, avance/retard, Wake Lock, vue tablette | Session partagée entre appareils |
| Cantine | Menus publiés par l'association pour l'école, alerte doublon | Import mairies et sociétés de restauration, URL |
| Associations | Compte, code, écoles, éditeurs de menus, espace, reversements, kit | Fédérations, statistiques avancées |
| Paiement | Stripe Checkout, mensuel, annuel, coupon association, essai, portail client | CSE, packs, achats intégrés |
| Notifications | Web Push + e-mail : dîner, décongélation, menus publiés, fin d'essai | Courses prêtes, début de session |
| Recettes | Catalogue du seed, Découvrir | Import par lien, recettes perso |
| Impression | A4 de la semaine | — |
| Admin | Validation associations, écoles, abonnements, reversements, support, journal | Statistiques avancées |

Jalons de la SPEC V1 reportés : **M7 (réserve et restes), M8b (import de recettes), M10 (cantine mairie)**. Le moteur M3 reste **complet**.

## 3. Parcours de référence (tests de bout en bout)

### A. Famille via code d'association
1. `GET /ecole/[code]` : page publique (nom de l'école, avantage : 30 jours d'essai puis 39,99 € la première année) et bouton « Préparer ma semaine ». Le code est stocké en cookie `fp_asso` (30 jours, HttpOnly, SameSite=Lax).
2. Connexion (lien magique ou Google) → création du foyer → `households.association_id` renseigné depuis le cookie si l'association est `approved`.
3. Onboarding : un enfant peut être relié à une école de l'association (`member_schools`, jours de cantine par défaut lundi, mardi, jeudi, vendredi).
4. Premier menu : le programme du jour affiche le menu de cantine publié et l'alerte doublon.
5. Invitation du conjoint (`/join/[token]`).
6. J-3 avant la fin de l'essai : notification et e-mail ; souscription par Stripe Checkout, coupon appliqué automatiquement.

### B. Bénévole éditeur de menus
1. `/asso/inscription` : création de l'association (statut `pending`).
2. Après validation : le responsable invite jusqu'à 3 éditeurs (`menu_editor`).
3. `/asso/menus` : import PDF ou saisie ; extraction → écran de validation → publication.
4. Publication → notification aux familles rattachées (au plus 1 par semaine et par école).

### C. Administrateur
1. `/admin/associations` : valider (vérifie RNA/SIREN et e-mail) ou refuser avec motif.
2. `/admin/reversements` : export CSV trimestriel, « Marquer comme payé » → relevé PDF envoyé.

## 4. Fonctionnalités Famille (rappel du comportement attendu)

| Fonctionnalité | Attendu | Référence |
| --- | --- | --- |
| Connexion | Lien magique (validité 1 h), Google ; session persistante | SPEC §4 |
| Foyer | Créateur admin ; invitation 7 jours, usage unique ; 8 comptes max (D4) | SPEC §4 |
| Onboarding | 4 étapes, défauts, premier menu en fin d'onboarding | SPEC §5 |
| Paramétrage | Foyer, Alimentation, Menu, Session, Notifications, Abonnement, Profil | SPEC §6 |
| Menu | Programme du jour, bandeau des jours, tuiles, grille, actions sur repas, week-end, goûter, semaine suivante | SPEC §8.1, §8.7 |
| Courses | Voir SPEC §8.3 ; hors ligne en lecture (cache du service worker) | SPEC §8.3 |
| Garde-manger | Quantités ; la liste n'achète que ce qui manque | SPEC §7.4, §8.4 |
| Session | SPEC §8.5 sans l'état partagé | SPEC §7.5, §8.5 |
| Découvrir | Catalogue, filtres, « Mettre au menu » | SPEC §8.2 |
| Impression | A4, une page | SPEC §8.6 |

### Offre gratuite et offre payante (garde-fous côté serveur)

Fonction unique `can(household, feature)` dans `src/server/entitlements.ts`, utilisée par les actions serveur **et** l'interface. Ne jamais se fier au client.

| Fonctionnalité (`feature`) | Gratuit | Essai / abonné | Foyer rattaché à une association |
| --- | --- | --- | --- |
| `menu.generate`, `shopping`, `session`, `discover` | ✓ | ✓ | ✓ |
| `menu.swap` | 3 par semaine | illimité | selon son offre |
| `menu.move`, `menu.guests`, `pantry`, `notifications.meals`, `print` | — | ✓ | selon son offre |
| `canteen`, `canteen.alert` | — | ✓ | **✓ toujours (D12)** |
| `household.members` | 2 comptes | 8 comptes | selon son offre |

## 5. Module École et Associations

### Rôles
| Rôle | Peut | Ne peut pas |
| --- | --- | --- |
| `manager` | Profil, écoles, inviter des éditeurs, voir les agrégats, kit, relevés | Voir une famille ou ses données |
| `menu_editor` | Importer, saisir, corriger, publier les menus de ses écoles | Voir les chiffres financiers |
| Famille | Rejoindre via code, relier ses enfants, voir les menus publiés | Modifier un menu |

### Règles
- **Création :** nom, RNA ou SIREN, écoles (nom, commune, UAI facultatif), e-mail du bureau, nom du responsable ; IBAN saisi après validation, chiffré (section 8).
- **Code :** généré depuis le nom (`APE-` + nom en majuscules sans accents ni espaces, tronqué à 20), modifiable une fois, regex `^[A-Z0-9-]{4,20}$`, unique ; actif seulement si `approved`.
- **Menus :** un par école et par date ; champs `starter`, `main`, `side`, `dairy`, `dessert`, `note` (au moins un rempli) ; `draft` visible des éditeurs, `published` visible des familles ; une correction après publication affiche le badge « modifié ».
- **Import PDF :** Storage `canteen-pdfs/` → Edge Function `extract-canteen-menu` → texte (pdf.js) → découpage par date par le modèle `ANTHROPIC_MODEL` avec sortie JSON validée par Zod → écran de validation obligatoire. Quota : 8 imports par association et par mois.
- **Plusieurs associations sur une même école :** le premier menu publié pour une date fait foi ; les autres éditeurs le voient en lecture.
- **Notification :** à la publication, une seule notification par école et par semaine ISO, aux familles ayant un enfant rattaché à l'école.
- **Espace `/asso` :** tableau de bord (foyers inscrits, abonnés mensuels et annuels, reversement du trimestre, total versé), menus, kit (PDF générés avec le QR code de `finpret.app/ecole/[code]`), relevés. **Tout agrégat inférieur à 5 est affiché « moins de 5 »** (D13).
- **Rattachement :** un foyer, une association, définitif tant qu'il est abonné (D11). Si le foyer résilie puis revient avec un autre code, le nouveau code s'applique.

### Reversements (D10)
| Événement Stripe | Ligne `payout_lines` |
| --- | --- |
| `invoice.paid` d'un abonnement annuel (première année ou renouvellement) | +800 centimes |
| `invoice.paid` d'un mois d'abonnement mensuel | +50 centimes |
| `charge.refunded` ou `charge.dispute.created` sur une facture déjà comptée | ligne négative du même montant |

Clôture trimestrielle (tâche planifiée les 1er janvier, avril, juillet, octobre à 03:00 Europe/Paris) : somme par association ; ≥ 2 000 centimes → `payouts.status = 'ready'` et relevé PDF ; sinon `carried_over`.

### Tests obligatoires (Vitest + Playwright)
```gherkin
Scénario: Inscription par code
  Étant donné l'association APE-JULESFERRY validée
  Lorsqu'un parent ouvre /ecole/APE-JULESFERRY, se connecte et termine l'onboarding
  Alors households.association_id vaut l'id de l'association
  Et subscriptions.trial_ends_at vaut la date d'inscription + 30 jours

Scénario: Code d'une association non validée
  Étant donné une association au statut pending
  Lorsqu'un parent ouvre /ecole/[son code]
  Alors la page affiche « Ce code n'est pas encore actif » et l'essai standard de 14 jours s'applique

Scénario: Confidentialité des associations
  Étant donné une association avec 3 foyers inscrits
  Lorsque son responsable ouvre /asso
  Alors il voit « moins de 5 foyers »
  Et aucune réponse d'API de l'espace /asso ne contient d'e-mail, de nom ou de menu de famille

Scénario: Publication des menus
  Étant donné un éditeur qui valide et publie les menus de janvier
  Alors les familles rattachées voient le menu du jour dans le programme du jour
  Et ne reçoivent qu'une notification pour la semaine
```

## 6. Paiement (Stripe)

| Offre | Sans code | Avec code d'association |
| --- | --- | --- |
| Essai | 14 jours, sans carte | 30 jours, sans carte |
| Mensuel | 5,99 € TTC | 5,99 € TTC |
| Annuel | 49,99 € TTC | 39,99 € la 1re année (coupon -10 €, `duration=once`), puis 49,99 € |

### Implémentation
- **Configuration :** produit `Fin Prêt Famille`, prix `STRIPE_PRICE_MONTHLY` et `STRIPE_PRICE_YEARLY`, coupon `STRIPE_COUPON_ASSOCIATION`. Script `pnpm stripe:setup` qui crée ou retrouve ces objets en mode test et affiche leurs identifiants.
- **Essai sans carte :** géré par l'app (`subscriptions.plan = 'trial'`, `trial_ends_at`), pas par Stripe. Le client Stripe est créé au premier passage en caisse.
- **Souscription :** action serveur `createCheckoutSession(plan)` → Stripe Checkout `mode=subscription`, `customer_email`, `client_reference_id = household_id`, `discounts` avec le coupon si `association_id` est renseigné et `plan = yearly`, `automatic_tax` désactivé (prix TTC, TVA 20 % incluse), collecte de l'adresse de facturation, URLs de retour `/app/abonnement?ok=1` et `/app/abonnement`.
- **Portail client :** action `createPortalSession()`.
- **Webhook :** `POST /api/stripe/webhook` (route Next.js, runtime Node, corps brut), vérification de signature avec `STRIPE_WEBHOOK_SECRET`. Insérer d'abord l'événement dans `stripe_events` (clé primaire = `event.id`) ; si l'insertion échoue pour doublon, répondre 200 sans rien faire. Événements traités : `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`.
- **Droits :** `subscriptions` n'est écrite que par le webhook et la création de foyer (essai). `can()` lit `subscriptions` et `households.association_id`.
- **Échec de paiement :** relances Stripe (3 sur 7 jours) ; à `customer.subscription.deleted` → `plan = 'free'`, données conservées.

```gherkin
Scénario: Coupon association
  Étant donné un foyer rattaché qui choisit l'annuel
  Lorsque la session Checkout est créée
  Alors elle contient le coupon STRIPE_COUPON_ASSOCIATION
  Et après invoice.paid, payout_lines contient +800 pour l'association

Scénario: Webhook rejoué
  Étant donné un event.id déjà présent dans stripe_events
  Lorsque Stripe le renvoie
  Alors la réponse est 200 et aucune ligne n'est créée
```

Tests : utiliser `stripe-mock` ou des événements signés générés dans les tests (bibliothèque `stripe`, `generateTestHeaderString`).

## 7. Modèle de données (migrations à ajouter à celles de la SPEC §9)

```sql
create table admins (user_id uuid primary key references auth.users on delete cascade, created_at timestamptz default now());
create table events (id bigserial primary key, user_id uuid, household_id uuid, name text not null, props jsonb default '{}', created_at timestamptz default now());

create table schools (id uuid primary key default gen_random_uuid(), name text not null, city text not null, uai text unique, created_at timestamptz default now());
create type association_status as enum ('pending','approved','rejected','suspended');
create table associations (id uuid primary key default gen_random_uuid(), name text not null, rna_or_siren text not null, email text not null, manager_name text not null, code text unique not null check (code ~ '^[A-Z0-9-]{4,20}$'), code_changed boolean default false, status association_status not null default 'pending', reject_reason text, iban_encrypted text, iban_last4 text, created_by uuid references auth.users, approved_at timestamptz, created_at timestamptz default now());
create table association_schools (association_id uuid references associations on delete cascade, school_id uuid references schools on delete cascade, primary key (association_id, school_id));
create type association_role as enum ('manager','menu_editor');
create table association_members (association_id uuid references associations on delete cascade, user_id uuid references auth.users on delete cascade, role association_role not null, primary key (association_id, user_id));
create table association_invitations (id uuid primary key default gen_random_uuid(), association_id uuid references associations on delete cascade, email text not null, token text unique not null, expires_at timestamptz not null, accepted_at timestamptz);

alter table households add column association_id uuid references associations;
alter table households add column association_joined_at timestamptz;
create table member_schools (member_id uuid primary key references members on delete cascade, school_id uuid references schools, canteen_days smallint[] not null default '{1,2,4,5}');

create table school_menus (id uuid primary key default gen_random_uuid(), school_id uuid references schools on delete cascade, date date not null, starter text, main text, side text, dairy text, dessert text, note text, status text check (status in ('draft','published')) default 'draft', edited_after_publish boolean default false, published_by uuid references auth.users, published_at timestamptz, updated_at timestamptz default now(), unique (school_id, date));
create table canteen_notifications (school_id uuid references schools on delete cascade, iso_week text not null, sent_at timestamptz default now(), primary key (school_id, iso_week));

create table subscriptions (household_id uuid primary key references households on delete cascade, stripe_customer_id text unique, stripe_subscription_id text unique, plan text check (plan in ('trial','monthly','yearly','free')) not null default 'trial', status text not null default 'trialing', trial_ends_at timestamptz, current_period_end timestamptz, updated_at timestamptz default now());
create table stripe_events (id text primary key, type text not null, received_at timestamptz default now(), payload jsonb not null);

create table payout_lines (id uuid primary key default gen_random_uuid(), association_id uuid references associations, household_id uuid references households, stripe_invoice_id text, kind text check (kind in ('yearly','monthly','refund')), amount_cents int not null, created_at timestamptz default now(), payout_id uuid);
create unique index payout_lines_invoice_kind on payout_lines (stripe_invoice_id, kind) where kind <> 'refund';
create table payouts (id uuid primary key default gen_random_uuid(), association_id uuid references associations, quarter text not null, amount_cents int not null, status text check (status in ('ready','paid','carried_over')) not null, paid_at timestamptz, statement_path text, unique (association_id, quarter));
create table admin_audit (id bigserial primary key, admin_id uuid, action text not null, target text, props jsonb, created_at timestamptz default now());
```

**RLS :**
- `associations`, `association_schools`, `association_members` : lecture par les membres de l'association et les admins ; modification du profil par `manager` ; statut par les admins uniquement.
- `school_menus` : `select` des lignes `published` pour les foyers dont un membre est rattaché à l'école (`member_schools`) ; `select/insert/update` des brouillons pour les `menu_editor` et `manager` d'une association liée à l'école.
- `subscriptions` : lecture par le foyer ; écriture uniquement par la clé de service.
- `stripe_events`, `payout_lines`, `admin_audit`, `events` : aucun accès client.
- `payouts` : lecture par le `manager` de l'association.
- **Agrégats :** fonction `association_stats(aid uuid)` en `security definer`, qui vérifie que l'appelant est membre de l'association et renvoie uniquement `{households, monthly, yearly, current_quarter_cents, paid_total_cents}` avec chaque compteur < 5 remplacé par `null` (affiché « moins de 5 »).

Tests RLS obligatoires (pgTAP ou Vitest avec deux clients authentifiés) pour chacune de ces règles.

## 8. Notifications, e-mails, sécurité, conformité

### Notifications (Web Push, repli e-mail)
| Type | Heure | Condition | Offre |
| --- | --- | --- | --- |
| `meal_tonight` | 17 h 30 (réglable) | Un dîner prévu | Payant |
| `thaw` | 20 h 30 (réglable) | Un plat à sortir pour le lendemain | Payant |
| `canteen_published` | À la publication | 1 par école et par semaine ISO | Gratuit pour les foyers d'une association |
| `trial_ending` | J-3, 10 h | Essai en cours | Tous |

Cron Supabase toutes les 15 min → Edge Function `notify` → idempotence par (`user_id`, `type`, `date`) dans `notification_log`. Fuseau : `households.timezone` (D3). Textes : charte, section 9.

### E-mails (Resend)
Lien de connexion, invitation au foyer, bienvenue, fin d'essai (J-3, J0), paiement échoué, association (demande reçue, validée, refusée, relevé trimestriel). Gabarits en React Email dans `src/emails/`, en français, conformes à la charte. Lien de désinscription en un clic sur tout e-mail non transactionnel.

### Sécurité
- Clés Stripe, Anthropic, Resend et clé de service Supabase uniquement côté serveur.
- IBAN : chiffrement AES-256-GCM côté serveur avec `IBAN_ENCRYPTION_KEY` ; stocker `iban_encrypted` et `iban_last4` ; jamais renvoyé en clair au client ; déchiffré seulement pour l'export CSV admin.
- `/admin` : membre de `admins` **et** TOTP (Supabase MFA) ; toute action écrite dans `admin_audit`.
- Limitation de débit : connexion (5 par heure et par e-mail), `/ecole/[code]` (30 par minute et par IP), import PDF (quota), création d'association (3 par jour et par compte).
- Surveillance : Sentry (`SENTRY_DSN`), alerte e-mail sur tout webhook Stripe en erreur.
- Sauvegarde quotidienne, test de restauration documenté avant le 18 décembre.

### Données personnelles
- Enfants : prénom ou surnom, année de naissance, école et jours de cantine ; rien d'autre.
- Export JSON et suppression du compte dans Profil (suppression effective sous 30 jours, données Stripe conservées selon les obligations comptables).
- Pages légales `/mentions-legales`, `/cgu`, `/cgv`, `/confidentialite`, `/partenariat-associations` : gabarits fournis avec le texte `TODO(juriste)` ; ne pas inventer de contenu juridique.

### Accessibilité et performance
- RGAA / WCAG 2.1 AA sur les parcours A et B ; Lighthouse Accessibilité ≥ 90 et PWA ≥ 90.
- Programme du jour et courses affichés en moins de 2 s en 4G simulée ; courses en lecture hors ligne.

## 8 bis. Landing page associations (SEO) et fiche tuto par association

Deux livrables servent l'acquisition des associations : **une page publique optimisée pour le référencement, qui convainc un bureau d'APE et l'inscrit**, et **une fiche tuto personnalisée par association**, qui explique l'app aux familles et le partenariat aux bénévoles.

### A. Landing page `/associations`

**Objectif :** qu'un membre de bureau d'APE qui cherche une action de financement ou un outil pour les menus de cantine trouve la page, comprenne l'offre en 30 secondes, estime ce que son association peut gagner et crée son compte.

**Mots-clés visés** (un sujet principal par page, pas de bourrage) :

| Intention | Requêtes visées |
| --- | --- |
| Financement | financement association parents d'élèves, idée action APE, idée pour récolter des fonds école, alternative vente de chocolats APE |
| Cantine | menu cantine application parents, menus de la cantine sur téléphone |
| Organisation | idée projet APE, comment financer sortie scolaire association |

**Technique SEO (obligatoire)**
- Page **générée statiquement** (Next.js, `export const dynamic = 'force-static'`), rendu HTML complet sans JavaScript ; aucun contenu important chargé côté client.
- `generateMetadata` : `<title>` de 60 caractères au plus (« Financer votre APE sans vendre de chocolats | Fin Prêt »), meta description de 155 caractères au plus, `canonical` = `https://finpret.app/associations`, Open Graph et Twitter Card avec une image 1200 × 630 générée (`opengraph-image.tsx`) aux couleurs du design system, `lang="fr"`.
- **Un seul `<h1>`**, puis `<h2>` par section ; textes réels en HTML, pas dans des images.
- **Données structurées JSON-LD :** `Organization` (Fin Prêt, logo, URL), `WebPage`, `FAQPage` (questions de la section FAQ ci-dessous), `BreadcrumbList`. Valider avec le test des résultats enrichis de Google avant J8.
- `app/sitemap.ts` (pages publiques : `/`, `/associations`, `/associations/comment-ca-marche`, pages légales) et `app/robots.ts` (`/app`, `/asso`, `/admin`, `/api`, `/join` en `Disallow`). Les pages `/ecole/[code]` sont en **`noindex`** (contenu quasi identique d'une école à l'autre, et elles n'ont pas vocation à être trouvées hors du lien de l'association).
- **Performance :** LCP < 2,5 s, CLS < 0,1, INP < 200 ms en mobile ; images en `next/image` (AVIF ou WebP, dimensions fixées), polices auto-hébergées avec `font-display: swap` ; Lighthouse **SEO ≥ 95**, Performance ≥ 90, Accessibilité ≥ 95.
- **Liens internes :** depuis la page d'accueil (`/`), le pied de page de toutes les pages publiques et les e-mails aux associations.
- Mesure : événements `asso_landing_view`, `asso_simulator_used`, `asso_lead_submitted`, `asso_signup_started` dans la table `events` (sans cookie tiers ; bannière de consentement inutile tant qu'aucun traceur tiers n'est utilisé).

**Structure et textes de la page** (textes de référence, conformes à la charte ; Claude Code les reprend tels quels dans `src/i18n/fr.ts`)

1. **Héros**
   - H1 : « Financez les projets de votre APE, sans vendre de chocolats »
   - Sous-titre : « Fin Prêt aide les familles de votre école à organiser leurs repas de la semaine. Votre association reçoit 8 € pour chaque famille abonnée, chaque année. »
   - Bouton principal (jaune) : « Créer le compte de notre association » → `/asso/inscription` ; lien secondaire : « Voir comment ça marche » → ancre vers la section 3.
   - Visuel : capture du programme du jour avec la cantine et l'alerte doublon, dans un cadre de téléphone.
2. **Le problème** (H2 « Les ventes de chocolats, ça va un moment ») : trois cartes : « Des heures de bénévolat pour gérer les commandes », « Du stock, des livraisons, des impayés », « Toujours les mêmes familles qui s'investissent ».
3. **Comment ça marche** (H2 « Une action qui tourne toute seule ») : quatre étapes numérotées : 1. « Votre bureau crée le compte de l'association (5 minutes) », 2. « Vous partagez votre code aux familles avec le kit fourni », 3. « Un bénévole publie les menus de la cantine chaque mois (10 minutes) », 4. « Vous recevez votre reversement chaque trimestre ».
4. **Ce que les familles y gagnent** (H2 « Un vrai service pour les parents ») : les menus de la cantine sur leur téléphone, une alerte quand le dîner ressemble au déjeuner, une semaine de repas préparée en une session le dimanche, une liste de courses partagée ; avantage réservé : 30 jours d'essai et 39,99 € la première année au lieu de 49,99 €.
5. **Simulateur** (H2 « Combien votre association peut-elle recevoir ? ») : deux curseurs, « Nombre de familles dans l'école » (50 à 800, défaut 200) et « Part des familles qui s'abonnent » (5 à 30 %, défaut 15 %) ; résultat : « Environ *X* € par an pour votre association », calcul = familles × part × 8 €, arrondi à la dizaine ; mention « Estimation indicative : le reversement dépend des abonnements réellement souscrits ». Composant client isolé (le reste de la page reste statique).
6. **Ce que vous ne faites pas** (H2 « Zéro logistique ») : pas de stock, pas de commandes à collecter, pas d'argent à manipuler, aucune donnée de famille à gérer.
7. **Confiance** (H2 « Pensé pour les associations ») : vos familles restent anonymes (vous ne voyez que des chiffres globaux) ; communication uniquement par vos canaux, jamais par l'école ; pas de publicité dans l'app ; données hébergées en Europe ; contrat de partenariat clair, sans engagement de durée.
8. **Témoignage** de l'association pilote (à ajouter après la bêta ; emplacement prévu, masqué tant qu'il est vide).
9. **FAQ** (H2 « Vos questions ») — reprise en `FAQPage` :
   - « Est-ce que l'école doit donner son accord ? » → « Non, c'est votre association qui recommande Fin Prêt, par ses propres canaux (lettre d'information, groupes de parents, événements). Pour une diffusion dans les cartables ou un affichage dans l'école, il faut l'accord du directeur. »
   - « Combien de temps ça demande aux bénévoles ? » → « Environ 5 minutes pour créer le compte, puis 10 minutes par mois pour publier les menus de la cantine. »
   - « Comment est calculé le reversement ? » → « 8 € par abonnement annuel et 0,50 € par mois d'abonnement mensuel, pour chaque famille inscrite avec votre code, versés chaque trimestre dès 20 €. »
   - « Voit-on qui s'est abonné ? » → « Non. Vous voyez le nombre de familles et le montant du reversement, jamais les noms. En dessous de 5 familles, les chiffres sont regroupés. »
   - « Faut-il un statut particulier ? » → « Votre association doit être déclarée (numéro RNA ou SIREN). Vérifiez avec votre trésorier le traitement fiscal de ces recettes. »
   - « Et si nous voulons arrêter ? » → « Le partenariat est sans engagement de durée : vous pouvez l'arrêter à tout moment, les reversements dus restent versés. »
10. **Appel final** : « Prêts à lancer votre action ? » + bouton « Créer le compte de notre association » + lien « Pas encore prêts ? Recevez la présentation par e-mail ».

**Formulaire « Recevez la présentation »** (pour les bureaux qui veulent en parler en réunion) : nom, e-mail, nom de l'association, école et commune, nombre approximatif de familles (facultatif), case de consentement. Enregistré dans `association_leads` ; envoie la fiche de présentation générique (PDF) par e-mail et notifie l'administrateur. Protection anti-spam : champ piège invisible et limitation à 3 envois par heure et par IP (pas de captcha tiers).

**Page satellite `/associations/comment-ca-marche`** : version longue (1 200 mots environ) des étapes, du calcul du reversement et des règles de communication, avec le schéma du parcours ; cible la longue traîne (« comment financer une sortie scolaire association »). Mêmes règles SEO, maillage avec `/associations`.

### B. Fiche tuto par association

**Objectif :** donner à chaque association un support prêt à l'emploi et personnalisé, en deux pages A4, téléchargeable dans `/asso/kit` et consultable en ligne.

- **Génération :** PDF généré côté serveur (`@react-pdf/renderer`) à la demande, mis en cache dans Storage (`asso-kits/[association_id]/fiche-tuto.pdf`) et régénéré quand le code, le nom ou l'école change. Version web équivalente : `/ecole/[code]/comment-ca-marche` (`noindex`).
- **Personnalisation :** nom de l'association, nom de l'école et commune, code, QR code vers `https://finpret.app/ecole/[code]`, avantage famille (30 jours, 39,99 €), date de génération.
- **Design :** design system Fin Prêt (couleurs, Gabarito et Figtree, logo), lisible en noir et blanc.

**Page 1 — Pour les familles** (à transmettre par l'association)
- Titre : « *Nom de l'association* vous présente Fin Prêt »
- Accroche : « Le dimanche, tu cuisines. La semaine est fin prête. »
- « Comment démarrer en 3 étapes » : 1. « Scanne le QR code ou va sur finpret.app/ecole/*CODE* », 2. « Crée ton compte avec ton e-mail et indique l'école de ton enfant », 3. « Ta première semaine de repas est prête, avec les menus de la cantine ».
- « Ce que tu trouveras dans l'app » : les menus de la cantine et l'alerte quand le dîner ressemble au déjeuner ; un menu de la semaine de saison ; la liste de courses partagée ; la session du dimanche guidée pas à pas.
- Encadré avantage : « Avec le code *CODE* : 30 jours d'essai gratuit, puis 39,99 € la première année au lieu de 49,99 €. Chaque abonnement soutient les projets de *nom de l'association*. »
- QR code grand format et adresse en clair.

**Page 2 — Pour le bureau et les bénévoles**
- « Votre partenariat en bref » : code, écoles, date de début, contact Fin Prêt (bonjour@finpret.app).
- « Le rôle de l'association » : 1. partager le code (kit : e-mail type, message pour les groupes de parents, affiche, flyer) ; 2. publier les menus de la cantine chaque mois dans `/asso/menus` (import du PDF de la mairie ou saisie, 10 minutes) ; 3. suivre les inscriptions dans votre espace.
- « Vos reversements » : tableau 8 € par abonnement annuel, 0,50 € par mois d'abonnement mensuel, versement trimestriel dès 20 €, relevé envoyé par e-mail.
- « Les règles à respecter » : communiquer par les canaux de l'association ; pas de diffusion dans les cartables ni d'affichage sans l'accord du directeur ; ne jamais s'adresser aux enfants ; l'association ne reçoit et ne demande aucune donnée personnelle des familles.
- « Calendrier type » : septembre et janvier (lancement auprès des familles), chaque fin de mois (menus du mois suivant), fin de trimestre (relevé et virement).

**Tests :** génération du PDF pour une association de test (2 pages, QR code décodable vers la bonne URL, aucun texte `undefined`), version web identique, régénération après changement de code.

### Données ajoutées

```sql
create table association_leads (id uuid primary key default gen_random_uuid(), name text not null, email text not null, association_name text not null, school text, city text, families_estimate int, consent boolean not null, created_at timestamptz default now(), contacted_at timestamptz);
create table association_kits (association_id uuid primary key references associations on delete cascade, tuto_pdf_path text, generated_at timestamptz, source_hash text);   -- régénération si le hash (nom, code, école) change
```

RLS : `association_leads` sans accès client (insertion par action serveur, lecture par les admins) ; `association_kits` en lecture par les membres de l'association. Ajouter un écran `/admin/prospects` (liste des demandes, marquer comme contacté).


## 9. Jalons (ordre d'exécution)

| Jalon | Semaine | Contenu | Définition de « terminé » |
| --- | --- | --- | --- |
| **J0** | S1 | M0 de la SPEC : socle Next.js, Tailwind alimenté par `design-system/tokens.json` (script `pnpm tokens` → `src/styles/tokens.css`), polices, Supabase local, CI, PWA, Sentry | `pnpm dev` affiche la page d'accueil aux couleurs Fin Prêt ; CI verte |
| **J1** | S1 | M1 : lien magique, Google, foyer, invitation, rôles, RLS de base, table `events` | Tests RLS : aucun accès inter-foyer ; invitation acceptée |
| **J2** | S2 | M2 : catalogue et seed (`pnpm seed`), `seed/allergens.json` proposé (D1) | 184 repas, 35 goûters, 25 petits-déjeuners valides ; allergènes en attente de validation |
| **J3** | S2–S3 | M3 : moteur complet `src/engine/` porté du prototype, avec ses tests | Toutes les exigences SPEC §7.6 passent |
| **J4** | S4 | M4 : onboarding (4 étapes) et paramétrage ; `entitlements.ts` | Premier menu à la fin de l'onboarding ; `can()` couvert par des tests |
| **J5** | S4–S5 | M5 : écran Menu complet, feuilles modales, préparation anticipée ; session guidée et vue tablette | Parcours Menu et Session en Playwright |
| **J6** | S6 | M6 : courses en temps réel, garde-manger, lecture hors ligne ; module École (associations, écoles, éditeurs, menus, import PDF, alerte doublon) | Deux navigateurs synchronisés < 2 s ; scénarios « Publication des menus » verts |
| **J7** | S7 | Paiement Stripe, reversements, espace `/asso`, kit et **fiche tuto PDF par association** (§8 bis B), notifications, e-mails, back-office `/admin` (dont `/admin/prospects`) | Scénarios des sections 5 et 6 verts en mode test ; fiche tuto générée et QR code valide |
| **J8** | S8 | **Landing page `/associations` et `/associations/comment-ca-marche`** (§8 bis A), sitemap, robots, JSON-LD, formulaire de prospects ; impression, accessibilité, pages légales (gabarits), recette complète, test de restauration ; **gel le 18 décembre** | Lighthouse SEO ≥ 95 sur la landing, autres pages ≥ 90 ; JSON-LD valide ; aucun bug bloquant ; parcours A, B, C joués |
| **J9** | S9–S10 | Bêta fermée (20 foyers), corrections uniquement ; passage Stripe en mode réel le 2 janvier | 0 incident de paiement ; 15 foyers bêta ont généré un menu |

**La landing page peut être livrée en avance** (dès J4, elle ne dépend que du design system et du formulaire de prospects) : c'est conseillé, pour qu'elle soit indexée avant décembre et serve au démarchage des APE.

**Si un jalon glisse de plus d'une semaine,** retirer dans cet ordre : vue tablette de la session, impression, garde-manger, page satellite. Ne jamais retirer : module École, paiement, courses partagées, landing `/associations`, fiche tuto.

## 10. Routes à ajouter (en plus de SPEC §10)

| Route | Contenu |
| --- | --- |
| `/associations` | Landing page SEO des associations (statique, indexable) |
| `/associations/comment-ca-marche` | Page satellite longue traîne (statique, indexable) |
| `/ecole/[code]` | Page publique d'une association et de son école, pose le cookie `fp_asso` (`noindex`) |
| `/ecole/[code]/comment-ca-marche` | Version web de la fiche tuto (`noindex`) |
| `/sitemap.xml`, `/robots.txt` | Générés par `app/sitemap.ts` et `app/robots.ts` |
| `/app/abonnement` | Offre actuelle, Checkout, portail client |
| `/asso/inscription` | Création d'une association |
| `/asso` | Tableau de bord |
| `/asso/menus` | Calendrier, import, saisie, publication |
| `/asso/kit` | Téléchargement du kit |
| `/asso/releves` | Relevés trimestriels |
| `/asso/equipe` | Invitations des éditeurs |
| `/admin/*` | Associations, écoles, menus, abonnements, reversements, prospects, support, journal |
| `/api/stripe/webhook` | Webhook Stripe |
| `/mentions-legales`, `/cgu`, `/cgv`, `/confidentialite`, `/partenariat-associations` | Pages légales |

Variables d'environnement à ajouter à `.env.example` : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_COUPON_ASSOCIATION`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `IBAN_ENCRYPTION_KEY`, `SENTRY_DSN`, `APP_URL=https://finpret.app`.

## 11. Décisions arrêtées pour janvier

| # | Décision |
| --- | --- |
| D8 | Lancement le lundi 4 janvier 2027, gel le vendredi 18 décembre 2026 |
| D9 | Paiement web uniquement (Stripe), pas d'achat intégré |
| D10 | Association : essai 30 jours, 39,99 € la 1re année ; reversement 8 € par annuel, 0,50 € par mois, trimestriel dès 20 € |
| D11 | Un foyer, une association, définitif tant qu'il est abonné |
| D12 | Cantine et alerte doublon gratuites pour les foyers rattachés à une association |
| D13 | Associations : agrégats uniquement, masqués sous 5 |

## 12. Questions ouvertes (ne bloquent pas le code, à signaler dans les récapitulatifs)

1. Statut juridique de l'éditeur (impacte factures, TVA, contrat) : prévoir les mentions de facture paramétrables (`COMPANY_NAME`, `COMPANY_ID`, `COMPANY_VAT`).
2. Nom de l'école pilote et de son association : fournis à J9 pour la bêta.
3. Rétractation de 14 jours et renonciation expresse au paiement après l'essai : case à cocher prévue dans Checkout (`consent_collection.terms_of_service`), texte `TODO(juriste)`.
