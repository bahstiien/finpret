# Déploiement sur le VPS (Hostinger)

Le workflow `.github/workflows/deploy.yml` construit l'image, la pousse sur `ghcr.io/bahstiien/finpret` puis déploie par SSH.
Il se lance en poussant un tag (`git tag v1.0.0 && git push origin v1.0.0`) ou à la main (Actions > Deploy > Run workflow).

Sur le VPS, `docker-compose.yml` fait tourner quatre services :

| Service | Rôle |
| --- | --- |
| `db` | PostgreSQL 18, volume `pgdata`, jamais exposé hors du réseau Docker |
| `migrate` | joue les migrations SQL (`scripts/migrate.mjs`, même image que l'app) avant chaque démarrage ; l'app ne démarre que s'il réussit |
| `app` | Next.js, connecté en `finpret_app` (rôle soumis à la RLS), fichiers privés dans le volume `files` |
| `caddy` | HTTPS et proxy ; seul service exposé (ports 80 et 443) |

## Une seule fois, sur le VPS (utilisateur `deploy`)

```bash
mkdir -p ~/finpret/backups && cd ~/finpret
# copier ici, depuis le dossier deploy/ du dépôt : docker-compose.yml, Caddyfile, backup.sh et le dossier db-init/
chmod +x backup.sh db-init/01-roles.sh
nano .env                   # mots de passe de la base : voir compose.env.example (openssl rand -hex 32)
nano .env.production        # variables de l'app : voir .env.example ; DATABASE_URL et FILES_DIR viennent du compose
chmod 600 .env .env.production
docker login ghcr.io -u <utilisateur GitHub>   # mot de passe : jeton « read:packages »
```

Au premier `docker compose up -d`, Postgres crée la base `finpret` et les rôles (`db-init/01-roles.sh`), puis `migrate` applique toutes les migrations.
La base n'écoute que sur `127.0.0.1` du VPS. Pour y accéder depuis un poste (import du catalogue, consultation), un tunnel SSH :

```bash
ssh -N -L 54330:127.0.0.1:5432 deploy@<IP du VPS>
# dans un autre terminal, depuis le dépôt : import une fois du catalogue (ingrédients, recettes)
DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:54330/finpret?sslmode=disable" pnpm seed
```

## Sauvegardes

`backup.sh` sauvegarde chaque nuit la base (`pg_dump`, vérifié par `pg_restore --list`) et les PDF (volume `files`) dans `~/finpret/backups`, gardés 14 jours.

```bash
crontab -e
# 30 3 * * * /home/deploy/finpret/backup.sh >> /home/deploy/finpret/backups/backup.log 2>&1
```

Une sauvegarde qui reste sur le VPS ne protège pas d'une perte du VPS : configurer une copie hors du serveur dans `~/finpret/backup.env` (`chmod 600`) :

```bash
BACKUP_REMOTE=finpret-crypt:       # remote rclone chiffré (rclone config : type « crypt » au-dessus d'un stockage S3, Drive…)
BACKUP_PING_URL=https://hc-ping.com/<uuid>   # surveillance : alerte si la sauvegarde ne s'est pas faite
```

Restauration et test de restauration : `docs/RESTAURATION.md`.

## Clé de déploiement (distincte de ta clé personnelle)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/finpret_deploy -C "github-actions-finpret" -N ""
cat ~/.ssh/finpret_deploy.pub >> ~/.ssh/authorized_keys     # sur le VPS
cat ~/.ssh/finpret_deploy                                    # clé privée → secret VPS_SSH_KEY
ssh-keyscan -t ed25519 <IP du VPS>                           # ligne → secret VPS_KNOWN_HOSTS
```

## Dans GitHub (Settings)

Secrets (Settings > Secrets and variables > Actions), à créer dans l'environnement `production` :

| Secret | Valeur |
| --- | --- |
| `VPS_HOST` | adresse IP du VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | clé privée de déploiement |
| `VPS_KNOWN_HOSTS` | sortie de `ssh-keyscan` |

Variables du dépôt (valeurs publiques, intégrées au code du navigateur) : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SENTRY_DSN`.

Conseil : dans Settings > Environments > `production`, ajouter un « Required reviewer » (toi) pour valider chaque déploiement.

## Retour arrière

Le workflow revient seul à la version précédente si les migrations échouent ou si l'app ne devient pas `healthy` en 90 s.
À la main : `cd ~/finpret && sed -i 's/^APP_TAG=.*/APP_TAG=<ancienne étiquette>/' .env && docker compose up -d`
(ne jamais réécrire `.env` en entier : il contient les mots de passe de la base).

Les migrations ne se défont pas : une ancienne version de l'app tourne sur le schéma le plus récent. Une migration doit donc
rester compatible avec la version précédente (ajouter avant de retirer), ou le retour arrière passe par une restauration.
