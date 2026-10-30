# Image de production de Fin Prêt. Construite en CI (GitHub Actions), jamais sur le VPS.
# Les variables NEXT_PUBLIC_* sont figées dans le code client au build : elles se passent en --build-arg.
# Les secrets (base de données, Better Auth, Stripe, etc.) ne sont PAS dans l'image : ils arrivent à l'exécution (env_file).

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NODE_OPTIONS=--max-old-space-size=4096
RUN pnpm build

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# Le build écrit dans .next-build (voir next.config.ts) : le serveur autonome, ses fichiers statiques et public/.
COPY --from=build --chown=node:node /app/.next-build/standalone ./
COPY --from=build --chown=node:node /app/.next-build/static ./.next-build/static
COPY --from=build --chown=node:node /app/public ./public
# Migrations jouées par le service `migrate` (deploy/docker-compose.yml) avant chaque démarrage : `pg` est déjà
# dans les dépendances du serveur autonome.
COPY --from=build --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build --chown=node:node /app/scripts/lib/env.mjs ./scripts/lib/env.mjs
COPY --from=build --chown=node:node /app/supabase/migrations ./supabase/migrations
# Fichiers privés (volume `files`) : le dossier appartient à `node` pour qu'un volume neuf hérite de ces droits.
RUN mkdir -p /data/files && chown node:node /data/files
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
