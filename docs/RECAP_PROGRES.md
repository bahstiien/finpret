# Récapitulatif SPEC_PROGRES (jalons G1 à G4)

Branche `progres` (worktree `spec-progres`, issue de `m2-catalogue`). Spec : `SPEC_PROGRES.md` (hors dépôt).

## Fait

**G1 — données et moteur**
- `src/engine/streak.ts`, `passport.ts`, `cooks.ts`, `progress-view.ts` : moteur pur, sans React ni Supabase.
- Migration `20261101000000_progress.sql` : `sessions.done_at`, `streak_weeks`, `recipe_cooks`, `achievements` (lecture par les membres du foyer, aucune écriture client), correction des origines (`as` → null, `uk` → `gb`). Seed, `origins.ts` et `classify.ts` corrigés ; le schéma du seed accepte `o: null`.
- `src/server/progress.ts` : orchestration testée sans base (`ProgressStore`), implémentée dans `progress-store.ts` avec la clé de service. `/api/cron/streak-close` (horaire), actions serveur `finishSessionAction`, `planPauseAction`, `cancelPauseAction`, `markAchievementsSeen`.
- `scripts/backfill-progress.ts` (`pnpm backfill:progress [--dry-run]`) : rattrapage sans célébration.

**G2 — série** : ligne de série en fin de session, tuile sur le Menu, page `/app/progress` (série, frise, jetons, `Planifier une pause`), réglage `progress_visible` et lien dans le profil, notification de pause automatique (migration `20261101100000`, branchée sur `/api/cron/notify`).

**G3 — passeport** : composant `Stamp`, icônes `streak`/`pause`/`passport`/`share`, bloc passeport, feuilles de détail et de nouveaux tampons (`CelebrationHost`), filtre `?origin=` dans Découvrir.

**G4 — partage** : `GET /api/share/streak?milestone=N` (`next/og`, 1080 × 1350), feuille de palier avec `navigator.share`.

## Tests
- Vitest : 455 verts (moteur, orchestration, carte de partage, notifications). `pnpm lint` et `pnpm typecheck` propres, `pnpm build` passe.
- pgTAP sur PGlite : `12_progress_rls.test.sql` (9 vérifications), tous verts.
- Playwright : `tests/e2e/progress.spec.ts` (5 parcours) et `/app/progress` ajouté à l'audit axe. **Non joués** : ils exigent les migrations sur le projet Supabase hébergé (`pnpm db:push`), non appliquées sans accord.

## Écarts avec la spec
- Cron : routes Next.js `/api/cron/streak-close` au lieu d'une Edge Function (même convention que `/api/cron/notify`).
- Soirs simples : inscrits dès que leur jour est passé (3 dernières semaines, à chaque passage horaire), et non seulement à la clôture du mercredi, sinon ceux du jeudi et du vendredi n'auraient jamais été comptés.
- `design-system/` ne contient que `tokens.json` : pas de `README.md`/`preview.html` pour `Stamp` ni `Icon` (composants dans `src/components/ui/`).
- Rattrapage : seuls `recipe_cooks` et les tampons sont inscrits ; l'historique de série antérieur au lancement n'est pas reconstitué.
- Pause planifiée sur une semaine neutre : le jeton n'est pas consommé.
- `types` Supabase écrits à la main pour les 3 tables (à régénérer avec `pnpm db:types` après `db:push`).
- Pas d'événement `progress_viewed` depuis la fin de session (`from: 'session'` accepté mais non émis).

## Questions ouvertes
1. Appliquer les migrations au projet hébergé de développement et jouer les parcours Playwright ?
2. Prénom du foyer sur la carte (spec §12.1) : non, par défaut. Repas par créneau couvert (§12.2) : retenu.
3. `grid.test.ts` (2400 combinaisons) a dépassé son délai une fois sous charge parallèle ; il passe seul. Non lié à ce travail.
