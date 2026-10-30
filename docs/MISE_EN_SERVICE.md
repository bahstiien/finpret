# Mise en service de la production (VPS, sans Supabase)

La production démarre sur une base **vide** : aucune donnée n'est reprise de Supabase (pas d'utilisateur réel avant le lancement).
Détail des services et commandes : `deploy/README.md` ; sauvegarde et restauration : `RESTAURATION.md`.

## 1. Préparer les accès (une fois)

| Où | Quoi |
| --- | --- |
| Google Cloud | ID client OAuth « Application Web », URI de redirection `https://finpret.app/api/auth/callback/google` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Resend | domaine `finpret.app` vérifié (SPF, DKIM) → `RESEND_API_KEY`, `EMAIL_FROM` (les liens de connexion partent par Resend) |
| Stripe | `pnpm stripe:setup` en mode réel, webhook `https://finpret.app/api/stripe/webhook` (événements listés dans `src/server/stripe-webhook.ts`) → `STRIPE_*` |
| Surveillance | un contrôle « sauvegarde » (ex. healthchecks.io) → `BACKUP_PING_URL` ; un stockage hors du VPS pour `rclone` → `BACKUP_REMOTE` |
| GitHub | secrets `VPS_*` et variables `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SENTRY_DSN` (`deploy/README.md`) ; plus aucun secret Supabase |

## 2. Préparer le VPS

1. Copier depuis `deploy/` : `docker-compose.yml`, `Caddyfile`, `backup.sh`, `cron.sh`, `db-init/` ; `chmod +x *.sh db-init/*.sh`.
2. `~/finpret/.env` d'après `deploy/compose.env.example` (deux mots de passe `openssl rand -hex 32`).
3. `~/finpret/.env.production` d'après `.env.example`, valeurs de **production** :
   `APP_URL=https://finpret.app`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`, à ne jamais changer : il chiffre les clés TOTP),
   `CRON_SECRET`, `IBAN_ENCRYPTION_KEY`, `UNSUBSCRIBE_SECRET`, Google, Resend, Stripe, VAPID, Sentry, `ANTHROPIC_API_KEY`, `ALERT_EMAIL`, `COMPANY_*`.
   `DATABASE_URL` et `FILES_DIR` sont fixés par `docker-compose.yml` : ne pas les mettre ici.
4. `chmod 600 .env .env.production backup.env`.

## 3. Premier déploiement

1. Pousser un tag (`git tag v1.0.0 && git push origin v1.0.0`) : le workflow construit l'image et lance `docker compose up -d`.
   Au premier démarrage, Postgres crée la base et les rôles, `migrate` applique toutes les migrations, puis l'app démarre.
2. Vérifier : `docker compose ps` (quatre services, `app` *healthy*), `docker compose logs migrate` (« migration … » puis fin sans erreur).
3. Importer le catalogue (ingrédients, recettes, contenants) depuis un poste, par le tunnel SSH de `deploy/README.md` : `pnpm seed`.

## 4. Planificateur et sauvegardes

```bash
crontab -e   # utilisateur deploy ; heures en UTC
*/15 * * * * /home/deploy/finpret/cron.sh notify >> /home/deploy/finpret/backups/cron.log 2>&1
5 * * * *    /home/deploy/finpret/cron.sh streak-close >> /home/deploy/finpret/backups/cron.log 2>&1
0 2 1 1,4,7,10 * /home/deploy/finpret/cron.sh payouts >> /home/deploy/finpret/backups/cron.log 2>&1
30 3 * * *   /home/deploy/finpret/backup.sh >> /home/deploy/finpret/backups/backup.log 2>&1
```

La clôture trimestrielle (`payouts`) tourne le 1er du trimestre à 02:00 UTC, soit 03:00 ou 04:00 à Paris ; elle peut être rejouée sans risque.
Lancer une fois `backup.sh` à la main et vérifier le fichier produit et sa copie hors serveur.

## 5. Premier administrateur

1. Se connecter sur `https://finpret.app/login` (lien magique ou Google).
2. L'inscrire dans `admins` :
   ```bash
   docker compose exec -T db psql -U postgres -d finpret -c \
     "insert into public.admins (user_id) select id from auth.users where email = '<adresse>'"
   ```
3. Ouvrir `/admin` : la page `/admin/mfa` affiche un QR code à scanner (application d'authentification), puis demande le code à chaque session.

## 6. Recette de mise en service

- [ ] Connexion par lien magique (e-mail reçu de Resend) et par Google.
- [ ] Onboarding complet : foyer, menu de la semaine, liste de courses.
- [ ] Courses partagées : deux appareils du foyer, une coche visible chez l'autre en moins de 2 s (flux `/api/realtime` à travers Caddy).
- [ ] Session : démarrage, minuteur, fin de session et série.
- [ ] Abonnement : Checkout Stripe en mode réel avec une carte réelle, puis remboursement ; webhook reçu (`stripe_events`).
- [ ] Association : inscription, validation dans `/admin`, fiche tuto PDF téléchargée (écrite dans le volume `files`).
- [ ] `cron.log` : passages `notify` en 200 toutes les 15 minutes.
- [ ] `backup.log` : une sauvegarde de la nuit, copiée hors serveur ; test de restauration joué (`RESTAURATION.md`).

## 7. Après la mise en service

Supprimer le projet Supabase (développement) et ses secrets une fois la production validée : plus rien ne s'y connecte.
