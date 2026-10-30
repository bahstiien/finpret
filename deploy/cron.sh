#!/bin/bash
# Tâches planifiées de Fin Prêt (remplace pg_cron + pg_net de Supabase) : appelle /api/cron/<tâche> depuis le
# conteneur de l'app (sans passer par Internet), avec le CRON_SECRET de .env.production.
# Usage : cron.sh notify | streak-close | payouts — crontab de l'utilisateur `deploy` dans deploy/README.md.
set -euo pipefail
cd "$(dirname "$0")"

TASK="${1:?Usage : cron.sh notify|streak-close|payouts}"
case "$TASK" in notify | streak-close | payouts) ;; *)
  echo "Tâche inconnue : $TASK" >&2
  exit 1
  ;;
esac

# Le secret est lu dans le conteneur (variable d'environnement de l'app) : il n'apparaît pas dans la liste des processus.
docker compose exec -T app node -e "
fetch('http://127.0.0.1:3000/api/cron/$TASK', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })
  .then(async (r) => { const body = await r.text(); console.log(new Date().toISOString(), '$TASK', r.status, body.slice(0, 300)); process.exit(r.ok ? 0 : 1); })
  .catch((e) => { console.error(new Date().toISOString(), '$TASK', e.message); process.exit(1); });
"
