# Sauvegarde et test de restauration

SPEC_JANVIER §8 : sauvegarde quotidienne, **test de restauration documenté avant le 18 décembre 2026**.
Ce document décrit la procédure. Le test lui-même se joue sur le tableau de bord Supabase (accès au projet requis) et son résultat se consigne dans le tableau en bas de page.

## Ce qui est sauvegardé

| Donnée | Où | Sauvegarde |
| --- | --- | --- |
| Base Postgres (foyers, menus, abonnements, reversements, journal) | Projet Supabase de **production** | Sauvegardes quotidiennes du plan Supabase (le plan Pro conserve 7 jours ; activer *Point-in-Time Recovery* si le budget le permet) |
| Fichiers Storage (`asso-kits/`, `asso-statements/`) | Supabase Storage | **Pas inclus** dans les sauvegardes de base : ils se régénèrent (fiche tuto) ou se recréent par `pnpm`/clôture (relevés). Exporter `asso-statements/` chaque trimestre après la clôture |
| Comptes (Auth) | Schéma `auth` du même projet | Inclus dans la sauvegarde de base |
| Paiements | Stripe | Source de vérité chez Stripe ; `stripe_events` permet de rejouer |

## Avant de commencer

1. Vérifier dans *Database → Backups* qu'une sauvegarde de moins de 24 h existe.
2. Créer un projet Supabase **vide** de test (région UE) : jamais d'écrasement du projet de production.
3. Noter l'heure et le nombre de lignes des tables témoins (voir plus bas).

## Procédure (30 minutes)

1. **Télécharger** la dernière sauvegarde (*Database → Backups → Download*), ou la restaurer dans le projet de test avec *Restore to a new project* si le plan l'autorise.
2. **Restaurer** dans le projet de test :
   ```bash
   # URL de connexion « Session pooler » du projet de TEST (jamais celui de production)
   pg_restore --no-owner --clean --if-exists -d "$TEST_DB_URL" sauvegarde.dump
   ```
3. **Appliquer les migrations manquantes** si la sauvegarde précède une migration : `SUPABASE_DB_URL=$TEST_DB_URL pnpm db:push`.
4. **Vérifier** les tables témoins par comparaison avec la production :
   ```sql
   select 'households' t, count(*) from public.households
   union all select 'subscriptions', count(*) from public.subscriptions
   union all select 'associations', count(*) from public.associations
   union all select 'school_menus', count(*) from public.school_menus
   union all select 'payout_lines', count(*) from public.payout_lines
   union all select 'auth.users', count(*) from auth.users;
   ```
5. **Vérifier l'application** contre le projet de test : `.env.local` pointé sur le projet de test, `pnpm dev`, connexion avec un compte existant, ouverture du menu de la semaine et de `/asso`.
6. **Supprimer** le projet de test et consigner le résultat ci-dessous.

## Critères de réussite

- Les décomptes des six tables témoins sont identiques à la production (à la sauvegarde près).
- Un compte existant se connecte et retrouve son foyer, son menu et son abonnement.
- Durée totale de restauration notée (objectif : moins de 2 heures pour le jour J).

## Journal des tests

| Date | Qui | Sauvegarde utilisée | Durée | Résultat | Remarques |
| --- | --- | --- | --- | --- | --- |
| *à jouer avant le 18 décembre 2026* | | | | | |
