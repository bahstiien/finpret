# Récapitulatif SPEC_PRISE_EN_MAIN (CLAUDE.md, règle 10)

Jalons livrés : J5b-1 (checklist, bulles, états vides), J5b-2 (première session accompagnée) et J7b (séquence de messages). Reste J8b (Aide).

Branche `prise-en-main` (worktree `spec-pec`, issue de `optim-seo` au commit 4787788). Spec : `SPEC_PRISE_EN_MAIN.md`.

## J5b-1 — fait

- **Spec :** `SPEC_JANVIER.md` mise à jour (indicateur d'activation et événements §1, périmètre §2, `onboarding` dans les droits §4, sous-jalons J5b-1, J5b-2, J7b, J8b et ordre de retrait §9, route `/settings/help` §10, question ouverte §12).
- **Données :** migration `20261107000000_getting_started.sql` (`onboarding_progress`, `user_settings.tips_seen`, type `onboarding` et index uniques de `notification_log`, index `events(user_id, name, created_at)`). Types `database.types.ts` écrits à la main.
- **Droits et événements :** `can('onboarding')` gratuit partout ; 14 événements ajoutés à `EVENT_NAMES`. `menu_move` et `menu_removed` (Déplacer, Retirer, case de la grille décochée) et `invitation_sent` sont émis par les actions existantes.
- **Moteur pur :** `src/engine/getting-started.ts` (`computeChecklist`, `newlyDone`, `withSolo`, `tipFor`).
- **Serveur :** `src/server/getting-started.ts` (`syncChecklist`, `tipForTab`), actions `src/server/actions/getting-started.ts` (masquer, relancer, « Je cuisine seul·e », conseil affiché ou fermé).
- **Interface :** composés `Checklist` et `Coachmark` (ajoutés à la galerie et à DESIGN_SYSTEM.md), `ChecklistCard` et `TipBubble`, toast avec action « Annuler ». Checklist sous l'en-tête de Menu ; bulles sur les 5 onglets ; états vides n° 1, 5, 6, 7, 9, 10, 11, 17.
- **Textes :** `src/i18n/getting-started.ts` (rattaché à `fr.gettingStarted`).

## Tests ajoutés

- Vitest : `src/engine/getting-started.test.ts` (26 cas : une étape par cas, « Je cuisine seul·e », coche par un autre membre, autre foyer, monotonie, fin, réussite 3 jours, réduction à 21 jours, conseils), `tests/unit/getting-started-tone.test.ts` (ton et 2 phrases), `can('onboarding')`. **571 tests verts** ; `pnpm lint` et `pnpm typecheck` propres.
- pgTAP (PGlite) : `16_getting_started_rls.test.sql`, 11 vérifications vertes (aucun accès inter-foyer, aucune écriture client, `tips_seen` serveur, clé de message et message du jour uniques).
- Playwright : `tests/e2e/getting-started.spec.ts`, **7 parcours joués et verts** contre `next dev` (projet hébergé de développement, migration appliquée) : checklist de « 1 sur 6 » à la réussite puis disparition, « Je cuisine seul·e », masquer et annuler, clavier, bulle Courses une seule fois, Échap, et **axe sans violation sur Menu avec checklist et bulle, en clair et en sombre**. L'audit axe complet de `a11y.spec.ts` (10 écrans dont Courses, Stock, Session, Découvrir et Impression, modifiés par J5b-1) passe aussi, en clair et en sombre (délai du test allongé pour `next dev`).

## Écarts avec la spec

- **Migration renommée `20261107000000`** : la version `20261106000000` était déjà appliquée sur le projet distant par la branche `design-system-ui` (`storage_buckets`). Une copie identique de cette migration est ajoutée à la branche pour garder l'historique cohérent ; elle fusionnera sans conflit.
- **Seuil `GETTING_STARTED_SINCE`** ramené au 26 octobre 2026 (la valeur initiale était postérieure à la date réelle et excluait les foyers de test).
- **Environnement d'essai :** le build de production échoue sous Windows (`output: "standalone"`, liens symboliques refusés) ; les parcours ont été joués sur `next dev`, avec des délais d'attente allongés (config temporaire non commitée). `playwright.config.ts` accepte maintenant `E2E_PORT` : le port 3100 était occupé par le serveur d'une autre session, que Playwright réutilisait.

- États vides **non faits** : n° 2 (jour sans repas), 3 (cantine sans menu), 4 (week-end vide), 13 (équipe), 14 (notifications), 15 et 16 (`/asso/menus`). Ils touchent des écrans que J5b-1 ne modifie pas ; à traiter avec J5b-2 ou J8b.
- La checklist n'apparaît que pour les foyers dont `onboarded_at` ≥ 2026-10-26 (`GETTING_STARTED_SINCE`, `src/server/getting-started.ts`) : c'est le sens de « foyers existants sans ligne » (§8).
- Bulles ancrées en fin de bloc d'en-tête de chaque onglet (progression des courses, carte de démarrage de la session, bandeau des jours), pas sur un élément ciblé par `aria-describedby` : l'ancre n'est pas reliée.
- Le bouton « Voir mes plats » mène à l'ancre `#plats` de Menu (ajoutée).
- Le bouton « Préparer ma semaine 2 » de la carte de réussite n'apparaît que si la semaine suivante peut être préparée (à partir du jeudi, comme dans Menu).
- Icônes : `cloche`, `cœur`, `école` n'existent pas ; `info`, `sparkle` les remplacent (`TODO(spec)`).
- La relance de la checklist depuis l'Aide (J8b) n'existe pas encore : seul « Annuler » du toast la rétablit.

## Questions ouvertes

1. Migration `20261107000000_getting_started.sql` appliquée au projet hébergé de développement (accord reçu).
2. Les questions de SPEC_PRISE_EN_MAIN §11 (objectif d'activation, niveau débutant, type de boîtes, fenêtre de la séquence, masquage et messages) restent à trancher avant J5b-2 et J7b.
3. `types` Supabase écrits à la main : à régénérer avec `pnpm db:types` après `db:push`.
4. Branche `prise-en-main` locale, non poussée.

## J5b-2 — fait

- **Décisions :** les questions ouvertes du §11 de la spec sont tranchées et consignées (objectif d'activation 40 %, niveau débutant même si le réglage est « à l'aise », taille en portions comme « type » de boîte, fenêtre de la séquence, masquage). SPEC_JANVIER pointe vers elles.
- **Moteur pur :** `src/engine/first-session.ts` (`packaging` : boîtes frigo et congélateur au même calcul que l'étape « Portionnage », `prepTile`, `effectiveLevel`, `endTime`) ; `FIRST_SESSION_TIPS` dans `getting-started.ts`.
- **Serveur :** `firstSessionInfo`, `tipsSeen` ; actions `setFirstSessionLevelAction`, `prepSheetOpenedAction`, `dismissPrepTileAction` ; `summarize` accepte un niveau ; `src/server/first-session-recap.ts` (récapitulatif de fin) ; `finishSessionAction` renvoie `recap`.
- **Interface :** `Tile` (ui), `PrepTile` (Tile + Sheet de préparation, `?prep=1`), niveau modifiable sur la carte de démarrage de Session, 3 conseils de première session (`SessionTip`), écran de fin avec repas préparés, durée réelle et consigne du lundi soir (repli sur le prochain dîner). La checklist se réduit quand la Tile est affichée.
- **Tests :** `first-session.test.ts` (19 : boîtes cohérentes avec buildSession sur 5 semaines, Tile, niveau, heure de fin) ; Playwright : 11 parcours dans `getting-started.spec.ts` (dont Tile et Sheet la veille, hors veille, lien `?prep=1`, niveau, écran de fin, axe sur Menu, Tile et Sheet en clair et en sombre) et audit axe complet de `a11y.spec.ts` : **tout vert**. Vitest 590, pgTAP inchangé.

### Écarts J5b-2
- « Type de boîtes » = taille en portions + conditionnement texte du seed (décision Q5) : aucune forme ni volume.
- La Tile n'apparaît que si le foyer a une checklist (foyers créés à partir du 26 octobre 2026).
- Le conseil `fs_wake` n'apparaît que si le Wake Lock est obtenu ; `fs_next` seulement hors dernière étape (il n'y a plus de bouton « Étape suivante » à la fin).
- **Corrections de robustesse trouvées en test :** l'effet de la bannière de fin peut s'exécuter deux fois (React en développement) et l'événement `session_done` être inscrit en double (vérifier puis insérer n'est pas atomique, existant) ; la première session est donc reconnue par le plus ancien événement. À corriger à la source avec une contrainte unique si le double enregistrement gêne les indicateurs.
- Le récapitulatif est calculé dans un `try/catch` : il ne peut pas empêcher l'affichage de la fin de session.

### Environnement d'essai
- Les parcours sont joués contre `next dev` (le build de production échoue sous Windows : liens symboliques). Délais allongés par une config temporaire non commitée.
- `E2E_PORT` et `E2E_PREFIX` isolent une exécution : le nettoyage final d'une autre exécution (préfixe `e2e-`) supprimait les comptes de test en cours de parcours sur le projet hébergé partagé (cause des échecs aléatoires observés).
- Test des `Segmented`/boutons : analyse axe lancée après la transition de couleur (700 ms), sinon faux positifs de contraste juste après le changement de thème.

## J7b — fait

- **Règle d'envoi pure :** `src/engine/getting-started-messages.ts` (`planMessage`) : priorité `session_eve` > `shopping_eve` > `session_late` > `session_after` > `week2` > `welcome`, un message par jour et par compte, étape déjà faite = pas d'envoi, fenêtre J0–J14 prolongée de 6 jours après la session, fuseau du foyer, masquage de la checklist (coupe `shopping_eve`, `session_late`, `week2`), canaux (e-mail non désinscrit, Web Push consenti et abonné).
- **Textes :** `src/i18n/getting-started-messages.ts` (6 messages : objet, corps, bouton, lien secondaire, version push).
- **Gabarits :** `src/emails/getting-started.tsx` (un gabarit pour les 6 messages, sur le `Layout` existant, désinscription en un clic et en-tête `List-Unsubscribe`) ; `sendGettingStartedEmail` dans `src/server/emails.ts`.
- **Envoi :** `src/server/getting-started-messages.ts` (`runGettingStartedMessages`) : lecture des données, réservation dans `notification_log` (deux index uniques : un message de la séquence par jour et par compte, une clé de message par compte), e-mail (Resend) et Web Push (VAPID), événement `onboarding_message_sent {key, channel}` par canal. Branché sur le planificateur `/api/cron/notify` et, pour la bienvenue, sur la fin de l'onboarding (après le premier menu). L'ancien e-mail de bienvenue n'est plus envoyé : pas de doublon.
- **Tests :** `getting-started-messages.test.ts` (22 : un cas par règle de la spec §7.2, fuseaux Paris et Auckland, reports, abandon, idempotence, foyer qui saute la session, masquage, fenêtre), `getting-started-emails.test.ts` (14 : rendu des 6 gabarits, désinscription, ton, longueurs, push), Playwright `getting-started-messages.spec.ts` (5 parcours avec le planificateur `?at=` : bienvenue réservée une fois, un seul message par jour, veille de session sans doublon sur 2 passages, désinscrit sans appareil, courses déjà cochées). Vitest 626, pgTAP inchangé, lint et typecheck propres.

### Écarts J7b
- Les messages de veille (`shopping_eve`, `session_eve`) ne sont jamais reportés (leur texte « demain » serait faux) ; la spec §4.5 est mise à jour. Les autres tolèrent un jour de retard.
- Aucune nouvelle migration : la réservation se fait par insertion avec détection du doublon (code 23505) plutôt que par une fonction SQL.
- `Insert` de `notification_log` ouvert dans les types écrits à la main (écriture serveur seulement).
- Sans clé Resend ni VAPID (environnement d'essai), l'envoi réel est sans effet : les tests vérifient la réservation et les règles, pas la livraison. À vérifier une fois avec Resend en mode test (envoi des 6 messages).
- `sendWelcome` et `WelcomeEmail` restent dans le code mais ne sont plus appelés.
- Test du planificateur : `CRON_SECRET` du serveur d'essai doit être celui de `.env.local` (le test le lit de la même source).
- **Correctif J5b trouvé au passage :** les bulles d'onglet (`TipBubble`) portent une clé (`key="tip"`) : sans elle, React signalait « Each child in a list should have a unique key » dans `MenuScreen` (élément créé côté serveur parmi plusieurs enfants).
- **Environnement :** un run a duré 5,8 h parce que la machine est passée en veille (`ERR_NETWORK_IO_SUSPENDED`) ; rejoué proprement ensuite. Parcours joués contre `next dev` (build de production impossible sous Windows). Les 16 parcours de la prise en main (11 de J5b, 5 de la séquence) passent ; l'audit axe complet de `a11y.spec.ts` a été joué à la fin de J5b-2 et l'interface n'a pas changé depuis, sauf les clés des bulles.

### Question ouverte
- Le message `session_eve` ne part pas le jour même de la bienvenue (un message par jour) : pour un foyer inscrit la veille de sa session, le tout premier message est donc la bienvenue et la préparation n'arrive pas. À arbitrer : laisser la bienvenue passer en premier (retenu), ou la remplacer ce jour-là par la préparation.

## Portage sur la pile PostgreSQL (14/11/2026)

La branche `prise-en-main` (écrite le 29/10 sur Supabase) n'avait jamais été fusionnée. Elle est réappliquée sur `main` (branche `prise-en-main-v2`), adaptée à la pile actuelle :

- **Migration** `db/migrations/20261117000000_getting_started.sql` (même contenu, instructions idempotentes : `if not exists`, `drop policy if exists`, `drop constraint if exists`) ; la contrainte `notification_log_kind_check` garde `renewal_notice` ajouté entre-temps. `20261106000000_storage_buckets.sql` de la branche n'est pas reprise (celle de `main` reste). Test pgTAP : `db/tests/23_getting_started_rls.test.sql`.
- **Types** : `pnpm db:types` (plus de `database.types.ts` écrit à la main) ; `onboarding_progress.first_session_level` ajouté à `scripts/db-types-overrides.json`.
- **Accès aux données** : `withAdmin` (progression, conseils, journal, événements) et `withSession` (liste de courses de la Tile) à la place des clients Supabase. La réservation d'un message se fait par `insert … on conflict do nothing` (les deux index uniques du journal) au lieu de détecter le code 23505.
- **E-mails** : `GettingStartedEmail` rejoint `src/emails/templates.tsx` (gabarit Néo : bandeau, pastille « TA PREMIÈRE SEMAINE », bouton jaune) ; envoi par Brevo via `sendEmail`. Bienvenue envoyée à la fin de l'onboarding, et aussi après `retryFirstWeek`.
- **Planificateur** : `runGettingStartedMessages` ajouté à `/api/cron/notify` à côté du rappel de reconduction (`deploy/cron.sh` appelle déjà cette route toutes les 15 minutes).
- **Interface** : checklist et Tile sous l'en-tête de Menu, bulle Menu juste avant le carrousel des 7 jours, ancre `#plats` sur la section « Plats de la semaine » ; bulle Courses sous la carte « Où j'en suis ». Le design system Néo ayant déjà un `Coachmark` statique, la bulle fermable s'appelle `TipCoachmark` (classes `.coach`). `Checklist`, `Tile`, la Sheet de préparation, l'écran de fin de première session et l'action « Annuler » du toast utilisent les classes Néo (`t-2`, `nb-flat`, `tone-success`, `lnk`…).
- **Tests e2e** : les deux parcours utilisent `adminDb()` (Kysely) à la place du client Supabase.
