# Déploiement sur le VPS (Hostinger)

Le workflow `.github/workflows/deploy.yml` construit l'image, la pousse sur `ghcr.io/bahstiien/finpret` puis déploie par SSH.
Il se lance en poussant un tag (`git tag v1.0.0 && git push origin v1.0.0`) ou à la main (Actions > Deploy > Run workflow).

## Une seule fois, sur le VPS (utilisateur `deploy`)

```bash
mkdir -p ~/finpret && cd ~/finpret
# copier ici docker-compose.yml et Caddyfile (dossier deploy/ du dépôt)
nano .env.production        # variables d'exécution : voir .env.example, jamais dans Git
docker login ghcr.io -u <utilisateur GitHub>   # mot de passe : jeton « read:packages »
```

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

Variables du dépôt (valeurs publiques, intégrées au code du navigateur) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SENTRY_DSN`.

Conseil : dans Settings > Environments > `production`, ajouter un « Required reviewer » (toi) pour valider chaque déploiement.

## Retour arrière

Le workflow revient seul à la version précédente si l'app ne devient pas `healthy` en 90 s.
À la main : `cd ~/finpret && echo APP_TAG=<ancienne étiquette> > .env && docker compose up -d`.

Les migrations Supabase ne sont jamais automatiques : `pnpm db:push` se lance à la main avant un déploiement qui en contient.
